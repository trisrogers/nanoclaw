import { useState } from 'react';

import ChatPanel from './components/ChatPanel';
import ContainersPanel from './components/ContainersPanel';
import GroupsPanel from './components/GroupsPanel';
import LogsPanel from './components/LogsPanel';
import MemoryPanel, { memoryIsDirtyRef } from './components/MemoryPanel';
import MessagesPanel from './components/MessagesPanel';
import OverviewPanel from './components/OverviewPanel';
import TasksPanel from './components/TasksPanel';
import TodosPanel from './components/TodosPanel';
import UsagePanel from './components/UsagePanel';

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

  const handleNavClick = (item: NavItem) => {
    if (active === 'Memory' && memoryIsDirtyRef.current) {
      if (!window.confirm('You have unsaved changes in Memory. Leave anyway?'))
        return;
    }
    setActive(item);
  };

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
              onClick={() => handleNavClick(item)}
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
      <main className={`flex-1 ${active === 'Chat' ? 'overflow-hidden flex flex-col' : 'overflow-auto p-6'}`}>
        {active === 'Overview' && <OverviewPanel />}
        {active === 'Chat' && <ChatPanel />}
        {active === 'Containers' && <ContainersPanel />}
        {active === 'Groups' && <GroupsPanel />}
        {active === 'Logs' && <LogsPanel />}
        {active === 'Messages' && <MessagesPanel />}
        {active === 'Memory' && <MemoryPanel />}
        {active === 'Tasks' && <TasksPanel />}
        {active === 'Todos' && <TodosPanel />}
        {active === 'Usage' && <UsagePanel />}
      </main>
    </div>
  );
}
