import { useEffect, useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';

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

export default function TodosPanel() {
  const [data, setData] = useState<TodosData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [assigneeFilter, setAssigneeFilter] = useState<TodoAssignee | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  useEffect(() => {
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
    fetchData();
  }, []);

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
      // Update local state
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
      /* silent — optimistic UI not applied */
    } finally {
      setCompleting((prev) => {
        const next = new Set(prev);
        next.delete(item.task_id);
        return next;
      });
    }
  };

  if (error) return <p className="text-red-400 text-sm">{error}</p>;
  if (!data) return <p className="text-gray-500 text-sm">Loading...</p>;

  let filtered = data.items;
  if (!showAll) filtered = filtered.filter((item) => item.status === 'open');
  if (assigneeFilter) filtered = filtered.filter((item) => item.assignee === assigneeFilter);

  // Group by project_code
  const byProject: Record<string, TodoItem[]> = {};
  for (const item of filtered) {
    if (!byProject[item.project_code]) byProject[item.project_code] = [];
    byProject[item.project_code].push(item);
  }

  // Sort projects: those with open items first, empty/all-done at bottom
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
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  };

  const activeBtn = 'bg-blue-600 text-white text-xs px-3 py-1 rounded';
  const inactiveBtn =
    'border border-gray-700 text-gray-400 text-xs px-3 py-1 rounded hover:border-gray-500';

  function renderItem(item: TodoItem) {
    const isDone = item.status === 'done';
    const isLoading = completing.has(item.task_id);
    return (
      <div
        key={item.task_id}
        className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 text-sm"
      >
        <button
          onClick={() => toggleComplete(item)}
          disabled={isLoading}
          className={`shrink-0 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
            isDone
              ? 'bg-green-600 border-green-600'
              : 'border-gray-600 hover:border-gray-400'
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
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button className={showAll ? activeBtn : inactiveBtn} onClick={() => setShowAll((v) => !v)}>
          Show all
        </button>
        <button
          className={assigneeFilter === 'tristan' ? activeBtn : inactiveBtn}
          onClick={() => toggleAssignee('tristan')}
        >
          Tristan
        </button>
        <button
          className={assigneeFilter === 'deltron' ? activeBtn : inactiveBtn}
          onClick={() => toggleAssignee('deltron')}
        >
          Deltron
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
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="text-gray-200 font-medium text-sm">{project.name}</span>
                <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                  {projectItems.length}
                </span>
                {!hasOpen && projectItems.length > 0 && (
                  <span className="ml-1 text-gray-500 text-xs">all done</span>
                )}
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
                          <div key={sub.task_id} className="pl-8">
                            {renderItem(sub)}
                          </div>
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
    </div>
  );
}
