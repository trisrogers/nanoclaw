import { useEffect, useState } from 'react';

interface FiveHour {
  utilization: number;
  resets_at: string;
}

interface SevenDay {
  utilization: number;
  resets_at: string;
}

interface ExtraUsage {
  is_enabled: boolean;
  monthly_limit: number;
  used_credits: number;
  utilization: number;
}

interface UsageData {
  five_hour: FiveHour | null;
  seven_day: SevenDay | null;
  extra_usage: ExtraUsage | null;
}

interface UsageResponse {
  data: UsageData | null;
  error: string | null;
  fetchedAt: number;
}

function ProgressBar({ pct }: { pct: number }) {
  const clamped = Math.min(100, Math.max(0, pct));
  const color =
    clamped >= 90
      ? 'bg-red-500'
      : clamped >= 60
        ? 'bg-yellow-500'
        : 'bg-green-500';
  return (
    <div className="w-full bg-gray-800 rounded-full h-1.5 mt-1.5">
      <div
        className={`${color} h-1.5 rounded-full transition-all`}
        style={{ width: `${clamped}%` }}
      />
    </div>
  );
}

function formatReset(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZoneName: 'short',
    });
  } catch {
    return iso;
  }
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
    return `${Math.floor(diff / 60)}m ago`;
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
          <p className="font-medium mb-1">Error fetching usage</p>
          <p className="font-mono text-xs">{response.error}</p>
        </div>
      )}

      {data && (
        <div className="space-y-4">
          {data.five_hour && (
            <div className="bg-gray-900 rounded-lg px-4 py-3">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-300 text-sm font-medium">
                  Current session
                </span>
                <span className="text-gray-100 font-mono text-sm">
                  {Math.round(data.five_hour.utilization)}% used
                </span>
              </div>
              <ProgressBar pct={data.five_hour.utilization} />
              <p className="text-gray-500 text-xs mt-1.5">
                Resets {formatReset(data.five_hour.resets_at)}
              </p>
            </div>
          )}

          {data.seven_day && (
            <div className="bg-gray-900 rounded-lg px-4 py-3">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-300 text-sm font-medium">
                  Current week (all models)
                </span>
                <span className="text-gray-100 font-mono text-sm">
                  {Math.round(data.seven_day.utilization)}% used
                </span>
              </div>
              <ProgressBar pct={data.seven_day.utilization} />
              <p className="text-gray-500 text-xs mt-1.5">
                Resets {formatReset(data.seven_day.resets_at)}
              </p>
            </div>
          )}

          {data.extra_usage?.is_enabled && (
            <div className="bg-gray-900 rounded-lg px-4 py-3">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-300 text-sm font-medium">
                  Extra usage
                </span>
                <span className="text-gray-100 font-mono text-sm">
                  {Math.round(data.extra_usage.utilization)}% used
                </span>
              </div>
              <ProgressBar pct={data.extra_usage.utilization} />
              <p className="text-gray-500 text-xs mt-1.5">
                ${(data.extra_usage.used_credits / 100).toFixed(2)} / $
                {(data.extra_usage.monthly_limit / 100).toFixed(2)} spent
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
