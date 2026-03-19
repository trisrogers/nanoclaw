---
name: task-manager
description: Read and manage the shared task list. Use this proactively — create tasks when you identify work to be done, complete tasks when you finish them, and check the list when context is relevant.
---

# Task Manager

Tasks are stored in a shared SQLite database. Your read-only snapshot is at `/workspace/ipc/todo_snapshot.json`. Write IPC files to the tasks directory to mutate.

## Reading tasks

```bash
cat /workspace/ipc/todo_snapshot.json
```

The snapshot contains `items` (open tasks) and `projects`.

### Task ID format

- Top-level: `PRJ-NNN` e.g. `TSK-001`, `PFR-002`
- Subtasks: `PRJ-NNN-x` e.g. `PFR-002-a`, `PFR-002-b`
- `TSK` = general task, project codes are 3 letters

### Fields

| Field | Values |
|---|---|
| `assignee` | `Tristan` or `Deltron` |
| `status` | `open`, `done`, `cancelled` |
| `priority` | `low`, `medium`, `high` (optional) |
| `due_date` | `YYYY-MM-DD` (optional) |
| `notion_id` | set after pushing to Notion (optional) |

## Creating a task

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_create",
  "title": "Investigate login latency",
  "assignee": "deltron",
  "projectCode": "PFR",
  "projectName": "Performance Refactor",
  "priority": "high",
  "dueDate": "2026-03-20",
  "notes": "Spike seen in prod logs"
}
EOF
```

Required: `title`, `assignee`. All other fields optional.

If you don't know the project, omit `projectCode` (defaults to `TSK`).

## Creating a subtask

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_create_subtask",
  "parentTaskId": "PFR-002",
  "title": "Profile slow queries",
  "assignee": "Deltron"
}
EOF
```

## Completing a task

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_complete",
  "taskId": "TSK-001"
}
EOF
```

## Updating a task

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_update",
  "taskId": "TSK-001",
  "priority": "high",
  "dueDate": "2026-03-25",
  "notes": "Blocking release"
}
EOF
```

Any subset of fields can be updated. Omitted fields are unchanged.

## Pushing a task to Notion

Use the Notion MCP to create a page in Tristan's tasks database, then record the returned page ID:

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_update",
  "taskId": "TSK-001",
  "notionId": "<notion_page_id_from_mcp>"
}
EOF
```

## Pulling a task from Notion

Use the Notion MCP to fetch the page, then create it locally:

```bash
cat > /workspace/ipc/tasks/todo-$(date +%s%N).json << 'EOF'
{
  "type": "todo_create",
  "title": "<title from Notion>",
  "assignee": "tristan",
  "notionId": "<notion_page_id>"
}
EOF
```

## When to use this proactively

**Create a task when:**
- You identify follow-up work that isn't done yet
- Tristan asks you to track something
- You start a multi-step job that warrants tracking
- A scheduled task surfaces a new action item

**Complete a task when:**
- You finish work that was tracked as a task
- Tristan confirms something is done

**Update a task when:**
- Priority or due date changes
- You learn more context worth recording in notes

Do not create a task for every small step — only for meaningful units of work.
