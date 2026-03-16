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

const STATUS_BADGE: Record<TodoStatus, string> = {
  open: 'bg-blue-900 text-blue-300',
  done: 'bg-green-900 text-green-300',
  cancelled: 'bg-gray-800 text-gray-400',
};

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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch('/api/todos');
        if (!res.ok) throw new Error(`${res.status}`);
        const json: TodosData = await res.json();
        setData(json);
        // Default: all project sections expanded
        setExpanded(new Set(json.projects.map((p) => p.code)));
      } catch (e) {
        setError(String(e));
      }
    };
    fetchData();
  }, []);

  if (error) {
    return <p className="text-red-400 text-sm">{error}</p>;
  }

  if (!data) {
    return <p className="text-gray-500 text-sm">Loading...</p>;
  }

  // Client-side filtering
  let filtered = data.items;
  if (!showAll) {
    filtered = filtered.filter((item) => item.status === 'open');
  }
  if (assigneeFilter) {
    filtered = filtered.filter((item) => item.assignee === assigneeFilter);
  }

  // Group by project_code
  const byProject: Record<string, TodoItem[]> = {};
  for (const item of filtered) {
    if (!byProject[item.project_code]) byProject[item.project_code] = [];
    byProject[item.project_code].push(item);
  }

  const toggleAssignee = (a: TodoAssignee) => {
    setAssigneeFilter((prev) => (prev === a ? null : a));
  };

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

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <button
          className={showAll ? activeBtn : inactiveBtn}
          onClick={() => setShowAll((v) => !v)}
        >
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
        data.projects.map((project) => {
          const projectItems = byProject[project.code] ?? [];
          const isOpen = expanded.has(project.code);
          // Separate parents and subtasks
          const parents = projectItems.filter((i) => i.parent_task_id === null);
          const subtaskMap: Record<string, TodoItem[]> = {};
          for (const item of projectItems.filter(
            (i) => i.parent_task_id !== null,
          )) {
            if (!subtaskMap[item.parent_task_id!])
              subtaskMap[item.parent_task_id!] = [];
            subtaskMap[item.parent_task_id!].push(item);
          }

          return (
            <div key={project.code} className="bg-gray-900 rounded-lg overflow-hidden">
              {/* Section header */}
              <button
                className="w-full flex items-center gap-2 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
                onClick={() => toggleExpanded(project.code)}
              >
                {isOpen ? (
                  <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                )}
                <span className="text-gray-200 font-medium text-sm">
                  {project.name}
                </span>
                <span className="ml-2 bg-gray-700 text-gray-300 text-xs px-2 py-0.5 rounded-full">
                  {projectItems.length}
                </span>
              </button>

              {/* Items */}
              {isOpen && (
                <div className="border-t border-gray-800">
                  {parents.length === 0 ? (
                    <p className="px-4 py-3 text-gray-500 text-sm">
                      No items.
                    </p>
                  ) : (
                    parents.map((item) => (
                      <div key={item.task_id}>
                        {/* Parent row */}
                        <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-800/60 last:border-0 hover:bg-gray-800/30 text-sm">
                          <span className="text-gray-500 font-mono text-xs w-20 shrink-0">
                            {item.task_id}
                          </span>
                          <span className="text-gray-100 flex-1 min-w-0 truncate">
                            {item.title}
                          </span>
                          {item.due_date && (
                            <span className="text-gray-400 text-xs shrink-0">
                              {item.due_date}
                            </span>
                          )}
                          <span
                            className={`text-xs px-2 py-0.5 rounded shrink-0 ${ASSIGNEE_BADGE[item.assignee]}`}
                          >
                            {item.assignee}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_BADGE[item.status]}`}
                          >
                            {item.status}
                          </span>
                        </div>
                        {/* Subtasks */}
                        {(subtaskMap[item.task_id] ?? []).map((sub) => (
                          <div
                            key={sub.task_id}
                            className="flex items-center gap-3 pl-10 pr-4 py-2 border-b border-gray-800/40 last:border-0 hover:bg-gray-800/20 text-sm"
                          >
                            <span className="text-gray-600 font-mono text-xs w-20 shrink-0">
                              {sub.task_id}
                            </span>
                            <span className="text-gray-300 flex-1 min-w-0 truncate">
                              {sub.title}
                            </span>
                            {sub.due_date && (
                              <span className="text-gray-400 text-xs shrink-0">
                                {sub.due_date}
                              </span>
                            )}
                            <span
                              className={`text-xs px-2 py-0.5 rounded shrink-0 ${ASSIGNEE_BADGE[sub.assignee]}`}
                            >
                              {sub.assignee}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded shrink-0 ${STATUS_BADGE[sub.status]}`}
                            >
                              {sub.status}
                            </span>
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
