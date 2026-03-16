import { useEffect, useState } from 'react';

interface UsageData {
  sessionUsage?: string;
  weeklyLimit?: string;
  resetTime?: string;
  raw?: string;
}

interface UsageResponse {
  data: UsageData | null;
  error: string | null;
  fetchedAt: number;
}

export default function UsagePanel() {
  const [response, setResponse] = useState<UsageResponse | null>(null);
  const [loading, setLoading] = useState(false);

  function fetchUsage() {
    setLoading(true);
    fetch('/api/usage')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data: UsageResponse) => setResponse(data))
      .catch((e) =>
        setResponse({ data: null, error: String(e), fetchedAt: Date.now() }),
      )
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchUsage();
  }, []);

  function secondsAgo(ms: number): string {
    const diff = Math.floor((Date.now() - ms) / 1000);
    if (diff < 60) return `${diff}s ago`;
    const mins = Math.floor(diff / 60);
    return `${mins}m ago`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-300">Claude Usage</h2>
        <div className="flex items-center gap-3">
          {response && (
            <span className="text-gray-500 text-xs">
              Last fetched: {secondsAgo(response.fetchedAt)}
            </span>
          )}
          <button
            onClick={fetchUsage}
            disabled={loading}
            className="bg-gray-800 hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed text-gray-300 text-xs px-3 py-1.5 rounded transition-colors"
          >
            {loading ? 'Fetching…' : 'Refresh'}
          </button>
        </div>
      </div>

      {loading && !response && (
        <p className="text-gray-500 text-sm">Loading...</p>
      )}

      {response?.error && (
        <div className="bg-red-900/40 border border-red-700 text-red-300 text-sm rounded px-4 py-3">
          <p className="font-medium mb-1">Error fetching usage</p>
          <p className="font-mono text-xs">{response.error}</p>
          <p className="text-red-400 text-xs mt-2">
            This may mean the claude CLI is not in PATH or does not support the
            /usage command.
          </p>
        </div>
      )}

      {response && !response.error && response.data && (
        <div className="space-y-3">
          {/* Structured fields */}
          {(response.data.sessionUsage ||
            response.data.weeklyLimit ||
            response.data.resetTime) && (
            <div className="bg-gray-900 rounded-lg divide-y divide-gray-800">
              {response.data.sessionUsage && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-400">Session usage</span>
                  <span className="text-gray-100 font-mono">
                    {response.data.sessionUsage}
                  </span>
                </div>
              )}
              {response.data.weeklyLimit && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-400">Weekly limit</span>
                  <span className="text-gray-100 font-mono">
                    {response.data.weeklyLimit}
                  </span>
                </div>
              )}
              {response.data.resetTime && (
                <div className="px-4 py-3 flex justify-between text-sm">
                  <span className="text-gray-400">Resets</span>
                  <span className="text-gray-100 font-mono">
                    {response.data.resetTime}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Raw output */}
          {response.data.raw && (
            <div>
              <p className="text-gray-500 text-xs mb-1">Raw output</p>
              <pre className="bg-gray-800 text-gray-300 text-xs font-mono rounded p-3 overflow-x-auto whitespace-pre-wrap max-h-64 overflow-y-auto">
                {response.data.raw}
              </pre>
            </div>
          )}
        </div>
      )}

      {response && !response.error && !response.data && (
        <p className="text-gray-500 text-sm">No usage data available.</p>
      )}
    </div>
  );
}
