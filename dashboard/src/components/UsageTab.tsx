import { useEffect, useState } from 'react';

interface UsageData {
  five_hour: { utilization: number; resets_at: string } | null;
  seven_day: { utilization: number; resets_at: string } | null;
  extra_usage: { is_enabled: boolean; monthly_limit: number; used_credits: number; utilization: number } | null;
}

interface TokenSummary {
  today: { input: number; output: number; cache_read: number; cache_write: number };
  seven_day: { input: number; output: number; cache_read: number; cache_write: number };
  by_group: Array<{ group_folder: string | null; input: number; output: number }>;
  by_model: Array<{ model: string | null; input: number; output: number }>;
}

function UtilBar({ value, label, resetsAt }: { value: number; label: string; resetsAt?: string }) {
  const pct = Math.round(value);
  const color = pct > 80 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-blue-500';
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs text-gray-400">
        <span>{label}</span>
        <span>{pct}%{resetsAt ? ` · resets ${new Date(resetsAt).toLocaleString()}` : ''}</span>
      </div>
      <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${Math.min(pct, 100)}%` }} />
      </div>
    </div>
  );
}

function fmtK(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

export default function UsageTab() {
  const [apiUsage, setApiUsage] = useState<{ data: UsageData | null; error: string | null } | null>(null);
  const [tokenSummary, setTokenSummary] = useState<TokenSummary | null>(null);
  const [tokenError, setTokenError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/usage').then((r) => r.json()).then(setApiUsage).catch(() => {});
    fetch('/api/token-usage')
      .then((r) => r.json())
      .then(setTokenSummary)
      .catch((e) => setTokenError(String(e)));
  }, []);

  return (
    <div className="space-y-8 max-w-2xl">
      {/* Section 1: Claude API Limits */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-300">Claude API Limits</h2>
        {!apiUsage && <p className="text-gray-500 text-sm">Loading…</p>}
        {apiUsage?.error && <p className="text-red-400 text-sm">{apiUsage.error}</p>}
        {apiUsage?.data && (
          <div className="bg-gray-900 rounded-lg p-4 space-y-4">
            {apiUsage.data.five_hour && (
              <UtilBar value={apiUsage.data.five_hour.utilization} label="5-hour limit" resetsAt={apiUsage.data.five_hour.resets_at} />
            )}
            {apiUsage.data.seven_day && (
              <UtilBar value={apiUsage.data.seven_day.utilization} label="7-day limit" resetsAt={apiUsage.data.seven_day.resets_at} />
            )}
            {apiUsage.data.extra_usage?.is_enabled && (
              <UtilBar value={apiUsage.data.extra_usage.utilization} label={`Extra usage (${fmtK(apiUsage.data.extra_usage.used_credits)} / ${fmtK(apiUsage.data.extra_usage.monthly_limit)} credits)`} />
            )}
          </div>
        )}
      </section>

      {/* Section 2: NanoClaw Token Spend */}
      <section className="space-y-4">
        <h2 className="text-base font-semibold text-gray-300">NanoClaw Token Spend</h2>
        {!tokenSummary && !tokenError && <p className="text-gray-500 text-sm">Loading…</p>}
        {tokenError && <p className="text-red-400 text-sm">{tokenError}</p>}
        {tokenSummary && (
          <div className="space-y-4">
            {/* Today / 7-day totals */}
            <div className="grid grid-cols-2 gap-4">
              {([
                { label: 'Today', data: tokenSummary.today },
                { label: '7-day', data: tokenSummary.seven_day },
              ] as const).map(({ label, data }) => (
                <div key={label} className="bg-gray-900 rounded-lg p-4 space-y-1">
                  <div className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{label}</div>
                  <div className="text-gray-100 text-sm">Input: <span className="font-mono">{fmtK(data.input)}</span></div>
                  <div className="text-gray-100 text-sm">Output: <span className="font-mono">{fmtK(data.output)}</span></div>
                  {data.cache_read > 0 && <div className="text-gray-400 text-xs">Cache read: {fmtK(data.cache_read)}</div>}
                  {data.cache_write > 0 && <div className="text-gray-400 text-xs">Cache write: {fmtK(data.cache_write)}</div>}
                </div>
              ))}
            </div>

            {/* By group */}
            {tokenSummary.by_group.length > 0 && (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">By group (7 days)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="px-4 py-2 text-left font-medium">Group</th>
                      <th className="px-4 py-2 text-right font-medium">Input</th>
                      <th className="px-4 py-2 text-right font-medium">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenSummary.by_group.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/60 last:border-0">
                        <td className="px-4 py-2 text-gray-300">{row.group_folder ?? '(unattributed)'}</td>
                        <td className="px-4 py-2 text-gray-400 text-right font-mono">{fmtK(row.input)}</td>
                        <td className="px-4 py-2 text-gray-400 text-right font-mono">{fmtK(row.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* By model */}
            {tokenSummary.by_model.length > 0 && (
              <div className="bg-gray-900 rounded-lg overflow-hidden">
                <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-800">By model (7 days)</div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-gray-500 text-xs border-b border-gray-800">
                      <th className="px-4 py-2 text-left font-medium">Model</th>
                      <th className="px-4 py-2 text-right font-medium">Input</th>
                      <th className="px-4 py-2 text-right font-medium">Output</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tokenSummary.by_model.map((row, i) => (
                      <tr key={i} className="border-b border-gray-800/60 last:border-0">
                        <td className="px-4 py-2 text-gray-300 font-mono text-xs">{row.model ?? '(unknown)'}</td>
                        <td className="px-4 py-2 text-gray-400 text-right font-mono">{fmtK(row.input)}</td>
                        <td className="px-4 py-2 text-gray-400 text-right font-mono">{fmtK(row.output)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {tokenSummary.by_group.length === 0 && tokenSummary.seven_day.input === 0 && (
              <p className="text-gray-500 text-sm">No token usage recorded yet. Tokens are tracked as NanoClaw agents make API calls.</p>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
