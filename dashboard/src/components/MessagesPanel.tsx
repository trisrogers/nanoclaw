import { useEffect, useRef, useState } from 'react';
import { Search, Send } from 'lucide-react';

interface Group {
  jid: string;
  name: string;
}

interface MessageRow {
  id: string;
  chat_jid: string;
  sender_name: string;
  content: string;
  timestamp: string;
  is_bot_message: number;
}

interface MessagesResponse {
  messages: MessageRow[];
  total: number;
  page: number;
  pages: number;
}

const DASHBOARD_JID = 'web:dashboard';

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
      {[0, 1, 2].map((i) => (
        <span key={i} className="w-2 h-2 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
      ))}
    </div>
  );
}

interface Props {
  initialJid?: string | null;
}

export default function MessagesPanel({ initialJid }: Props) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(initialJid ?? null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Live chat state (only used when selectedJid === DASHBOARD_JID)
  const [chatInput, setChatInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [liveMessages, setLiveMessages] = useState<MessageRow[]>([]);
  const wsRef = useRef<WebSocket | null>(null);

  // Fetch groups on mount
  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data: { jid: string; name: string }[]) => {
        setGroups(data);
        if (!selectedJid && data.length > 0) setSelectedJid(data[0].jid);
      })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch historical messages when group/search changes
  useEffect(() => {
    if (!selectedJid) return;
    setLoading(true);
    const params = new URLSearchParams({ group: selectedJid, page: '1' });
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/messages?${params.toString()}`)
      .then((r) => r.json())
      .then((data: MessagesResponse) => {
        setMessages([...data.messages].reverse());
        setLiveMessages([]); // clear live messages on group switch
        setTotal(data.total);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      })
      .catch(() => setMessages([]))
      .finally(() => setLoading(false));
  }, [selectedJid, debouncedSearch]);

  // WebSocket for live chat — only connect when on dashboard group
  useEffect(() => {
    if (selectedJid !== DASHBOARD_JID) {
      wsRef.current?.close();
      wsRef.current = null;
      return;
    }
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data as string) as { type: string; text?: string; value?: boolean };
      if (msg.type === 'message') {
        const row: MessageRow = {
          id: genId(),
          chat_jid: DASHBOARD_JID,
          sender_name: 'Deltron',
          content: msg.text ?? '',
          timestamp: new Date().toISOString(),
          is_bot_message: 1,
        };
        setLiveMessages((prev) => [...prev, row]);
        setIsTyping(false);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      } else if (msg.type === 'typing') {
        setIsTyping(msg.value ?? false);
        requestAnimationFrame(() => {
          if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
        });
      }
    };

    ws.onclose = () => { wsRef.current = null; };

    return () => ws.close();
  }, [selectedJid]);

  function selectGroup(jid: string) {
    setSelectedJid(jid);
    setSearch('');
    setIsTyping(false);
  }

  const sendMessage = () => {
    const text = chatInput.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    const row: MessageRow = {
      id: genId(),
      chat_jid: DASHBOARD_JID,
      sender_name: 'You',
      content: text,
      timestamp: new Date().toISOString(),
      is_bot_message: 0,
    };
    setLiveMessages((prev) => [...prev, row]);
    setChatInput('');
    requestAnimationFrame(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    });
  };

  const isDashboard = selectedJid === DASHBOARD_JID;
  const allMessages = isDashboard ? [...messages, ...liveMessages] : messages;

  return (
    <div className="flex h-full min-h-0">
      {/* Group sidebar */}
      <div className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
        <div className="px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Groups</div>
        {groups.length === 0 && <div className="px-3 py-2 text-sm text-gray-500">No groups found</div>}
        {groups.map((g) => (
          <button
            key={g.jid}
            onClick={() => selectGroup(g.jid)}
            className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
              selectedJid === g.jid ? 'bg-gray-800 text-gray-100' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            }`}
          >
            {g.name || g.jid}
            {g.jid === DASHBOARD_JID && (
              <span className="ml-1.5 text-xs text-blue-400">live</span>
            )}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0 bg-gray-950">
        {/* Search / header bar */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-800 flex items-center gap-3">
          {!isDashboard && (
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search messages…"
                className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600"
              />
            </div>
          )}
          {isDashboard && <span className="text-sm font-medium text-gray-300">Dashboard Chat</span>}
          {!isDashboard && total > 0 && (
            <span className="text-xs text-gray-500 shrink-0">
              {total > 100 ? `Latest 100 of ${total}` : `${total} messages`}
            </span>
          )}
        </div>

        {/* Message list */}
        <div ref={listRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0">
          {loading && <div className="text-center text-gray-400 text-sm py-8">Loading…</div>}
          {!loading && allMessages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              {isDashboard ? 'Send a message to start chatting.' : 'No messages yet for this group.'}
            </div>
          )}
          {!loading && allMessages.map((msg) => {
            const isBot = msg.is_bot_message === 1;
            return (
              <div key={msg.id} className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}>
                <span className="text-xs text-gray-400 mb-1 px-1">{msg.sender_name}</span>
                <div className={isBot
                  ? 'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap max-w-xl'
                  : 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap max-w-xl'
                }>
                  {msg.content}
                </div>
                <span className="text-xs text-gray-500 mt-1 px-1">
                  {new Date(msg.timestamp).toLocaleString()}
                </span>
              </div>
            );
          })}
          {isTyping && (
            <div className="flex justify-start">
              <TypingIndicator />
            </div>
          )}
        </div>

        {/* Chat input — only shown for dashboard group */}
        {isDashboard && (
          <div className="shrink-0 border-t border-gray-800 p-3 flex gap-2">
            <textarea
              rows={1}
              className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm resize-none outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-600"
              placeholder="Message Deltron…"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <button
              onClick={sendMessage}
              disabled={!chatInput.trim()}
              className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
              aria-label="Send message"
            >
              <Send size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
