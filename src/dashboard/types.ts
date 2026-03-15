import { Channel } from '../types.js';

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
}
