/**
 * Todo / task management for Deltron.
 *
 * ID format:  TSK-001  (project code + zero-padded global sequence)
 * Subtasks:   TSK-001-a, TSK-001-b, ...  (letter suffix, not in global seq)
 */
import fs from 'fs';
import path from 'path';

import { getDb } from './db.js';
import { resolveGroupIpcPath } from './group-folder.js';
import { logger } from './logger.js';
import { TIMEZONE } from './config.js';

export type TodoAssignee = 'tristan' | 'deltron';
export type TodoStatus = 'open' | 'done' | 'cancelled';
export type TodoPriority = 'low' | 'medium' | 'high';

export interface TodoProject {
  code: string;
  name: string;
  created_at: string;
}

export interface TodoItem {
  task_id: string;
  seq_num: number;
  title: string;
  assignee: TodoAssignee;
  status: TodoStatus;
  project_code: string;
  priority: TodoPriority | null;
  due_date: string | null; // YYYY-MM-DD
  reminder_at: string | null; // ISO datetime
  reminder_sent: number; // 0 | 1
  tags: string | null; // JSON array string
  notes: string | null;
  notion_id: string | null;
  parent_task_id: string | null;
  subtask_letter: string | null;
  created_at: string;
  updated_at: string;
}

// ---- Projects ----

export function getOrCreateProject(code: string, name?: string): TodoProject {
  const db = getDb();
  const upper = code.toUpperCase().slice(0, 3);
  const existing = db
    .prepare('SELECT * FROM todo_projects WHERE code = ?')
    .get(upper) as TodoProject | undefined;
  if (existing) return existing;

  const now = new Date().toISOString();
  const projectName = name || upper;
  db.prepare(
    `INSERT INTO todo_projects (code, name, created_at) VALUES (?, ?, ?)`,
  ).run(upper, projectName, now);
  logger.info({ code: upper, name: projectName }, 'Todo project created');
  return { code: upper, name: projectName, created_at: now };
}

export function listProjects(): TodoProject[] {
  return getDb()
    .prepare('SELECT * FROM todo_projects ORDER BY code')
    .all() as TodoProject[];
}

// ---- ID generation ----

function getNextSeqNum(): number {
  const row = getDb()
    .prepare(
      'SELECT MAX(seq_num) as max_seq FROM todo_items WHERE parent_task_id IS NULL',
    )
    .get() as { max_seq: number | null };
  return (row.max_seq ?? 0) + 1;
}

function getNextSubtaskLetter(parentTaskId: string): string {
  const rows = getDb()
    .prepare(
      `SELECT subtask_letter FROM todo_items
       WHERE parent_task_id = ?
       ORDER BY subtask_letter`,
    )
    .all(parentTaskId) as { subtask_letter: string }[];
  if (rows.length === 0) return 'a';
  const last = rows[rows.length - 1].subtask_letter;
  return String.fromCharCode(last.charCodeAt(0) + 1);
}

function formatTaskId(projectCode: string, seqNum: number): string {
  return `${projectCode.toUpperCase()}-${String(seqNum).padStart(3, '0')}`;
}

// ---- Helpers ----

function defaultReminderAt(dueDate: string): string {
  return `${dueDate}T09:00:00`;
}

