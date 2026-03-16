import { useEffect, useRef, useState } from 'react';

import { Search } from 'lucide-react';

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

export default function MessagesPanel() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedJid, setSelectedJid] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);

  // Fetch groups on mount
  useEffect(() => {
    fetch('/api/groups')
      .then((r) => r.json())
      .then((data: { jid: string; name: string }[]) => {
        setGroups(data);
        if (data.length > 0) {
          setSelectedJid(data[0].jid);
        }
      })
      .catch(() => {});
  }, []);

  // Debounce search input — 300ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch messages when group / page / search changes
  useEffect(() => {
    if (!selectedJid) return;
    setLoading(true);
    const params = new URLSearchParams({
      group: selectedJid,
      page: String(page),
    });
    if (debouncedSearch) params.set('search', debouncedSearch);

    fetch(`/api/messages?${params.toString()}`)
      .then((r) => r.json())
      .then((data: MessagesResponse) => {
        setMessages(data.messages);
        setTotal(data.total);
        setPages(data.pages);
        // Scroll to top of list on page/group change
        if (listRef.current) {
          listRef.current.scrollTop = 0;
        }
      })
      .catch(() => {
        setMessages([]);
      })
      .finally(() => setLoading(false));
  }, [selectedJid, page, debouncedSearch]);

  function selectGroup(jid: string) {
    setSelectedJid(jid);
    setPage(1);
    setSearch('');
  }

  return (
    <div className="flex h-full min-h-0">
      {/* Group sidebar */}
      <div className="w-56 shrink-0 bg-gray-900 border-r border-gray-800 overflow-y-auto">
        <div className="px-3 py-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">
          Groups
        </div>
        {groups.length === 0 && (
          <div className="px-3 py-2 text-sm text-gray-500">No groups found</div>
        )}
        {groups.map((g) => (
          <button
            key={g.jid}
            onClick={() => selectGroup(g.jid)}
            className={`w-full text-left px-3 py-2 text-sm truncate transition-colors ${
              selectedJid === g.jid
                ? 'bg-gray-800 text-gray-100'
                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
            }`}
          >
            {g.name || g.jid}
          </button>
        ))}
      </div>

      {/* Content area */}
      <div className="flex flex-col flex-1 min-w-0 bg-gray-950">
        {/* Search bar */}
        <div className="shrink-0 px-4 py-3 border-b border-gray-800">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search messages…"
              className="w-full bg-gray-900 border border-gray-800 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-gray-600"
            />
          </div>
        </div>

        {/* Message list */}
        <div
          ref={listRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
        >
          {loading && (
            <div className="text-center text-gray-400 text-sm py-8">
              Loading…
            </div>
          )}

          {!loading && messages.length === 0 && (
            <div className="text-center text-gray-400 text-sm py-8">
              No messages yet for this group.
            </div>
          )}

          {!loading &&
            messages.map((msg) => {
              const isBot = msg.is_bot_message === 1;
              return (
                <div
                  key={msg.id}
                  className={`flex flex-col ${isBot ? 'items-start' : 'items-end'}`}
                >
                  <span className="text-xs text-gray-400 mb-1 px-1">
                    {msg.sender_name}
                  </span>
                  <div
                    className={
                      isBot
                        ? 'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 text-sm whitespace-pre-wrap max-w-xl'
                        : 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 text-sm whitespace-pre-wrap max-w-xl'
                    }
                  >
                    {msg.content}
                  </div>
                  <span className="text-xs text-gray-500 mt-1 px-1">
                    {new Date(msg.timestamp).toLocaleString()}
                  </span>
                </div>
              );
            })}
        </div>

        {/* Pagination */}
        <div className="shrink-0 flex items-center justify-between px-4 py-3 border-t border-gray-800 text-sm text-gray-400">
          <span>
            {total > 0
              ? `Page ${page} of ${pages} (${total} messages)`
              : 'No messages'}
          </span>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              Prev
            </button>
            <button
              onClick={() => setPage((p) => Math.min(pages, p + 1))}
              disabled={page >= pages}
              className="px-3 py-1 rounded bg-gray-800 text-gray-300 disabled:opacity-40 hover:bg-gray-700 transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
