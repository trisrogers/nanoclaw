import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight, Pencil, Trash2, Plus, X } from 'lucide-react';

type TodoAssignee = 'tristan' | 'deltron';
type TodoStatus = 'open' | 'done' | 'cancelled';
type TodoPriority = 'low' | 'medium' | 'high';

interface TodoProject {
  code: string;
  name: string;
  created_at: string;
}

interface TodoItem {
  task_id: string;
  seq_num: number;
  title: string;
  assignee: TodoAssignee;
  status: TodoStatus;
  project_code: string;
  priority: TodoPriority | null;
  due_date: string | null;
  reminder_at: string | null;
  reminder_sent: number;
  tags: string | null;
  notes: string | null;
  notion_id: string | null;
  parent_task_id: string | null;
  subtask_letter: string | null;
  created_at: string;
  updated_at: string;
}

interface TodosData {
  items: TodoItem[];
  projects: TodoProject[];
}

const ASSIGNEE_BADGE: Record<TodoAssignee, string> = {
  tristan: 'bg-purple-900 text-purple-300',
  deltron: 'bg-orange-900 text-orange-300',
};

const EMPTY_FORM = {
  title: '',
  assignee: 'tristan' as TodoAssignee,
  projectCode: 'TSK',
  priority: '' as TodoPriority | '',
  dueDate: '',
  notes: '',
};

type TodoForm = typeof EMPTY_FORM;

function TodoModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Partial<TodoForm> & { id?: string };
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState<TodoForm>({ ...EMPTY_FORM, ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!initial?.id;

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const body = {
        title: form.title,
        assignee: form.assignee,
        projectCode: form.projectCode || 'TSK',
        priority: form.priority || undefined,
        dueDate: form.dueDate || undefined,
        notes: form.notes || undefined,
      };
      const res = await fetch(isEdit ? `/api/todos/${initial!.id}` : '/api/todos', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
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

  const set = <K extends keyof TodoForm>(key: K, value: TodoForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-gray-900 border border-gray-700 rounded-xl w-full max-w-md mx-4 p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-gray-100">{isEdit ? 'Edit Todo' : 'New Todo'}</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300"><X size={18} /></button>
        </div>

        {error && <div className="text-red-400 text-sm bg-red-900/30 border border-red-700 rounded px-3 py-2">{error}</div>}

        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-400 mb-1 block">Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              placeholder="What needs to be done?"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Assignee</label>
              <select
                value={form.assignee}
                onChange={(e) => set('assignee', e.target.value as TodoAssignee)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="tristan">tristan</option>
                <option value="deltron">deltron</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Project code</label>
              <input
                type="text"
                value={form.projectCode}
                onChange={(e) => set('projectCode', e.target.value.toUpperCase().slice(0, 3))}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
                placeholder="TSK"
                maxLength={3}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Priority</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value as TodoPriority | '')}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              >
                <option value="">–</option>
                <option value="low">low</option>
                <option value="medium">medium</option>
                <option value="high">high</option>
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Due date</label>
              <input
                type="date"
                value={form.dueDate}
                onChange={(e) => set('dueDate', e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-gray-400 mb-1 block">Notes</label>
            <textarea
              rows={2}
              value={form.notes}
              onChange={(e) => set('notes', e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 text-gray-100 text-sm rounded px-3 py-2 resize-none focus:outline-none focus:border-blue-500"
              placeholder="Optional notes…"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onClose} className="text-gray-400 text-sm px-4 py-2 hover:text-gray-200">Cancel</button>
          <button
            onClick={() => void handleSave()}
            disabled={saving || !form.title}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
          >
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TodosPanel() {
  const [data, setData] = useState<TodosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<TodoAssignee | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<{ open: boolean; item?: TodoItem }>({ open: false });
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const res = await fetch('/api/todos');
      if (!res.ok) throw new Error(`${res.status}`);
      const json: TodosData = await res.json();
      setData(json);
      setExpanded(new Set(json.projects.map((p) => p.code)));
    } catch (e) {
      setError(String(e));
    }
  };

  useEffect(() => {
    void fetchData();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleComplete = async (item: TodoItem) => {
    const newStatus: TodoStatus = item.status === 'done' ? 'open' : 'done';
    setCompleting((prev) => new Set(prev).add(item.task_id));
    try {
      const res = await fetch(`/api/todos/${item.task_id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error(`${res.status}`);
      setData((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          items: prev.items.map((i) =>
            i.task_id === item.task_id ? { ...i, status: newStatus } : i,
          ),
        };
      });
    } catch {
      /* silent */
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(item.task_id);
        return next;
      });
    }
  };

  const deleteTodo = async (id: string) => {
    await fetch(`/api/todos/${id}`, { method: 'DELETE' });
    setConfirmDelete(null);
    void fetchData();
  };

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading...</p>;

  let filtered = data.items;
  if (!showAll) filtered = filtered.filter((item) => item.status === 'open');
  if (assigneeFilter) filtered = filtered.filter((item) => item.assignee === assigneeFilter);

  const byProject: Record<string, TodoItem[]> = {};
  for (const item of filtered) {
    if (!byProject[item.project_code]) byProject[item.project_code] = [];
    byProject[item.project_code].push(item);
  }

  const sortedProjects = [...data.projects].sort((a, b) => {
    const aHasOpen = (byProject[a.code] ?? []).some((i) => i.status === 'open');
    const bHasOpen = (byProject[b.code] ?? []).some((i) => i.status === 'open');
    if (aHasOpen && !bHasOpen) return -1;
    if (!aHasOpen && bHasOpen) return 1;
    return 0;
  });

  const toggleAssignee = (a: TodoAssignee) =>
    setAssigneeFilter((prev) => (prev === a ? null : a));

  const toggleExpanded = (code: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const activeBtn = 'bg-blue-600 text-white text-xs px-3 py-1 rounded';
  const inactiveBtn = 'border border-gray-700 text-gray-400 text-xs px-3 py-1 rounded hover:border-gray-500';

  function renderItem(item: TodoItem) {
    const isDone = item.status === 'done';
    const isLoading = completing.has(item.task_id);
    return (
      <div
        key={item.task_id}
        className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 text-sm group"
      >
        <button
          onClick={() => void toggleComplete(item)}
          disabled={isLoading}
          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            isDone ? 'bg-green-600 border-green-600' : 'border-gray-600 hover:border-gray-400'
          } disabled:opacity-40`}
          aria-label={isDone ? 'Mark open' : 'Mark done'}
        >
          {isDone && (
            <svg className="w-3 h-3 text-white" viewBox="0 0 12 12" fill="none">
              <path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </button>
        <span className="text-gray-500 font-mono text-xs w-20 shrink-0">{item.task_id}</span>
        <span className={`flex-1 min-w-0 truncate ${isDone ? 'line-through text-gray-500' : 'text-gray-100'}`}>
          {item.title}
        </span>
        {item.due_date && (
          <span className="text-gray-400 text-xs shrink-0">{item.due_date}</span>
        )}
        <span className={`text-xs px-2 py-0.5 rounded shrink-0 ${ASSIGNEE_BADGE[item.assignee]}`}>
          {item.assignee}
        </span>
        {/* Action buttons (visible on hover) */}
        <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
          <button
            onClick={() => setModal({ open: true, item })}
            className="text-gray-500 hover:text-blue-400 transition-colors"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          {confirmDelete === item.task_id ? (
            <span className="flex gap-1 items-center">
              <button onClick={() => void deleteTodo(item.task_id)} className="text-red-400 text-xs hover:text-red-300">Yes</button>
              <button onClick={() => setConfirmDelete(null)} className="text-gray-500 text-xs hover:text-gray-300">No</button>
            </span>
          ) : (
            <button
              onClick={() => setConfirmDelete(item.task_id)}
              className="text-gray-500 hover:text-red-400 transition-colors"
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button className={showAll ? activeBtn : inactiveBtn} onClick={() => setShowAll((v) => !v)}>Show all</button>
        <button className={assigneeFilter === 'tristan' ? activeBtn : inactiveBtn} onClick={() => toggleAssignee('tristan')}>Tristan</button>
        <button className={assigneeFilter === 'deltron' ? activeBtn : inactiveBtn} onClick={() => toggleAssignee('deltron')}>Deltron</button>
        <div className="flex-1" />
        <button
          onClick={() => setModal({ open: true })}
          className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        >
          <Plus size={13} /> New Todo
        </button>
      </div>

      {/* Project sections */}
      {data.projects.length === 0 ? (
        <p className="text-gray-500 text-sm">No todo items.</p>
      ) : (
        sortedProjects.map((project) => {
          const projectItems = byProject[project.code] ?? [];
          const isOpen = expanded.has(project.code);
          const hasOpen = projectItems.some((i) => i.status === 'open');
          const parents = projectItems.filter((i) => i.parent_task_id === null);
          const subtaskMap: Record<string, TodoItem[]> = {};
          for (const item of projectItems.filter((i) => i.parent_task_id !== null)) {
            if (!subtaskMap[item.parent_task_id!]) subtaskMap[item.parent_task_id!] = [];
            subtaskMap[item.parent_task_id!].push(item);
          }

          return (
            <div key={project.code} className={`bg-gray-900 rounded-lg overflow-hidden ${!hasOpen ? 'opacity-60' : ''}`}>
              <button
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
                onClick={() => toggleExpanded(project.code)}
              >
                {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                <span className="text-gray-200 font-medium text-sm">{project.name}</span>
                <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">{projectItems.length}</span>
                {!hasOpen && projectItems.length > 0 && <span className="ml-1 text-gray-500 text-xs">all done</span>}
              </button>

              {isOpen && (
                <div className="border-t border-gray-800">
                  {parents.length === 0 ? (
                    <p className="px-4 py-3 text-gray-500 text-sm">No items.</p>
                  ) : (
                    parents.map((item) => (
                      <div key={item.task_id}>
                        {renderItem(item)}
                        {(subtaskMap[item.task_id] ?? []).map((sub) => (
                          <div key={sub.task_id} className="pl-8">{renderItem(sub)}</div>
                        ))}
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {modal.open && (
        <TodoModal
          initial={modal.item ? {
            id: modal.item.task_id,
            title: modal.item.title,
            assignee: modal.item.assignee,
            projectCode: modal.item.project_code,
            priority: modal.item.priority ?? '',
            dueDate: modal.item.due_date ?? '',
            notes: modal.item.notes ?? '',
          } : undefined}
          onClose={() => setModal({ open: false })}
          onSave={() => void fetchData()}
        />
      )}
    </div>
  );
}
