import { Channel, NewMessage, RegisteredGroup } from '../types.js';
import { WebDashboardChannel } from '../channels/web-dashboard.js';

export interface ContainerSnapshot {
  jid: string;
  active: boolean;
  containerName: string | null;
  elapsedMs: number | null;
  groupFolder: string | null;
  startedAt: number | null;
}

export interface DashboardDeps {
  getChannels: () => Channel[];
  getQueueSnapshot: () => ContainerSnapshot[];
  getActiveContainerCount: () => number;
  getIpcQueueDepth: () => number;
  getTodosDueToday: () => number;
  getLastError: () => string | null;
  getRegisteredGroups: () => Record<string, RegisteredGroup>;
  clearGroupSession: (folder: string) => { ok: boolean; error?: string };
  restartGroupContainer: (folder: string) => { ok: boolean; error?: string };
  webDashboardChannel: WebDashboardChannel;
  storeMessage: (msg: NewMessage) => void;
  enqueueMessageCheck: (jid: string) => void;
}
