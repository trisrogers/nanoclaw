import { useCallback, useEffect, useState } from 'react';

interface ContainerRow {
  jid: string;
  active: boolean;
  containerName: string | null;
  elapsedMs: number | null;
  groupFolder: string | null;
  groupName: string;
}

function usePoll<T>(url: string, intervalMs: number, refresh: number) {
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
  }, [url, intervalMs, refresh]);
  return { data, error, setData };
}

function formatElapsed(ms: number | null): string {
  if (ms === null) return '–';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function StatusBadge({ active, containerName }: { active: boolean; containerName: string | null }) {
  if (active) {
    return (
      <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">
        Running
      </span>
    );
  }
  if (containerName) {
    return (
      <span className="bg-yellow-900 text-yellow-300 text-xs px-2 py-0.5 rounded-full">
        Idle
      </span>
    );
  }
  return (
    <span className="bg-gray-800 text-gray-500 text-xs px-2 py-0.5 rounded-full">
      Stopped
    </span>
  );
}

function ActionButton({ label, onConfirm }: { label: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  if (confirming) {
    return (
      <span className="flex gap-2">
        <button
          onClick={() => {
            onConfirm();
            setConfirming(false);
          }}
          className="text-red-400 hover:text-red-300 text-xs"
        >
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

export default function ContainersPanel() {
  const [refresh, setRefresh] = useState(0);
  const [toast, setToast] = useState<{ msg: string; isError: boolean } | null>(null);

  const { data: rows, error } = usePoll<ContainerRow[]>('/api/containers', 10000, refresh);

  const showToast = (msg: string, isError: boolean) => {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  };

  const handleAction = useCallback(
    async (folder: string, action: 'clear' | 'restart') => {
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
    },
    [],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-300">Containers</h2>
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
                <th className="px-4 py-3 font-medium">Group</th>
                <th className="px-4 py-3 font-medium">Container</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium">Elapsed</th>
                <th className="px-4 py-3 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {!rows || rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-gray-500 text-sm">
                    No groups with active containers.
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr
                    key={row.jid}
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50"
                  >
                    <td className="px-4 py-3 text-gray-100">{row.groupName}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {row.containerName ?? '–'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge active={row.active} containerName={row.containerName} />
                    </td>
                    <td className="px-4 py-3 text-gray-300">{formatElapsed(row.elapsedMs)}</td>
                    <td className="px-4 py-3">
                      {row.groupFolder && (
                        <span className="flex gap-4">
                          <ActionButton
                            label="Clear Session"
                            onConfirm={() => handleAction(row.groupFolder!, 'clear')}
                          />
                          <ActionButton
                            label="Restart"
                            onConfirm={() => handleAction(row.groupFolder!, 'restart')}
                          />
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
