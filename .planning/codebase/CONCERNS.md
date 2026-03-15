# Codebase Concerns

**Analysis Date:** 2026-03-15

## Tech Debt

**Message Cursor Rollback Logic:**
- Issue: When a container error occurs after output is already sent to the user, the code must decide whether to rollback the message cursor. Current logic assumes rollback is safe if output was sent, but this creates a window where an error + duplicate message is preferred to message loss. If a partial failure happens mid-stream, this heuristic may be incorrect.
- Files: `src/index.ts` (lines 260-277)
- Impact: Potential duplicate messages to user in edge cases with streaming output failures; message loss if rollback occurs incorrectly
- Fix approach: Make cursor rollback configurable per-group or implement explicit transaction semantics with explicit commit points in the agent protocol

**IPv4 Force Override in Telegram Module:**
- Issue: DNS lookups are globally monkeypatched at module load time in `src/channels/telegram.ts` to force IPv4 due to WSL IPv6 issues. This is an undeclared side effect that affects all DNS lookups across the entire process, not just Telegram.
- Files: `src/channels/telegram.ts` (lines 1-20)
- Impact: All downstream DNS lookups are forced to IPv4; breaks legitimate IPv6-only services; conflicts with potential future IPv6-supporting code
- Fix approach: Namespace the DNS override to only the grammy Bot instance, or use a library-specific configuration option if grammy supports it

**Mount Allowlist Caching Without Reload:**
- Issue: `src/mount-security.ts` caches the allowlist in memory at startup with no reload mechanism. Changes to `~/.config/nanoclaw/mount-allowlist.json` require a full process restart to take effect.
- Files: `src/mount-security.ts` (lines 22-24, 54-119)
- Impact: Security policy changes require downtime; operators may unknowingly use stale allowlists
- Fix approach: Implement reload-on-change detection (stat the file mtime) or provide a `/reload-mount-allowlist` command

**Database Migration Via Silent Try-Catch:**
- Issue: Schema migrations in `src/db.ts` (lines 127-181) use try-catch with silent failure. If a migration partially fails or leaves the DB in an inconsistent state, future sessions will silently skip it and operate on corrupted schema.
- Files: `src/db.ts` (lines 127-181)
- Impact: Silent schema corruption; difficult to debug inconsistent DB state; no audit trail of which migrations succeeded/failed
- Fix approach: Implement explicit version-tracked migrations with rollback support; log migration attempts and outcomes

---

## Known Issues

**Telegram Bot Pool Sender Assignment is Permanent:**
- Symptoms: A sender is assigned to a pool bot on first message and always uses that bot. If the assigned bot becomes unavailable (deleted, rate-limited), messages hang until process restart.
- Files: `src/channels/telegram.ts` (lines 42-45, 86-91)
- Trigger: Create agent team with bot pool, then delete one of the pool bots. Subsequent messages from agents assigned to that bot will hang.
- Workaround: Restart NanoClaw service to reset pool assignments

**IPC File Race Condition on High-Volume Message Bursts:**
- Symptoms: If multiple groups send IPC messages simultaneously, file rename operations in `src/group-queue.ts` (lines 171-173) could race with the IPC watcher reading files, causing occasional "ENOENT: file not found" errors when a file is deleted between readdir and read.
- Files: `src/group-queue.ts` (lines 160-178), `src/ipc.ts` (lines 90-170)
- Trigger: Send many triggered messages to multiple groups simultaneously
- Workaround: Errors are logged and retried on next incoming message; no user-visible impact except transient log spam

**Container Timeout Grace Period Arithmetic:**
- Symptoms: If `IDLE_TIMEOUT` is close to `CONTAINER_TIMEOUT`, the grace period calculation `Math.max(configTimeout, IDLE_TIMEOUT + 30_000)` may still timeout containers before the idle sentinel fires.
- Files: `src/container-runner.ts` (lines 458-461)
- Trigger: Set `IDLE_TIMEOUT=30000` and `CONTAINER_TIMEOUT=40000`
- Workaround: Ensure `CONTAINER_TIMEOUT` is significantly larger than `IDLE_TIMEOUT` (current defaults: 300s vs 30s, so not an issue in practice)

---

## Security Considerations

**Credential Proxy Port Binding on WSL:**
- Risk: On WSL with docker-ce, the credential proxy binds to the docker0 bridge IP (`172.17.0.1:3001`) as a security boundary — only containers can reach it. However, if the operator manually binds to `0.0.0.0` via `CREDENTIAL_PROXY_HOST` env var, the proxy becomes accessible from the Windows host, potentially exposing credentials.
- Files: `src/container-runtime.ts` (lines 23-49), `src/index.ts` (lines 501-504)
- Current mitigation: Default detection logic uses docker0 bridge; documentation warns against `0.0.0.0`
- Recommendations:
  - Validate `CREDENTIAL_PROXY_HOST` at startup and warn if it's `0.0.0.0` or `127.0.0.1` on non-Darwin
  - Consider rejecting overly permissive bindings entirely

