import WebSocket from 'ws';

import { Channel } from '../types.js';

export class WebDashboardChannel implements Channel {
  name = 'web-dashboard';
  private wsClients = new Set<WebSocket>();

  ownsJid(jid: string): boolean {
    return jid === 'web:dashboard';
  }

  async sendMessage(_jid: string, text: string): Promise<void> {
    const frame = JSON.stringify({ type: 'message', text });
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
  }

  async setTyping(_jid: string, isTyping: boolean): Promise<void> {
    const frame = JSON.stringify({ type: 'typing', value: isTyping });
    for (const ws of this.wsClients) {
      if (ws.readyState === WebSocket.OPEN) ws.send(frame);
    }
  }

  addClient(ws: WebSocket): void {
    this.wsClients.add(ws);
  }

  removeClient(ws: WebSocket): void {
    this.wsClients.delete(ws);
  }

  getClientCount(): number {
    return this.wsClients.size;
  }

  isConnected(): boolean {
    return true;
  }

  async connect(): Promise<void> {}

  async disconnect(): Promise<void> {}
}
