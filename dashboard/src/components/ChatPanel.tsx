import { useEffect, useRef, useState } from 'react';

import { Send } from 'lucide-react';

function genId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

interface ChatMessage {
  from: 'user' | 'deltron';
  text: string;
  id: string;
}

function TypingIndicator() {
  return (
    <div className="flex gap-1 px-3 py-2 bg-gray-800 rounded-2xl w-fit">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="w-2 h-2 rounded-full bg-gray-400 animate-bounce"
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
    </div>
  );
}

export default function ChatPanel() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/chat`);
    wsRef.current = ws;

    ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data as string) as {
        type: string;
        text?: string;
        value?: boolean;
      };
      if (msg.type === 'message') {
        setMessages((prev) => [
          ...prev,
          { from: 'deltron', text: msg.text ?? '', id: genId() },
        ]);
        setIsTyping(false);
      } else if (msg.type === 'typing') {
        setIsTyping(msg.value ?? false);
      }
    };

    ws.onclose = () => {
      wsRef.current = null;
    };

    return () => ws.close();
  }, []); // single WS per mount

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const sendMessage = () => {
    const text = input.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ text }));
    setMessages((prev) => [
      ...prev,
      { from: 'user', text, id: genId() },
    ]);
    setInput('');
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-800">
        <h2 className="text-sm font-semibold text-gray-100">Deltron</h2>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <span
              className={
                msg.from === 'user'
                  ? 'bg-blue-600 text-white rounded-2xl rounded-br-sm px-4 py-2 max-w-[70%] text-sm whitespace-pre-wrap'
                  : 'bg-gray-800 text-gray-100 rounded-2xl rounded-bl-sm px-4 py-2 max-w-[70%] text-sm whitespace-pre-wrap'
              }
            >
              {msg.text}
            </span>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <TypingIndicator />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="border-t border-gray-800 p-3 flex gap-2">
        <textarea
          rows={1}
          className="flex-1 bg-gray-800 text-gray-100 rounded-lg px-3 py-2 text-sm resize-none outline-none placeholder-gray-500 focus:ring-1 focus:ring-blue-600"
          placeholder="Message Deltron..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              sendMessage();
            }
          }}
        />
        <button
          onClick={sendMessage}
          className="p-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors disabled:opacity-40"
          disabled={!input.trim()}
          aria-label="Send message"
        >
          <Send size={16} />
        </button>
      </div>
    </div>
  );
}