**IPC Authorization in processTaskIpc:**
- Risk: IPC authorization checks `isMain` flag derived from directory structure. If an operator manually creates a false `isMain` directory or symlinks an IPC folder, non-main groups could execute main-only operations like `register_group`.
- Files: `src/ipc.ts` (lines 76-84, 493-525)
- Current mitigation: `isMain` is computed from registered groups in DB, not user-supplied; stored in memory before IPC processing
- Recommendations:
  - Log all register_group calls with timestamps and source folder
  - Add integrity check: verify sourceGroup folder matches a registered group before trusting its isMain status

**Mount Allowlist Symlink Attack:**
- Risk: `src/mount-security.ts` resolves symlinks via `fs.realpathSync()` to prevent escape attacks. However, if the allowlist file itself is a symlink to an unrestricted location, an operator could unwittingly approve dangerous paths.
- Files: `src/mount-security.ts` (lines 54-119, 139-145)
- Current mitigation: Allowlist is stored outside project root in `~/.config/nanoclaw/mount-allowlist.json`
- Recommendations:
  - Warn if the allowlist file is a symlink
  - Document that the allowlist location must be owned by the user (mode 0600 or 0700)

**Image Processing Doesn't Validate JPEG Headers:**
- Risk: `src/image.ts` calls `sharp(buffer).resize()` on user-provided buffers without validating format. A malformed JPEG could cause sharp to hang or OOM.
- Files: `src/image.ts` (lines 23-36)
- Current mitigation: sharp is a mature library with built-in validation; buffer size is limited by Telegram/WhatsApp
- Recommendations:
  - Add explicit format detection before sharp processing: `const metadata = await sharp(buffer).metadata()` to fail fast on invalid formats
  - Set `sharp({ failOnError: true })` to catch format errors early

---

## Performance Bottlenecks

**Group Queue Linear Scanning on Waiting Groups:**
- Problem: When a container finishes, `drainWaiting()` in `src/group-queue.ts` (lines 318-344) iterates `waitingGroups` array sequentially with no optimization. On high-concurrency setups with 100+ groups, this becomes O(n).
- Files: `src/group-queue.ts` (lines 318-344)
- Cause: Simple array-based queue; works fine at current scale (2-5 groups) but doesn't scale
- Improvement path: Use a priority queue or heap-based structure if the number of registered groups grows beyond 10

**SQLite Message Query on Large Chats:**
- Problem: `getMessagesSince()` in `src/db.ts` (lines 381-404) uses `LIMIT 200` with no pagination. Chats with 10,000+ messages will still query the entire table and sort in memory.
- Files: `src/db.ts` (lines 381-404), used by `src/index.ts` (line 169)
- Cause: Subquery LIMIT is applied before the chronological sort; doesn't benefit from timestamp index
- Improvement path: Optimize query to `ORDER BY timestamp DESC LIMIT 200` first, then sort results client-side if needed

**IPC File Watcher Polls at Fixed Interval:**
- Problem: `processIpcFiles()` in `src/ipc.ts` (line 211) reschedules with a fixed `IPC_POLL_INTERVAL` (default 100ms). On quiet systems, this wastes 10+ fs.readdir calls per second.
- Files: `src/ipc.ts` (lines 51-216)
- Cause: Simplicity over efficiency; polling is easier than filesystem watchers which have platform-specific bugs
- Improvement path: Only worth optimizing if IPC latency becomes visible (currently not); acceptable for now

---

## Fragile Areas

**Container Output Stream Parser:**
- Files: `src/container-runner.ts` (lines 377-431)
- Why fragile: Parses streaming output with sentinel markers `---NANOCLAW_OUTPUT_START---` and `---NANOCLAW_OUTPUT_END---`. If agent code accidentally outputs these strings in its own results, parsing breaks. Parser assumes markers never appear mid-JSON, but nothing enforces this.
- Safe modification: Add UUID-based markers instead of fixed strings; validate that markers appear on line boundaries
- Test coverage: `src/container-runner.test.ts` has basic tests but no malformed-marker edge cases

**Idle Timeout Close Sentinel:**
- Files: `src/group-queue.ts` (lines 183-194), `src/index.ts` (lines 206-214)
- Why fragile: A container is signaled to close by writing a `_close` sentinel file. If the agent doesn't check for this file or the IPC handler doesn't watch for it, the container hangs until hard timeout.
- Safe modification: Document the `_close` contract in agent-runner; add logging when close is signaled vs. when container actually exits
- Test coverage: No tests for idle timeout preemption

