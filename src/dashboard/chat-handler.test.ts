import { EventEmitter } from 'events';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Minimal WebSocket mock that tracks sent frames
class MockWebSocket extends EventEmitter {
  readyState = 1; // WebSocket.OPEN
  sent: string[] = [];
  send(data: string) {
    this.sent.push(data);
  }
  close() {}
}

// Stub WebDashboardChannel
const mockAddClient = vi.fn();
const mockRemoveClient = vi.fn();
const mockSendMessage = vi.fn();
const mockSetTyping = vi.fn();

vi.mock('../channels/web-dashboard.js', () => ({
  WebDashboardChannel: vi.fn().mockImplementation(() => ({
    addClient: mockAddClient,
    removeClient: mockRemoveClient,
    sendMessage: mockSendMessage,
    setTyping: mockSetTyping,
    ownsJid: (jid: string) => jid === 'web:dashboard',
    isConnected: () => true,
    connect: vi.fn(),
    disconnect: vi.fn(),
    name: 'web-dashboard',
  })),
}));

import { createChatHandler } from './chat-handler.js';
import type { DashboardDeps } from './types.js';

describe('createChatHandler', () => {
  let mockStoreMessage: ReturnType<typeof vi.fn>;
  let mockEnqueueMessageCheck: ReturnType<typeof vi.fn>;
  let deps: DashboardDeps;
  let ws: MockWebSocket;
  let handler: (ws: unknown) => void;

  beforeEach(() => {
    vi.clearAllMocks();
    mockStoreMessage = vi.fn();
    mockEnqueueMessageCheck = vi.fn();

    deps = {
      getChannels: () => [],
      getQueueSnapshot: () => [],
      getActiveContainerCount: () => 0,
      getIpcQueueDepth: () => 0,
      getTodosDueToday: () => 0,
      getLastError: () => null,
      webDashboardChannel: {
        addClient: mockAddClient,
        removeClient: mockRemoveClient,
        sendMessage: mockSendMessage,
        setTyping: mockSetTyping,
        ownsJid: (jid: string) => jid === 'web:dashboard',
        isConnected: () => true,
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn().mockResolvedValue(undefined),
        name: 'web-dashboard',
        getClientCount: () => 0,
      } as unknown as import('../channels/web-dashboard.js').WebDashboardChannel,
      storeMessage: mockStoreMessage,
      enqueueMessageCheck: mockEnqueueMessageCheck,
    };

    ws = new MockWebSocket();
    handler = createChatHandler(deps);
  });

  it('registers the WS client on connection', () => {
    handler(ws);
    expect(mockAddClient).toHaveBeenCalledWith(ws);
  });

  it('calls storeMessage with chat_jid web:dashboard when a text message arrives', () => {
    handler(ws);
    ws.emit('message', Buffer.from(JSON.stringify({ text: 'Hello Deltron' })));
    expect(mockStoreMessage).toHaveBeenCalledOnce();
    expect(mockStoreMessage.mock.calls[0][0]).toMatchObject({
      chat_jid: 'web:dashboard',
      content: 'Hello Deltron',
    });
  });

  it('calls enqueueMessageCheck with web:dashboard after storing the message', () => {
    handler(ws);
    ws.emit('message', Buffer.from(JSON.stringify({ text: 'ping' })));
    expect(mockEnqueueMessageCheck).toHaveBeenCalledWith('web:dashboard');
  });

  it('does not call storeMessage for empty or whitespace-only messages', () => {
    handler(ws);
    ws.emit('message', Buffer.from(JSON.stringify({ text: '   ' })));
    expect(mockStoreMessage).not.toHaveBeenCalled();
    expect(mockEnqueueMessageCheck).not.toHaveBeenCalled();
  });

  it('does not throw on malformed JSON', () => {
    handler(ws);
    expect(() =>
      ws.emit('message', Buffer.from('not-json')),
    ).not.toThrow();
    expect(mockStoreMessage).not.toHaveBeenCalled();
  });

  it('removes the client on WS close', () => {
    handler(ws);
    ws.emit('close');
    expect(mockRemoveClient).toHaveBeenCalledWith(ws);
  });
});
