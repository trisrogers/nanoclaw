import React, { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, X } from 'lucide-react';

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

interface Group {
  jid: string;
  name: string;
  folder: string;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '–';
  return new Date(iso).toLocaleString();
}

function truncate(text: string | null, max: number): string {
  if (!text) return '–';
  return text.length > max ? text.slice(0, max) + '…' : text;
}

function StatusBadge({ status }: { status: 'active' | 'paused' | 'completed' }) {
  if (status === 'active') return <span className="text-green-400 text-xs font-medium">active</span>;
  if (status === 'paused') return <span className="text-yellow-400 text-xs font-medium">paused</span>;
  return <span className="text-gray-400 text-xs font-medium">completed</span>;
}

function RunStatusBadge({ status }: { status: 'success' | 'error' }) {
  if (status === 'success') {
    return <span className="bg-green-900 text-green-300 text-xs px-2 py-0.5 rounded-full">success</span>;
  }
  return <span className="bg-red-900 text-red-300 text-xs px-2 py-0.5 rounded-full">error</span>;
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
        <td colSpan={7} className="px-8 py-2 text-gray-500 text-xs">Loading run history...</td>
      </tr>
    );
  }

  if (logs.length === 0) {
    return (
      <tr>
        <td colSpan={7} className="px-8 py-2 text-gray-500 text-xs">No run history yet.</td>
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
            <td className="px-4 py-1.5 text-gray-400 text-xs font-mono">{formatDate(log.run_at)}</td>
            <td className="px-4 py-1.5 text-gray-400 text-xs truncate cursor-default" title={content ?? undefined} colSpan={3}>
              {truncate(content, 120)}
            </td>
            <td className="px-4 py-1.5 text-gray-400 text-xs">{formatDuration(log.duration_ms)}</td>
            <td className="px-4 py-1.5"><RunStatusBadge status={log.status} /></td>
            <td />
          </tr>
        );
      })}
    </>
  );
}

const EMPTY_FORM = {
  prompt: '',
  schedule_type: 'cron',
  schedule_value: '',
  group_folder: '',
  context_mode: 'isolated',
};

type TaskForm = typeof EMPTY_FORM;

function TaskModal({
  groups,
  initial,
  onClose,
  onSave,
}: {
  groups: Group[];
  initial?: Partial<TaskForm> & { id?: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<TaskForm>({
    ...EMPTY_FORM,
    group_folder: groups[0]?.folder ?? '',
    ...initial,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial?.id;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(isEdit ? `/api/tasks/${initial!.id}` : '/api/tasks', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? `${res.status}`);
      }
      onSave();
      onClose();
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  };

  const set = (key: keyof TaskForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-lg mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100">{isEdit ? 'Edit Task' : 'New Task'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Prompt</label>
            <textarea
              rows={3}
              value={form.prompt}
              onChange={(e) => set('prompt', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 resize-none focus:outline-none focus:border-blue-500"
              placeholder="What should the agent do?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Schedule type</label>
              <select
                value={form.schedule_type}
                onChange={(e) => set('schedule_type', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="cron">cron</option>
                <option value="interval">interval (ms)</option>
                <option value="once">once (ISO timestamp)</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">
                {form.schedule_type === 'cron' ? 'Cron expression' : form.schedule_type === 'interval' ? 'Interval (ms)' : 'Run at (ISO)'}
              </label>
              <input
                type="text"
                value={form.schedule_value}
                onChange={(e) => set('schedule_value', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder={form.schedule_type === 'cron' ? '0 9 * * *' : form.schedule_type === 'interval' ? '3600000' : '2026-03-22T09:00:00'}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Group</label>
              <select
                value={form.group_folder}
                onChange={(e) => set('group_folder', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                {groups.filter((g) => g.folder !== 'dashboard').map((g) => (
                  <option key={g.folder} value={g.folder}>{g.name || g.folder}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Context mode</label>
              <select
                value={form.context_mode}
                onChange={(e) => set('context_mode', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="isolated">isolated</option>
                <option value="group">group</option>
              </select>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-4 py-2 hover:text-gray-200">Cancel</button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !form.prompt || !form.schedule_value || !form.group_folder}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create task'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TasksPanel() {
  const [tasks, setTasks] = useState<ScheduledTask[] | null>(null);
  const [groups, setGroups] = useState<Group[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [runsCache, setRunsCache] = useState<Record<string, TaskRunLog[]>>({});
  const [modal, setModal] = useState<{ open: boolean; task?: ScheduledTask }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const loadTasks = () => {
    fetch('/api/tasks')
      .then((r) => {
        if (!r.ok) throw new Error(`${r.status}`);
        return r.json();
      })
      .then((data: ScheduledTask[]) => setTasks(data))
      .catch((e) => setError(String(e)));
  };

  useEffect(() => {
    loadTasks();
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data: Group[]) => setGroups(data))
      .catch(() => {});
  }, []);

  function toggleRow(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  const deleteTask = async (id: string) => {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    loadTasks();
  };

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (tasks === null) return <p className="text-gray-500 text-sm">Loading...</p>;

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
            <col className="w-20" />
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
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {items.map((task) => {
              const isExpanded = expanded.has(task.id);
              return (
                <React.Fragment key={task.id}>
                  <tr className="border-b border-gray-800 last:border-0 hover:bg-gray-800/50 cursor-pointer" onClick={() => toggleRow(task.id)}>
                    <td className="px-4 py-3 text-gray-500">
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </td>
                    <td className="px-4 py-3 text-gray-100">{task.group_folder}</td>
                    <td className="px-4 py-3 text-gray-300 truncate">{task.prompt}</td>
                    <td className="px-4 py-3 text-gray-400 font-mono text-xs">{task.schedule_type} {task.schedule_value}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(task.last_run)}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{formatDate(task.next_run)}</td>
                    <td className="px-4 py-3"><StatusBadge status={task.status} /></td>
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setModal({ open: true, task })}
                          className="text-gray-500 hover:text-blue-400 transition-colors"
                          title="Edit"
                        >
                          <Pencil size={14} />
                        </button>
                        {confirmDelete === task.id ? (
                          <span className="flex gap-1 items-center">
                            <button
                              onClick={() => void deleteTask(task.id)}
                              className="text-red-400 text-xs hover:text-red-300"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmDelete(null)}
                              className="text-gray-500 text-xs hover:text-gray-300"
                            >
                              No
                            </button>
                          </span>
                        ) : (
                          <button
                            onClick={() => setConfirmDelete(task.id)}
                            className="text-gray-500 hover:text-red-400 transition-colors"
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                  {isExpanded && (
                    <RunLogsRow taskId={task.id} runsCache={runsCache} setRunsCache={setRunsCache} />
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
      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold text-gray-300">Scheduled Tasks</h2>
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          <Plus size={15} /> New Task
        </button>
      </div>

      {tasks.length === 0 ? (
        <p className="text-gray-500 text-sm">No scheduled tasks configured.</p>
      ) : (
        grouped.map((group) => (
          <div key={group.status} className="space-y-2">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider px-1">{group.status}</h3>
            {renderTable(group.items)}
          </div>
        ))
      )}

      {modal.open && (
        <TaskModal
          groups={groups}
          initial={modal.task ? {
            id: modal.task.id,
            prompt: modal.task.prompt,
            schedule_type: modal.task.schedule_type,
            schedule_value: modal.task.schedule_value,
            group_folder: modal.task.group_folder,
            context_mode: modal.task.context_mode,
          } : undefined}
          onClose={() => setModal({ open: false })}
          onSave={() => {
            loadTasks();
            setRunsCache({});
          }}
        />
      )}
    </div>
  );
}
