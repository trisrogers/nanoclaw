import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import GroupsPanel from './GroupsPanel';

interface LastError {
  message: string;
  timestamp: string;
}

interface Stats {
  channelsConnected: number;
  activeContainers: number;
  ipcQueueDepth: number;
  todosDueToday: number;
  lastError: LastError | null;
}

interface ChannelStatus {
  name: string;
  connected: boolean;
}

interface FiveHour { utilization: number; resets_at: string }
interface SevenDay { utilization: number; resets_at: string }
interface ExtraUsage { is_enabled: boolean; monthly_limit: number; used_credits: number; utilization: number }
interface UsageData { five_hour: FiveHour | null; seven_day: SevenDay | null; extra_usage: ExtraUsage | null }
interface UsageResponse { data: UsageData | null; error: string | null }

function usePoll<T>(url: string, intervalMs: number) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`${res.status}`);
        const json = await res.json();
        if (!cancelled) setData(json);
      } catch (e) {
        if (!cancelled) setError(String(e));
      }
    };
    fetchData();
    const id = setInterval(fetchData, intervalMs);
    return () => { cancelled = true; clearInterval(id); };
  }, [url, intervalMs]);
  return { data, error };
}

function StatCard({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div className="text-2xl font-semibold text-gray-100">{value ?? '—'}</div>
    </div>
  );
}

function LastErrorCard({ error }: { error: LastError | null }) {
  const [expanded, setExpanded] = useState(false);

  if (!error) {
    return (
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 col-span-2">
        <div className="text-gray-400 text-sm mb-1">Last Error</div>
        <div className="text-gray-500 text-lg">None</div>
      </div>
    );
  }

  // Try to infer a rough "time ago" from HH:MM:SS timestamp
  function relativeTime(ts: string): string {
    try {
      const now = new Date();
      const [h, m] = ts.split(':').map(Number);
      const errDate = new Date(now);
      errDate.setHours(h, m, 0, 0);
      // Handle midnight crossover
      if (errDate > now) errDate.setDate(errDate.getDate() - 1);
      const diffMin = Math.floor((now.getTime() - errDate.getTime()) / 60000);
      if (diffMin < 1) return 'just now';
      if (diffMin < 60) return `${diffMin}m ago`;
      return `${Math.floor(diffMin / 60)}h ago`;
    } catch {
      return ts;
    }
  }

  return (
    <div className="bg-gray-900 border border-red-900/60 rounded-lg p-4 col-span-2">
      <div className="flex items-center justify-between mb-1">
        <div className="text-red-400 text-sm font-medium">
          Last Error: {relativeTime(error.timestamp)}
          <span className="text-gray-500 text-xs ml-2">({error.timestamp})</span>
        </div>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-gray-500 hover:text-gray-300 transition-colors"
          aria-label={expanded ? 'Collapse' : 'Expand'}
        >
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>
      <div className={`text-red-300 text-sm font-mono ${expanded ? '' : 'truncate'}`}>
        {error.message}
      </div>
    </div>
  );
}

function formatReset(iso: string): string {
  try {
    return new Date(iso).toLocaleString(undefined, {
      weekday: 'short', month: 'short', day: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    });
  } catch { return iso; }
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color = clamped >= 90 ? 'bg-red-500' : clamped >= 60 ? 'bg-yellow-500' : 'bg-green-500';
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1.5">
      <div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

interface OverviewProps {
  onNavigateToMessages?: (jid: string) => void;
}

export default function OverviewPanel({ onNavigateToMessages }: OverviewProps) {
  const { data: stats, error: statsError } = usePoll<Stats>('/api/stats', 10000);
  const { data: channels, error: channelsError } = usePoll<ChannelStatus[]>('/api/channels', 10000);
  const { data: usage } = usePoll<UsageResponse>('/api/usage', 60000);

  const usageData = usage?.data;

  return (
    <div className="space-y-8">
      {/* Stats */}
      <section>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Status</h2>
        {statsError ? (
          <p className="text-red-400 text-sm">{statsError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Channels Connected" value={stats?.channelsConnected ?? null} />
            <StatCard label="Active Containers" value={stats?.activeContainers ?? null} />
            <StatCard label="IPC Queue Depth" value={stats?.ipcQueueDepth ?? null} />
            <StatCard label="Todos Due Today" value={stats?.todosDueToday ?? null} />
            <LastErrorCard error={stats?.lastError ?? null} />
          </div>
        )}
      </section>

      {/* Usage */}
      {usageData && (usageData.five_hour || usageData.seven_day) && (
        <section>
          <h2 className="text-base font-semibold text-gray-300 mb-3">Claude Usage</h2>
          <div className="grid grid-cols-2 gap-4">
            {usageData.five_hour && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Current session</span>
                  <span className="text-gray-100 font-mono text-sm font-semibold">
                    {Math.round(usageData.five_hour.utilization)}%
                  </span>
                </div>
                <ProgressBar pct={usageData.five_hour.utilization} />
                <p className="text-gray-500 text-xs mt-1.5">Resets {formatReset(usageData.five_hour.resets_at)}</p>
              </div>
            )}
            {usageData.seven_day && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                <div className="flex justify-between items-baseline">
                  <span className="text-gray-400 text-sm">Current week</span>
                  <span className="text-gray-100 font-mono text-sm font-semibold">
                    {Math.round(usageData.seven_day.utilization)}%
                  </span>
                </div>
                <ProgressBar pct={usageData.seven_day.utilization} />
                <p className="text-gray-500 text-xs mt-1.5">Resets {formatReset(usageData.seven_day.resets_at)}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Groups + Containers */}
      <section>
        <GroupsPanel onNavigateToMessages={onNavigateToMessages} />
      </section>

      {/* Channels */}
      <section>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Channels</h2>
        {channelsError ? (
          <p className="text-red-400 text-sm">{channelsError}</p>
        ) : (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {!channels || channels.length === 0 ? (
                  <tr><td colSpan={2} className="px-4 py-3 text-gray-500 text-sm">No channels</td></tr>
                ) : (
                  channels.map((ch) => (
                    <tr key={ch.name} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                      <td className="px-4 py-3 text-gray-100 capitalize">{ch.name}</td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${ch.connected ? 'bg-green-500' : 'bg-red-500'}`} />
                          <span className={ch.connected ? 'text-green-400' : 'text-red-400'}>
                            {ch.connected ? 'Connected' : 'Disconnected'}
                          </span>
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
