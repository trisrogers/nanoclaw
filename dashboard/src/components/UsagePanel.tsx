import { useEffect, useState } from 'react';

interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadInputTokens: number;
  cacheCreationInputTokens: number;
  webSearchRequests: number;
}

interface DailyActivity {
  date: string;
  messageCount: number;
  sessionCount: number;
  toolCallCount: number;
}

interface UsageData {
  lastComputedDate: string | null;
  modelUsage: Record<string, ModelUsage>;
  recentActivity: DailyActivity[];
  totalSessions: number;
  totalMessages: number;
  firstSessionDate: string | null;
}

interface UsageResponse {
  data: UsageData | null;
  error: string | null;
  fetchedAt: number;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
}

function shortModel(model: string): string {
  return model
    .replace('claude-', '')
    .replace(/-\d{8}$/, '')
    .replace(/-20\d{6}$/, '');
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

  const data = response?.data;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-300">Claude Usage</h2>
        <div className="flex items-center gap-3">
          {response && (
            <span className="text-gray-500 text-xs">
              {secondsAgo(response.fetchedAt)}
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
          <p className="font-medium mb-1">Error reading usage stats</p>
          <p className="font-mono text-xs">{response.error}</p>
        </div>
      )}

      {data && (
        <>
          {/* Totals */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: 'Sessions', value: data.totalSessions.toLocaleString() },
              { label: 'Messages', value: data.totalMessages.toLocaleString() },
              {
                label: 'Since',
                value: data.firstSessionDate
                  ? new Date(data.firstSessionDate).toLocaleDateString(
                      undefined,
                      { month: 'short', year: 'numeric' },
                    )
                  : '—',
              },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900 rounded-lg px-4 py-3">
                <p className="text-gray-500 text-xs mb-1">{label}</p>
                <p className="text-gray-100 font-mono text-sm">{value}</p>
              </div>
            ))}
          </div>

          {/* Model token breakdown */}
          {Object.keys(data.modelUsage).length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">
                Token usage by model
                {data.lastComputedDate && (
                  <span className="ml-2 text-gray-600">
                    (computed {data.lastComputedDate})
                  </span>
                )}
              </p>
              <div className="bg-gray-900 rounded-lg divide-y divide-gray-800 overflow-x-auto">
                <div className="grid grid-cols-5 px-4 py-2 text-xs text-gray-500">
                  <span>Model</span>
                  <span className="text-right">Input</span>
                  <span className="text-right">Output</span>
                  <span className="text-right">Cache read</span>
                  <span className="text-right">Cache write</span>
                </div>
                {Object.entries(data.modelUsage).map(([model, usage]) => (
                  <div
                    key={model}
                    className="grid grid-cols-5 px-4 py-2.5 text-xs"
                  >
                    <span className="text-gray-300 font-mono truncate pr-2">
                      {shortModel(model)}
                    </span>
                    <span className="text-gray-100 font-mono text-right">
                      {fmt(usage.inputTokens)}
                    </span>
                    <span className="text-gray-100 font-mono text-right">
                      {fmt(usage.outputTokens)}
                    </span>
                    <span className="text-gray-400 font-mono text-right">
                      {fmt(usage.cacheReadInputTokens)}
                    </span>
                    <span className="text-gray-400 font-mono text-right">
                      {fmt(usage.cacheCreationInputTokens)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity */}
          {data.recentActivity.length > 0 && (
            <div>
              <p className="text-gray-500 text-xs mb-2">Recent activity</p>
              <div className="bg-gray-900 rounded-lg divide-y divide-gray-800">
                <div className="grid grid-cols-4 px-4 py-2 text-xs text-gray-500">
                  <span>Date</span>
                  <span className="text-right">Messages</span>
                  <span className="text-right">Sessions</span>
                  <span className="text-right">Tool calls</span>
                </div>
                {data.recentActivity.map((day) => (
                  <div
                    key={day.date}
                    className="grid grid-cols-4 px-4 py-2 text-xs"
                  >
                    <span className="text-gray-400 font-mono">{day.date}</span>
                    <span className="text-gray-100 font-mono text-right">
                      {day.messageCount.toLocaleString()}
                    </span>
                    <span className="text-gray-100 font-mono text-right">
                      {day.sessionCount}
                    </span>
                    <span className="text-gray-400 font-mono text-right">
                      {day.toolCallCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
