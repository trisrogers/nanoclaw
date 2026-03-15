import { useState } from 'react';

import LogsPanel from './components/LogsPanel';

const NAV_ITEMS = [
  'Overview',
  'Chat',
  'Containers',
  'Logs',
  'Groups',
  'Messages',
  'Memory',
  'Tasks',
  'Todos',
  'Usage',
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

export default function App() {
  const [active, setActive] = useState<NavItem>('Overview');

  return (
    <div className="flex h-screen bg-gray-950 text-gray-100">
      {/* Sidebar */}
      <aside className="w-60 shrink-0 bg-gray-900 border-r border-gray-800 flex flex-col">
        <div className="px-4 py-5 border-b border-gray-800">
          <span className="text-sm font-semibold tracking-widest text-gray-400 uppercase">
            NanoClaw
          </span>
        </div>
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map((item) => (
            <button
              key={item}
              onClick={() => setActive(item)}
              className={`w-full text-left px-4 py-2 text-sm transition-colors ${
                active === item
                  ? 'bg-gray-800 text-white font-medium'
                  : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
              }`}
            >
              {item}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto p-8">
        <h1 className="text-xl font-semibold text-gray-200 mb-2">{active}</h1>
        {active === 'Logs' ? (
          <LogsPanel />
        ) : (
          <p className="text-gray-500 text-sm">
            Select a panel from the sidebar to get started.
          </p>
        )}
      </main>
    </div>
  );
}
