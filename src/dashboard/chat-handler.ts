import { randomUUID } from 'crypto';

import WebSocket from 'ws';

import { DashboardDeps } from './types.js';

const DASHBOARD_JID = 'web:dashboard';

export function createChatHandler(deps: DashboardDeps) {
  return function handleConnection(ws: WebSocket): void {
    deps.webDashboardChannel.addClient(ws);

    ws.on('message', (raw) => {
      let parsed: { text?: string };
      try {
        parsed = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const text = parsed.text?.trim();
      if (!text) return;

      // Store user message in SQLite so processGroupMessages can find it
      deps.storeMessage({
        id: randomUUID(),
        chat_jid: DASHBOARD_JID,
        sender: 'user',
        sender_name: 'User',
        content: text,
        timestamp: new Date().toISOString(),
        is_from_me: true,
      });

      // Trigger agent pipeline
      deps.enqueueMessageCheck(DASHBOARD_JID);
    });

    ws.on('close', () => {
      deps.webDashboardChannel.removeClient(ws);
    });
  };
}
