#!/usr/bin/env tsx
/**
 * Task management CLI for Claude Code.
 *
 * Usage:
 *   npx tsx scripts/tasks.ts list [--done]
 *   npx tsx scripts/tasks.ts create "Title" [--assignee tristan|deltron] [--project PRJ] [--priority low|medium|high] [--due YYYY-MM-DD] [--notes "..."]
 *   npx tsx scripts/tasks.ts complete TASK-ID
 *   npx tsx scripts/tasks.ts update TASK-ID [--title "..."] [--priority ...] [--due ...] [--notes "..."] [--assignee ...]
 *   npx tsx scripts/tasks.ts subtask PARENT-ID "Subtask title" [--assignee tristan|deltron]
 */

import { initDatabase } from '../src/db.js';
import {
  completeTodo,
  createSubtask,
  createTodo,
  listTodos,
  listProjects,
  updateTodo,
  type TodoAssignee,
  type TodoPriority,
  type TodoStatus,
} from '../src/todo.js';

initDatabase();

const args = process.argv.slice(2);
const command = args[0];

function getFlag(flag: string): string | undefined {
  const idx = args.indexOf(flag);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

function hasFlag(flag: string): boolean {
  return args.includes(flag);
}

function formatAssignee(assignee: string): string {
  return assignee === 'tristan' ? 'TR' : 'Del';
}

function formatPriority(priority: string | null): string {
  if (!priority) return '';
  const map: Record<string, string> = {
    low: 'LOW',
    medium: 'MED',
    high: 'HIGH',
    critical: 'CRIT',
  };
  return map[priority] ?? priority.toUpperCase();
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  const now = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  // Use dd/mm/yy if more than ~11 months away
  const msPerYear = 365.25 * 24 * 60 * 60 * 1000;
  if (d.getTime() - now.getTime() > 11 * (msPerYear / 12)) {
    const yy = String(d.getFullYear()).slice(2);
    return `${dd}/${mm}/${yy}`;
  }
  return `${dd}/${mm}`;
}

function formatReminder(reminderAt: string | null): string {
  if (!reminderAt) return '';
  const d = new Date(reminderAt);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const HH = String(d.getHours()).padStart(2, '0');
  const MM = String(d.getMinutes()).padStart(2, '0');
  return ` {remind ${dd}/${mm} ${HH}:${MM}}`;
}

function formatTask(t: ReturnType<typeof listTodos>[0]): string {
  const assignee = `[${formatAssignee(t.assignee)}]`;
  const prio = t.priority ? ` ${formatPriority(t.priority)}` : '';
  const due = t.due_date ? ` - ${formatDate(t.due_date)}` : '';
  const remind =
    t.due_date && t.reminder_at ? formatReminder(t.reminder_at) : '';
  const notion = t.notion_id ? ' [N]' : '';
  return `${t.task_id} ${t.title} ${assignee}${prio}${due}${remind}${notion}`;
}

function printItems(items: ReturnType<typeof listTodos>) {
  if (items.length === 0) {
    console.log('No tasks found.');
    return;
  }

  // Group by project
  const byProject = new Map<string, typeof items>();
  for (const item of items) {
    if (item.parent_task_id) continue; // subtasks printed under parent
    const code = item.project_code;
    if (!byProject.has(code)) byProject.set(code, []);
    byProject.get(code)!.push(item);
  }

  // Build subtask lookup
  const subtasks = items.filter((i) => i.parent_task_id !== null);
  const subsByParent = new Map<string, typeof items>();
  for (const sub of subtasks) {
    const p = sub.parent_task_id!;
    if (!subsByParent.has(p)) subsByParent.set(p, []);
    subsByParent.get(p)!.push(sub);
  }

  const projects = listProjects();
  const projectNames = new Map(projects.map((p) => [p.code, p.name]));

  for (const [code, taskList] of byProject.entries()) {
    const name = projectNames.get(code) || code;
    console.log(`\n[${code}] ${name}`);
    for (const t of taskList) {
      console.log(`  • ${formatTask(t)}`);
      const subs = subsByParent.get(t.task_id) || [];
      for (const s of subs) {
        console.log(
          `      └─ ${s.task_id}  ${s.title}  [${formatAssignee(s.assignee)}]`,
        );
      }
    }
  }
  console.log();
}

switch (command) {
  case 'list': {
    const status: TodoStatus = hasFlag('--done') ? 'done' : 'open';
    const assignee = getFlag('--assignee') as TodoAssignee | undefined;
    const items = listTodos({ status, assignee });
    printItems(items);
    break;
  }

  case 'create': {
    const title = args[1];
    if (!title) {
      console.error('Usage: tasks create "Title" [options]');
      process.exit(1);
    }
    const item = createTodo({
      title,
      assignee: (getFlag('--assignee') as TodoAssignee) || 'tristan',
      projectCode: getFlag('--project'),
      priority: getFlag('--priority') as TodoPriority | undefined,
      dueDate: getFlag('--due'),
      reminderAt: getFlag('--reminder-at'),
      notes: getFlag('--notes'),
    });
    console.log(`Created: ${item.task_id}  "${item.title}"`);
    break;
  }

  case 'complete': {
    const taskId = args[1];
    if (!taskId) {
      console.error('Usage: tasks complete TASK-ID');
      process.exit(1);
    }
    completeTodo(taskId);
    console.log(`Completed: ${taskId}`);
    break;
  }

  case 'update': {
    const taskId = args[1];
    if (!taskId) {
      console.error('Usage: tasks update TASK-ID [options]');
      process.exit(1);
    }
    updateTodo(taskId, {
      title: getFlag('--title'),
      assignee: getFlag('--assignee') as TodoAssignee | undefined,
      priority: getFlag('--priority') as TodoPriority | undefined,
      dueDate: getFlag('--due'),
      reminderAt: getFlag('--reminder-at'),
      notes: getFlag('--notes'),
    });
    console.log(`Updated: ${taskId}`);
    break;
  }

  case 'subtask': {
    const parentId = args[1];
    const title = args[2];
    if (!parentId || !title) {
      console.error('Usage: tasks subtask PARENT-ID "Title" [--assignee ...]');
      process.exit(1);
    }
    const sub = createSubtask({
      parentTaskId: parentId,
      title,
      assignee: (getFlag('--assignee') as TodoAssignee) || 'tristan',
    });
    if (sub) {
      console.log(`Created subtask: ${sub.task_id}  "${sub.title}"`);
    } else {
      console.error(`Failed: ${parentId} not found or is already a subtask`);
      process.exit(1);
    }
    break;
  }

  default:
    console.log(`Deltron Task Manager

Commands:
  list [--done] [--assignee tristan|deltron]
  create "Title" [--assignee ...] [--project PRJ] [--priority low|medium|high] [--due YYYY-MM-DD] [--notes "..."]
  complete TASK-ID
  update TASK-ID [--title ...] [--assignee ...] [--priority ...] [--due ...] [--notes ...]
  subtask PARENT-ID "Title" [--assignee ...]
`);
}
