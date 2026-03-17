import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

interface ScheduledTask {
  id: string;
  group_folder: string;
  chat_jid: string;
  prompt: string;
  schedule_type: string;
  schedule_value: string;
  context_mode: string;
  next_run: string | null;
  last_run: string | null;
  last_result: string | null;
  status: 'active' | 'paused' | 'completed';
  created_at: string;
}

interface TaskRunLog {
  task_id: string;
  run_at: string;
  duration_ms: number;
  status: 'success' | 'error';
  result: string | null;
  error: string | null;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  const d = new Date(iso);
  return d.toLocaleString();
}

function truncate(text: string | null, max: number): string {
  if (!text) return '–';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function StatusBadge({ status }: { status: 'active' | 'paused' | 'completed' }) {
  if (status === 'active') {
    return <span className="text-green-400 text-xs font-medium">active</span>;
  }
  if (status === 'paused') {
    return <span className="text-yellow-400 text-xs font-medium">paused</span>;
  }
  return <span className="text-gray-400 text-xs font-medium">completed</span>;
}

function RunStatusBadge({ status }: { status: 'success' | 'error' }) {
  if (status === 'success') {
    return (
      <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">
        success
      </span>
    );
  }
  return (
    <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full">
      error
    </span>
  );
}

function RunLogsRow({
  taskId,
  runsCache,
  setRunsCache,
}: {
  taskId: string;
  runsCache: Record<string, TaskRunLog[]>;
  setRunsCache: React.Dispatch<React.SetStateAction<Record<string, TaskRunLog[]>>>;
}) {
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (runsCache[taskId] !== undefined) return;
    setLoading(true);
    fetch(`/api/tasks/${taskId}/runs`)
      .then((r) => r.json())
      .then((data: TaskRunLog[]) => {
        setRunsCache((prev) => ({ ...prev, [taskId]: data }));
      })
      .catch(() => {
        setRunsCache((prev) => ({ ...prev, [taskId]: [] }));
      })
      .finally(() => setLoading(false));
  }, [taskId, runsCache, setRunsCache]);

  const logs = runsCache[taskId];

  if (loading || logs === undefined) {
    return (
      <tr>
        <td colSpan={6} className="px-8 py-2 text-gray-500 text-xs">
          Loading run history...
        </td>
      </tr>
    );
  }

  if (logs.length === 0) {
    return (
      <tr>
        <td colSpan={6} className="px-8 py-2 text-gray-500 text-xs">
          No run history yet.
        </td>
      </tr>
    );
  }

  return (
    <>
      {logs.map((log, i) => {
        const content = log.status === 'success' ? log.result : log.error;
        return (
          <tr key={i} className="bg-gray-950 border-b border-gray-800 last:border-0">
            <td className="px-4 py-1.5" />
            <td className="px-4 py-1.5 text-gray-400 text-xs font-mono">
              {formatDate(log.run_at)}
            </td>
            <td
              className="px-4 py-1.5 text-gray-400 text-xs truncate cursor-default"
              title={content ?? undefined}
              colSpan={3}
            >
              {truncate(content, 120)}
            </td>
            <td className="px-4 py-1.5 text-gray-400 text-xs">
              {formatDuration(log.duration_ms)}
            </td>
            <td className="px-4 py-1.5">
              <RunStatusBadge status={log.status} />
            </td>
          </tr>
        );
      })}
    </>
  );
}

export default function TasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runsCache, setRunsCache] = useState<Record<string, TaskRunLog[]>>({});

  useEffect(() => {
    fetch('/api/tasks')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: ScheduledTask[]) => setTasks(data))
      .catch((e) => setError(String(e)));
  }, []);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (tasks === null) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  const STATUS_ORDER: Array<'active' | 'paused' | 'completed'> = ['active', 'paused', 'completed'];
  const grouped = STATUS_ORDER.map((s) => ({
    status: s,
    items: tasks.filter((t) => t.status === s),
  })).filter((g) => g.items.length > 0);

  function renderTable(items: ScheduledTask[]) {
    return (
      <div className="bg-gray-900 rounded-lg overflow-hidden">
        <table className="w-full text-sm table-fixed">
          <colgroup>
            <col className="w-8" />
            <col className="w-32" />
            <col />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-36" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="border-b border-gray-800 text-gray-400 text-left">
              <th className="px-4 py-3 font-medium" />
              <th className="px-4 py-3 font-medium">Group</th>
              <th className="px-4 py-3 font-medium">Prompt</th>
              <th className="px-4 py-3 font-medium">Schedule</th>
              <th className="px-4 py-3 font-medium">Last Run</th>
              <th className="px-4 py-3 font-medium">Next Run</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const isExpanded = expanded.has(task.id);
              return (
                <React.Fragment key={task.id}>
                  <tr
                    className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 cursor-pointer"
                    onClick={() => toggleRow(task.id)}
                  >
                    <td className="px-4 py-3 text-gray-500">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3 text-gray-100">{task.group_folder}</td>
                    <td className="px-4 py-3 text-gray-300 truncate">{task.prompt}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">
                      {task.schedule_type} {task.schedule_value}
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(task.last_run)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(task.next_run)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={task.status} />
                    </td>
                  </tr>
                  {isExpanded && (
                    <RunLogsRow
                      taskId={task.id}
                      runsCache={runsCache}
                      setRunsCache={setRunsCache}
                    />
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold text-gray-300">Scheduled Tasks</h2>
      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm">No scheduled tasks configured.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.status} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">
              {group.status}
            </h3>
            {renderTable(group.items)}
          </div>
        ))
      )}
    </div>
  );
}
