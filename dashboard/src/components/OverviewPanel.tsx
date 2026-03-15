import { useEffect, useState } from 'react';

interface Stats {
  channelsConnected: number;
  activeContainers: number;
  ipcQueueDepth: number;
  todosDueToday: number;
  lastError: string | null;
}

interface Group {
  jid: string;
  name: string;
  folder: string;
  isMain: boolean;
  requiresTrigger: boolean;
}

interface ChannelStatus {
  name: string;
  connected: boolean;
}

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
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [url, intervalMs]);
  return { data, error };
}

interface StatCardProps {
  label: string;
  value: string | number | null;
  isError?: boolean;
  fullWidth?: boolean;
}

function StatCard({ label, value, isError, fullWidth }: StatCardProps) {
  return (
    <div
      className={`bg-gray-900 border border-gray-800 rounded-lg p-4 ${fullWidth ? 'col-span-2' : ''}`}
    >
      <div className="text-gray-400 text-sm mb-1">{label}</div>
      <div
        className={`text-2xl font-semibold ${
          isError && value !== null
            ? 'text-red-400'
            : isError && value === null
              ? 'text-gray-500'
              : 'text-gray-100'
        }`}
      >
        {isError ? (value ?? 'None') : (value ?? '—')}
      </div>
    </div>
  );
}

export default function OverviewPanel() {
  const { data: stats, error: statsError } = usePoll<Stats>(
    '/api/stats',
    10000,
  );
  const { data: groups, error: groupsError } = usePoll<Group[]>(
    '/api/groups',
    10000,
  );
  const { data: channels, error: channelsError } = usePoll<ChannelStatus[]>(
    '/api/channels',
    10000,
  );

  return (
    <div className="space-y-8">
      {/* Stats section */}
      <section>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Status</h2>
        {statsError ? (
          <p className="text-red-400 text-sm">{statsError}</p>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <StatCard
              label="Channels Connected"
              value={stats?.channelsConnected ?? null}
            />
            <StatCard
              label="Active Containers"
              value={stats?.activeContainers ?? null}
            />
            <StatCard
              label="IPC Queue Depth"
              value={stats?.ipcQueueDepth ?? null}
            />
            <StatCard
              label="Todos Due Today"
              value={stats?.todosDueToday ?? null}
            />
            <StatCard
              label="Last Error"
              value={stats ? (stats.lastError ?? null) : null}
              isError
              fullWidth
            />
          </div>
        )}
      </section>

      {/* Groups section */}
      <section>
        <h2 className="text-base font-semibold text-gray-300 mb-3">Groups</h2>
        {groupsError ? (
          <p className="text-red-400 text-sm">{groupsError}</p>
        ) : (
          <div className="bg-gray-900 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-800 text-gray-400 text-left">
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">JID</th>
                  <th className="px-4 py-3 font-medium">Folder</th>
                  <th className="px-4 py-3 font-medium">Main</th>
                  <th className="px-4 py-3 font-medium">Trigger</th>
                </tr>
              </thead>
              <tbody>
                {!groups || groups.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className="px-4 py-3 text-gray-500 text-sm"
                    >
                      No groups registered
                    </td>
                  </tr>
                ) : (
                  groups.map((g) => (
                    <tr
                      key={g.jid}
                      className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 text-gray-100">{g.name}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                        {g.jid}
                      </td>
                      <td className="px-4 py-3 text-gray-300">{g.folder}</td>
                      <td className="px-4 py-3 text-gray-300">
                        {g.isMain ? 'Yes' : 'No'}
                      </td>
                      <td className="px-4 py-3 text-gray-300">
                        {g.requiresTrigger ? 'Yes' : 'No'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Channels section */}
      <section>
        <h2 className="text-base font-semibold text-gray-300 mb-3">
          Channels
        </h2>
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
                  <tr>
                    <td
                      colSpan={2}
                      className="px-4 py-3 text-gray-500 text-sm"
                    >
                      No channels
                    </td>
                  </tr>
                ) : (
                  channels.map((ch) => (
                    <tr
                      key={ch.name}
                      className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50"
                    >
                      <td className="px-4 py-3 text-gray-100 capitalize">
                        {ch.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          <span
                            className={`w-2 h-2 rounded-full ${ch.connected ? 'bg-green-500' : 'bg-red-500'}`}
                          />
                          <span
                            className={
                              ch.connected ? 'text-green-400' : 'text-red-400'
                            }
                          >
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
