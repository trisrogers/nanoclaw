import { randomUUID } from 'crypto';

import express, { Router } from 'express';
import { CronExpressionParser } from 'cron-parser';

import {
  getAllTasks,
  getTaskRunLogs,
  createTask,
  updateTask,
  deleteTask,
  getAllRegisteredGroups,
} from '../../db.js';
import { TIMEZONE } from '../../config.js';

function computeInitialNextRun(
  schedule_type: string,
  schedule_value: string,
): string | null {
  if (schedule_type === 'once') {
    // schedule_value is the ISO timestamp for when to run
    return schedule_value || null;
  }
  if (schedule_type === 'cron') {
    const interval = CronExpressionParser.parse(schedule_value, {
      tz: TIMEZONE,
    });
    return interval.next().toISOString();
  }
  if (schedule_type === 'interval') {
    const ms = parseInt(schedule_value, 10);
    if (!ms || ms <= 0) return null;
    return new Date(Date.now() + ms).toISOString();
  }
  return null;
}

export function tasksRouter(): Router {
  const router = Router();
  router.use(express.json());

  router.get('/tasks', (_req, res) => {
    res.json(getAllTasks());
  });

  router.get('/tasks/:id/runs', (req, res) => {
    res.json(getTaskRunLogs(req.params.id));
  });

  router.post('/tasks', (req, res) => {
    const {
      prompt,
      schedule_type,
      schedule_value,
      group_folder,
      context_mode,
    } = req.body as {
      prompt?: string;
      schedule_type?: string;
      schedule_value?: string;
      group_folder?: string;
      context_mode?: string;
    };

    if (!prompt || !schedule_type || !schedule_value || !group_folder) {
      res
        .status(400)
        .json({
          error: 'prompt, schedule_type, schedule_value, group_folder required',
        });
      return;
    }
    if (!['once', 'cron', 'interval'].includes(schedule_type)) {
      res
        .status(400)
        .json({ error: 'schedule_type must be once, cron, or interval' });
      return;
    }

    // Look up the chat_jid for this group_folder
    const groups = getAllRegisteredGroups();
    const entry = Object.entries(groups).find(
      ([, g]) => g.folder === group_folder,
    );
    if (!entry) {
      res.status(404).json({ error: 'Unknown group_folder' });
      return;
    }
    const [chat_jid] = entry;

    const now = new Date().toISOString();
    const next_run = computeInitialNextRun(schedule_type, schedule_value);

    try {
      createTask({
        id: randomUUID(),
        group_folder,
        chat_jid,
        prompt,
        schedule_type: schedule_type as 'once' | 'cron' | 'interval',
        schedule_value,
        context_mode: (context_mode as 'isolated' | 'group') || 'isolated',
        next_run,
        status: 'active',
        created_at: now,
      });
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.put('/tasks/:id', (req, res) => {
    const { id } = req.params;
    const { prompt, schedule_type, schedule_value, status } = req.body as {
      prompt?: string;
      schedule_type?: string;
      schedule_value?: string;
      status?: string;
    };

    const updates: Parameters<typeof updateTask>[1] = {};
    if (prompt !== undefined) updates.prompt = prompt;
    if (status !== undefined)
      updates.status = status as 'active' | 'paused' | 'completed';

    if (schedule_type !== undefined) {
      updates.schedule_type = schedule_type as 'once' | 'cron' | 'interval';
    }
    if (schedule_value !== undefined) {
      updates.schedule_value = schedule_value;
    }

    // Recompute next_run when schedule changes
    if (schedule_type !== undefined || schedule_value !== undefined) {
      const type = schedule_type || '';
      const value = schedule_value || '';
      updates.next_run = computeInitialNextRun(type, value);
    }

    try {
      updateTask(id, updates);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  router.delete('/tasks/:id', (req, res) => {
    try {
      deleteTask(req.params.id);
      res.json({ ok: true });
    } catch (err) {
      res.status(500).json({ error: String(err) });
    }
  });

  return router;
}
