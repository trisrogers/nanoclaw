import { useCallback, useEffect, useState } from 'react';
import { MessageSquare } from 'lucide-react';

interface Group {
  jid: string;
  name: string;
  folder: string;
  isMain: boolean;
  requiresTrigger: boolean;
}

interface ContainerRow {
  jid: string;
  active: boolean;
  containerName: string | null;
  elapsedMs: number | null;
  groupFolder: string | null;
  groupName: string;
}

interface Props {
  onNavigateToMessages?: (jid: string) => void;
}

function usePoll<T>(url: string, intervalMs: number, refresh = 0) {
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
  }, [url, intervalMs, refresh]);
  return { data, error };
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return '–';
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  if (m === 0) return `${s}s`;
  return `${m}m ${s % 60}s`;
}

function ContainerBadge({ active, containerName }: { active: boolean; containerName: string | null }) {
  if (active) return <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">Running</span>;
  if (containerName) return <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded-full">Idle</span>;
  return <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 rounded-full">–</span>;
}

function ActionButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex gap-2">
        <button onClick={() => { onConfirm(); setConfirming(false); }} className="text-red-400 hover:text-red-300 text-xs">
          Confirm?
        </button>
        <button onClick={() => setConfirming(false)} className="text-gray-500 hover:text-gray-300 text-xs">
          Cancel
        </button>
      </span>
    );
  }
  return (
    <button onClick={() => setConfirming(true)} className="text-gray-400 hover:text-gray-200 text-xs">
      {label}
    </button>
  );
}

export default function GroupsPanel({ onNavigateToMessages }: Props) {
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const { data: groups, error: groupsError } = usePoll<Group[]>('/api/groups', 15000, refresh);
  const { data: containers, error: containersError } = usePoll<ContainerRow[]>('/api/containers', 10000, refresh);

  // Build a lookup: jid → container info
  const containerByJid: Record<string, ContainerRow> = {};
  if (containers) {
    for (const c of containers) containerByJid[c.jid] = c;
  }

  const showToast = (msg: string, isError: boolean) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = useCallback(async (folder: string, action: 'clear' | 'restart') => {
    try {
      const res = await fetch(`/api/containers/${folder}/${action}`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        showToast(body.error ?? `Error ${res.status}`, true);
        return;
      }
      showToast(action === 'clear' ? 'Session cleared' : 'Restart signalled', false);
      setRefresh((r) => r + 1);
    } catch (e) {
      showToast(String(e), true);
    }
  }, []);

  const error = groupsError || containersError;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-300">Groups</h2>
        {toast && (
          <span className={toast.isError ? 'text-red-400 text-xs' : 'text-green-400 text-xs'}>
            {toast.msg}
          </span>
        )}
      </div>

      {error ? (
        <p className="text-red-400 text-sm">{error}</p>
      ) : (
        <div className="bg-gray-900 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-800 text-gray-400 text-left">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Folder</th>
                <th className="px-4 py-3 font-medium">Main</th>
                <th className="px-4 py-3 font-medium">Container</th>
                <th className="px-4 py-3 font-medium">Elapsed</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!groups || groups.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-3 text-gray-500 text-sm">No groups registered</td>
                </tr>
              ) : (
                groups.map((g) => {
                  const c = containerByJid[g.jid];
                  return (
                    <tr key={g.jid} className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50">
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-2">
                          {onNavigateToMessages ? (
                            <button
                              onClick={() => onNavigateToMessages(g.jid)}
                              className="text-gray-100 hover:text-blue-400 transition-colors flex items-center gap-1.5"
                              title="View messages"
                            >
                              {g.name}
                              <MessageSquare size={12} className="text-gray-500" />
                            </button>
                          ) : (
                            <span className="text-gray-100">{g.name}</span>
                          )}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-300">{g.folder}</td>
                      <td className="px-4 py-3 text-gray-400 text-xs">{g.isMain ? 'Yes' : '–'}</td>
                      <td className="px-4 py-3">
                        <ContainerBadge active={c?.active ?? false} containerName={c?.containerName ?? null} />
                      </td>
                      <td className="px-4 py-3 text-gray-400 text-xs">
                        {formatElapsed(c?.elapsedMs ?? null)}
                      </td>
                      <td className="px-4 py-3">
                        {g.folder && g.folder !== 'dashboard' && (
                          <span className="flex gap-4">
                            <ActionButton label="Clear Session" onConfirm={() => handleAction(g.folder, 'clear')} />
                            <ActionButton label="Restart" onConfirm={() => handleAction(g.folder, 'restart')} />
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
