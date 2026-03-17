import { useEffect, useRef, useState } from 'react';

type LogLevel = 'all' | 'error' | 'warn' | 'info' | 'debug';

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  raw: string;
}

const LEVEL_FILTERS: LogLevel[] = ['all', 'error', 'warn', 'info', 'debug'];

function levelBadgeClass(level: string): string {
  switch (level) {
    case 'error':
    case 'fatal':
      return 'bg-red-900/40 text-red-400 shrink-0 w-12 text-center rounded px-1';
    case 'warn':
      return 'bg-yellow-900/40 text-yellow-400 shrink-0 w-12 text-center rounded px-1';
    case 'info':
      return 'bg-gray-800 text-gray-400 shrink-0 w-12 text-center rounded px-1';
    default:
      return 'text-gray-600 shrink-0 w-12 text-center rounded px-1';
  }
}

export default function LogsPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [levelFilter, setLevelFilter] = useState<LogLevel>('all');

  // Use a ref to track at-bottom state to avoid re-renders on scroll
  const atBottomRef = useRef(true);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const bottomAnchorRef = useRef<HTMLDivElement>(null);

  const fetchLogs = () => {
    fetch('/api/logs')
      .then((r) => r.json())
      .then((data: LogEntry[]) => {
        setEntries(data);
      })
      .catch(() => {
        // Silently ignore fetch errors (service may be temporarily unavailable)
      });
  };

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000);
    return () => clearInterval(interval);
  }, []);

  // Auto-scroll to bottom when entries update — only if already at bottom
  useEffect(() => {
    if (atBottomRef.current && bottomAnchorRef.current) {
      bottomAnchorRef.current.scrollIntoView({ behavior: 'auto' });
    }
  }, [entries]);

  const handleScroll = () => {
    const el = scrollContainerRef.current;
    if (!el) return;
    atBottomRef.current = el.scrollTop + el.clientHeight >= el.scrollHeight - 20;
  };

  const filtered =
    levelFilter === 'all'
      ? entries
      : entries.filter((e) => e.level === levelFilter);

  return (
    <div className="flex flex-col h-full">
      {/* Level filter buttons */}
      <div className="flex gap-1 mb-3">
        {LEVEL_FILTERS.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setLevelFilter(lvl)}
            className={
              levelFilter === lvl
                ? 'bg-gray-700 text-white text-xs px-3 py-1 rounded capitalize'
                : 'text-gray-400 hover:text-gray-200 text-xs px-3 py-1 rounded capitalize'
            }
          >
            {lvl === 'all' ? 'All' : lvl.charAt(0).toUpperCase() + lvl.slice(1)}
          </button>
        ))}
      </div>

      {/* Log area */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="font-mono text-xs bg-gray-950 rounded-lg p-4 h-[calc(100vh-200px)] overflow-y-auto"
      >
        {filtered.length === 0 ? (
          <p className="text-gray-500 text-sm">No log entries.</p>
        ) : (
          filtered.map((entry, i) => (
            <div key={i} className="flex gap-3 leading-5">
              <span className="text-gray-500 shrink-0 w-28">{entry.timestamp}</span>
              <span className={levelBadgeClass(entry.level)}>{entry.level}</span>
              <span className="text-gray-200 break-words min-w-0">{entry.message}</span>
            </div>
          ))
        )}
        {/* Bottom anchor for auto-scroll */}
        <div ref={bottomAnchorRef} />
      </div>
    </div>
  );
}
