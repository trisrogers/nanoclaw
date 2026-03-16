import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../db.js', () => ({
  getMessagesByGroup: vi.fn(),
}));

import { getMessagesByGroup } from '../../db.js';
import { messagesRouter } from './messages.js';

describe('GET /messages route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns 400 when group param is missing', async () => {
    const router = messagesRouter();
    const req = { query: {} } as any;
    let statusCode: number | undefined;
    let jsonResponse: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((val) => {
        jsonResponse = val;
      }),
    } as any;
    res.status.mockImplementation((code: number) => {
      statusCode = code;
      return res;
    });

    const layer = (router as any).stack.find(
      (l: any) => l.route?.path === '/messages' && l.route?.methods?.get,
    );
    expect(layer).toBeDefined();
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(statusCode).toBe(400);
    expect(jsonResponse).toEqual({ error: 'group required' });
  });

  it('returns { messages, total, page, pages } for valid request', async () => {
    vi.mocked(getMessagesByGroup).mockReturnValue({
      messages: [
        {
          id: 'msg-1',
          chat_jid: 'tg:123',
          sender_name: 'Alice',
          content: 'hello',
          timestamp: '2024-01-01T00:00:01.000Z',
          is_bot_message: 0,
        },
      ],
      total: 1,
    });

    const router = messagesRouter();
    const req = { query: { group: 'tg:123', page: '1' } } as any;
    let jsonResponse: any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn((val) => {
        jsonResponse = val;
      }),
    } as any;

    const layer = (router as any).stack.find(
      (l: any) => l.route?.path === '/messages' && l.route?.methods?.get,
    );
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(getMessagesByGroup).toHaveBeenCalledWith('tg:123', 1, undefined);
    expect(jsonResponse).toMatchObject({
      messages: expect.any(Array),
      total: 1,
      page: 1,
      pages: 1,
    });
  });

  it('forwards search param to getMessagesByGroup', async () => {
    vi.mocked(getMessagesByGroup).mockReturnValue({
      messages: [],
      total: 0,
    });

    const router = messagesRouter();
    const req = { query: { group: 'tg:123', page: '1', search: 'foo' } } as any;
    const res = {
      status: vi.fn().mockReturnThis(),
      json: vi.fn(),
    } as any;

    const layer = (router as any).stack.find(
      (l: any) => l.route?.path === '/messages' && l.route?.methods?.get,
    );
    await layer.route.stack[0].handle(req, res, vi.fn());

    expect(getMessagesByGroup).toHaveBeenCalledWith('tg:123', 1, 'foo');
  });
});