const INSERT_SQL = `
  INSERT INTO todo_items
    (task_id, seq_num, title, assignee, status, project_code, priority,
     due_date, reminder_at, reminder_sent, tags, notes, notion_id,
     parent_task_id, subtask_letter, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

function insertItem(item: TodoItem): void {
  getDb()
    .prepare(INSERT_SQL)
    .run(
      item.task_id,
      item.seq_num,
      item.title,
      item.assignee,
      item.status,
      item.project_code,
      item.priority,
      item.due_date,
      item.reminder_at,
      item.reminder_sent,
      item.tags,
      item.notes,
      item.notion_id,
      item.parent_task_id,
      item.subtask_letter,
      item.created_at,
      item.updated_at,
    );
}

// ---- CRUD ----

export interface CreateTodoParams {
  title: string;
  assignee: TodoAssignee;
  projectCode?: string;
  projectName?: string;
  priority?: TodoPriority;
  dueDate?: string;
  reminderAt?: string;
  tags?: string[];
  notes?: string;
}

export function createTodo(params: CreateTodoParams): TodoItem {
  const code = (params.projectCode || 'TSK').toUpperCase().slice(0, 3);
  getOrCreateProject(code, params.projectName);

  const now = new Date().toISOString();
  const seqNum = getNextSeqNum();
  const taskId = formatTaskId(code, seqNum);

  const reminderAt =
    params.reminderAt ??
    (params.dueDate ? defaultReminderAt(params.dueDate) : null);

  const item: TodoItem = {
    task_id: taskId,
    seq_num: seqNum,
    title: params.title,
    assignee: params.assignee,
    status: 'open',
    project_code: code,
    priority: params.priority ?? null,
    due_date: params.dueDate ?? null,
    reminder_at: reminderAt,
    reminder_sent: 0,
    tags: params.tags ? JSON.stringify(params.tags) : null,
    notes: params.notes ?? null,
    notion_id: null,
    parent_task_id: null,
    subtask_letter: null,
    created_at: now,
    updated_at: now,
  };

  insertItem(item);
  logger.info(
    { taskId, assignee: params.assignee, project: code },
    'Todo created',
  );
  return item;
}

export interface CreateSubtaskParams {
  parentTaskId: string;
  title: string;
  assignee: TodoAssignee;
}

export function createSubtask(params: CreateSubtaskParams): TodoItem | null {
  const parent = getTodo(params.parentTaskId);
  if (!parent || parent.parent_task_id !== null) {
    logger.warn(
      { parentTaskId: params.parentTaskId },
      'Invalid parent for subtask',
    );
    return null;
  }

  const now = new Date().toISOString();
  const letter = getNextSubtaskLetter(params.parentTaskId);
  const taskId = `${params.parentTaskId}-${letter}`;

  const item: TodoItem = {
    task_id: taskId,
    seq_num: 0,
    title: params.title,
    assignee: params.assignee,
    status: 'open',
    project_code: parent.project_code,
    priority: null,
    due_date: null,
    reminder_at: null,
    reminder_sent: 0,
    tags: null,
    notes: null,
    notion_id: null,
    parent_task_id: params.parentTaskId,
    subtask_letter: letter,
    created_at: now,
    updated_at: now,
  };

  insertItem(item);
  logger.info({ taskId, parentTaskId: params.parentTaskId }, 'Subtask created');
  return item;
}

export function getTodo(taskId: string): TodoItem | undefined {
  return getDb()
    .prepare('SELECT * FROM todo_items WHERE task_id = ?')
    .get(taskId) as TodoItem | undefined;
}

export function listTodos(filter?: {
  status?: TodoStatus;
  assignee?: TodoAssignee;
}): TodoItem[] {
  let sql = 'SELECT * FROM todo_items WHERE 1=1';
  const params: string[] = [];

  if (filter?.status) {
    sql += ' AND status = ?';
    params.push(filter.status);
  }
  if (filter?.assignee) {
    sql += ' AND assignee = ?';
    params.push(filter.assignee);
  }

  sql += ' ORDER BY project_code, seq_num, subtask_letter';
  return getDb()
    .prepare(sql)
    .all(...params) as TodoItem[];
}

export interface UpdateTodoParams {
  title?: string;
  assignee?: TodoAssignee;
  status?: TodoStatus;
  priority?: TodoPriority | null;
  dueDate?: string | null;
  reminderAt?: string | null;
  tags?: string[] | null;
  notes?: string | null;
  notionId?: string | null;
}

export function updateTodo(taskId: string, updates: UpdateTodoParams): void {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const values: unknown[] = [now];

  if (updates.title !== undefined) {
    fields.push('title = ?');
    values.push(updates.title);
  }
  if (updates.assignee !== undefined) {
    fields.push('assignee = ?');
    values.push(updates.assignee);
  }
  if (updates.status !== undefined) {
    fields.push('status = ?');
    values.push(updates.status);
  }
  if (updates.priority !== undefined) {
    fields.push('priority = ?');
    values.push(updates.priority);
  }
  if (updates.dueDate !== undefined) {
    fields.push('due_date = ?');
    values.push(updates.dueDate);
    // Reset reminder when due date changes (unless explicitly provided)
    if (updates.reminderAt === undefined) {
      fields.push('reminder_at = ?');
      values.push(updates.dueDate ? defaultReminderAt(updates.dueDate) : null);
      fields.push('reminder_sent = 0');
    }
  }
  if (updates.reminderAt !== undefined) {
    fields.push('reminder_at = ?');
    values.push(updates.reminderAt);
  }
  if (updates.tags !== undefined) {
    fields.push('tags = ?');
    values.push(updates.tags ? JSON.stringify(updates.tags) : null);
  }
  if (updates.notes !== undefined) {
    fields.push('notes = ?');
    values.push(updates.notes);
  }
  if (updates.notionId !== undefined) {
    fields.push('notion_id = ?');
    values.push(updates.notionId);
  }

  if (fields.length === 1) return; // nothing to update besides timestamp

  values.push(taskId);
  getDb()
    .prepare(`UPDATE todo_items SET ${fields.join(', ')} WHERE task_id = ?`)
    .run(...values);
  logger.info({ taskId }, 'Todo updated');
}

export function completeTodo(taskId: string): void {
  updateTodo(taskId, { status: 'done' });
}

// ---- Reminders ----

export function getDueReminders(): TodoItem[] {
  const today = new Date().toLocaleDateString('sv', { timeZone: TIMEZONE });
  const now = new Date()
    .toLocaleString('sv', { timeZone: TIMEZONE })
    .replace(' ', 'T');
  return getDb()
    .prepare(
      `SELECT * FROM todo_items
       WHERE status = 'open'
         AND assignee = 'tristan'
         AND due_date = ?
         AND reminder_sent = 0
         AND reminder_at <= ?
         AND parent_task_id IS NULL`,
    )
    .all(today, now) as TodoItem[];
}

export function getDeltronReminders(): TodoItem[] {
  const today = new Date().toLocaleDateString('sv', { timeZone: TIMEZONE });
  const now = new Date()
    .toLocaleString('sv', { timeZone: TIMEZONE })
    .replace(' ', 'T');
  return getDb()
    .prepare(
      `SELECT * FROM todo_items
       WHERE status = 'open'
         AND assignee = 'deltron'
         AND due_date = ?
         AND reminder_sent = 0
         AND reminder_at <= ?
         AND parent_task_id IS NULL`,
    )
    .all(today, now) as TodoItem[];
}

export function markReminderSent(taskId: string): void {
  getDb()
    .prepare('UPDATE todo_items SET reminder_sent = 1 WHERE task_id = ?')
    .run(taskId);
}

// ---- Notion sync ----

const NOTION_DONE_NAMES = new Set([
  'done',
  'complete',
  'completed',
  'closed',
  'finished',
]);

function isNotionPageDone(props: Record<string, unknown>): boolean {
  for (const prop of Object.values(props)) {
    const p = prop as Record<string, unknown>;
    if (p.type === 'status' && p.status) {
      const name = (p.status as { name: string }).name?.toLowerCase();
      if (NOTION_DONE_NAMES.has(name)) return true;
    }
    if (p.type === 'checkbox' && p.checkbox === true) return true;
    if (p.type === 'select' && p.select) {
      const name = (p.select as { name: string }).name?.toLowerCase();
      if (NOTION_DONE_NAMES.has(name)) return true;
    }
  }
  return false;
}

/**
 * Pull completion status from Notion for any open todos that have a notion_id.
 * Marks them done locally if Notion shows them as complete/archived.
 * Call periodically from the scheduler to keep the two systems in sync.
 */
export async function syncNotionStatuses(): Promise<void> {
  const notionKey = process.env.NOTION_API_KEY;
  if (!notionKey) return;

  const items = getDb()
    .prepare(
      `SELECT task_id, notion_id FROM todo_items
       WHERE notion_id IS NOT NULL AND status = 'open'`,
    )
    .all() as { task_id: string; notion_id: string }[];

  if (items.length === 0) return;

  for (const item of items) {
    try {
      const res = await fetch(
        `https://api.notion.com/v1/pages/${item.notion_id}`,
        {
          headers: {
            Authorization: `Bearer ${notionKey}`,
            'Notion-Version': '2022-06-28',
          },
        },
      );
      if (!res.ok) continue;

      const page = (await res.json()) as Record<string, unknown>;

      if (page.archived === true) {
        completeTodo(item.task_id);
        logger.info(
          { taskId: item.task_id },
          'Notion sync: marked done (archived)',
        );
        continue;
      }

      const props = page.properties as Record<string, unknown> | undefined;
      if (props && isNotionPageDone(props)) {
        completeTodo(item.task_id);
        logger.info({ taskId: item.task_id }, 'Notion sync: marked done');
      }
    } catch (err) {
      logger.warn(
        { taskId: item.task_id, err },
        'Notion sync: error fetching page',
      );
    }
  }
}

/**
 * Write the open-tasks snapshot for a group's IPC directory.
 * Called before container runs AND after IPC mutations so the snapshot stays current.
 */
export function writeTodoSnapshot(groupFolder: string): void {
  const ipcDir = resolveGroupIpcPath(groupFolder);
  fs.mkdirSync(ipcDir, { recursive: true });

  const items = listTodos({ status: 'open' });
  const projects = listProjects();

  fs.writeFileSync(
    path.join(ipcDir, 'todo_snapshot.json'),
    JSON.stringify(
      { items, projects, lastSync: new Date().toISOString() },
      null,
      2,
    ),
  );
}

export function formatReminderMessage(items: TodoItem[]): string {
  if (items.length === 1) {
    const t = items[0];
    const prio = t.priority ? ` (${t.priority})` : '';
    return `⏰ *Reminder:* ${t.task_id} "${t.title}" is due today${prio}`;
  }
  const lines = ['⏰ *Tasks due today:*'];
  for (const t of items) {
    const prio = t.priority ? ` (${t.priority})` : '';
    lines.push(`• ${t.task_id} ${t.title}${prio}`);
  }
  return lines.join('\n');
}