**Registered Group Folder Validation:**
- Files: `src/group-folder.ts` (isValidGroupFolder), used by `src/db.ts` (lines 604-610, 627-629, 658-664)
- Why fragile: Path validation regex rejects names with special chars, but regex is applied at multiple layers (DB load, setRegisteredGroup, getAllRegisteredGroups). If validation is inconsistent, corrupted groups can exist in DB but are silently skipped at runtime.
- Safe modification: Centralize validation in one place; add DB constraint to prevent invalid names from being inserted
- Test coverage: `src/group-folder.test.ts` exists but tests only the validation function, not the full load-from-DB path

---

## Scaling Limits

**Concurrent Container Limit (5 Hardcoded):**
- Current capacity: 5 simultaneously running containers
- Limit: Beyond 5 active groups, additional groups queue and wait for a slot
- Scaling path: Make `MAX_CONCURRENT_CONTAINERS` configurable; most users won't hit this limit, but it's a safety mechanism to prevent OOM. Raising it requires:
  - Testing memory usage per container (typical: 150-300 MB base + agent size)
  - Validating that 10+ concurrent containers don't exhaust host memory or CPU
  - Adjusting idle timeout if containers spend significant time idle

**SQLite Single-Connection Model:**
- Current capacity: Single `better-sqlite3` database connection, synchronous operations block message loop
- Limit: High-frequency message arrivals from multiple channels can queue up if DB operations are slow. No connection pooling.
- Scaling path: Not urgent (current setup handles 2-3 groups easily), but if adding more channels:
  - Profile DB operation latency in production
  - Consider async operations with a connection pool if latency exceeds 10ms

**Image Processing Buffer Size:**
- Current capacity: Telegram/WhatsApp image limits are enforced by platforms (10-100 MB typical)
- Limit: A 100 MB image gets resized and stored in group dir. Multiple large images in a burst could fill disk.
- Scaling path: Add disk space monitoring; implement image cleanup (e.g., delete images older than 30 days)

---

## Dependencies at Risk

**grammy (Telegram Library):**
- Risk: Active library but tied to Telegram Bot API. Major API changes could break functionality.
- Impact: Telegram channel stops working if grammy isn't updated
- Migration plan: grammy has stable API; monitor releases for deprecations

**better-sqlite3 (SQLite Binding):**
- Risk: Native Node.js binding; can be slow to update on new Node.js versions
- Impact: Incompatible Node.js versions after major updates
- Migration plan: Pin Node.js version in `.nvmrc`; test new versions before upgrading

**sharp (Image Processing):**
- Risk: Depends on native libvips; can fail silently on ARM or unusual architectures
- Impact: Image processing breaks on non-x64 platforms
- Migration plan: Document that image support requires libvips (included in Docker); add check at startup

---

## Test Coverage Gaps

**Message Cursor Rollback Edge Cases:**
- What's not tested: Streaming output arrives, agent logs error, cursor rollback decision
- Files: `src/index.ts` (lines 256-280)
- Risk: A partial-success scenario (output sent, then error) is hard to reproduce in tests
- Priority: High — this is the only path that can duplicate messages

**IPC Authorization Boundary:**
- What's not tested: A non-main group attempting to register a new group via IPC
- Files: `src/ipc.ts` (lines 493-525)
- Risk: Authorization bypass if `isMain` flag is corrupted
- Priority: Medium — security-relevant but requires deliberate tampering

**Container Timeout After Idle Close:**
- What's not tested: Idle timeout preempts a container, then container doesn't exit and hard timeout fires
- Files: `src/container-runner.ts` (lines 456-486)
- Risk: Containers hang past idle deadline, consuming resources
- Priority: Low — timeouts are defensive; hard timeout will eventually kill it

**Image Parsing with Malformed References:**
- What's not tested: `[Image: evil/../../etc/passwd]` in message content
- Files: `src/image.ts` (lines 53-66)
- Risk: Image attachment paths are resolved relative to group dir; a malformed reference could leak other groups' images
- Priority: Medium — container agents write message content, so risk is internal, not external

---

## Missing Critical Features

**No Audit Log:**
- Problem: No permanent record of which agent performed which action (sent messages, created tasks, registered groups, accessed IPC)
- Blocks: Accountability; debugging; security investigations
- Workaround: Enable `LOG_LEVEL=debug` and parse process logs, but they're ephemeral

**No Session Snapshot/Restore:**
- Problem: If a container crashes mid-session, the Claude session is lost (session ID is only written on success). Next invocation starts fresh.
- Blocks: Multi-turn conversations with state (e.g., multi-step debugging sessions)
- Workaround: Agent implements its own state persistence in group folder

**No Deadletter Queue for Failed IPC:**
- Problem: If an IPC operation fails, the file is moved to `data/ipc/errors/` but never retried. Operator must manually move the file back.
- Blocks: Reliable task scheduling
- Workaround: Operator monitors `data/ipc/errors/` and manually retries

---

*Concerns audit: 2026-03-15*
