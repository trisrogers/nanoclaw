import { useState } from 'react';
import {
  LayoutDashboard,
  MessageSquare,
  CheckSquare,
  CalendarClock,
  BrainCircuit,
  BarChart2,
  Terminal,
  Zap,
} from 'lucide-react';

import LogsPanel from './components/LogsPanel';
import MemoryPanel, { memoryIsDirtyRef } from './components/MemoryPanel';
import MessagesPanel from './components/MessagesPanel';
import OverviewPanel from './components/OverviewPanel';
import TasksPanel from './components/TasksPanel';
import TodosPanel from './components/TodosPanel';
import UsageTab from './components/UsageTab';

const NAV_ITEMS = [
  'Overview',
  'Messages',
  'Todos',
  'Schedule',
  'Edit',
  'Usage',
  'Logs',
] as const;

type NavItem = (typeof NAV_ITEMS)[number];

const NAV_CONFIG: Record<NavItem, { icon: React.ReactNode; label: string }> = {
  Overview: { icon: <LayoutDashboard size={15} />, label: 'Overview' },
  Messages: { icon: <MessageSquare size={15} />, label: 'Messages' },
  Todos:    { icon: <CheckSquare size={15} />,    label: 'Todos' },
  Schedule: { icon: <CalendarClock size={15} />,  label: 'Schedule' },
  Edit:     { icon: <BrainCircuit size={15} />,   label: 'Memory' },
  Usage:    { icon: <BarChart2 size={15} />,       label: 'Usage' },
  Logs:     { icon: <Terminal size={15} />,        label: 'Logs' },
};

export default function App() {
  const [active, setActive] = useState<NavItem>('Overview');
  const [messagesJid, setMessagesJid] = useState<string | null>(null);

  const handleNavClick = (item: NavItem) => {
    if (active === 'Edit' && memoryIsDirtyRef.current) {
      if (!window.confirm('You have unsaved changes in Edit. Leave anyway?')) return;
    }
    setActive(item);
  };

  const navigateToMessages = (jid: string) => {
    setMessagesJid(jid);
    setActive('Messages');
  };

  const isFullHeight = active === 'Messages';

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* ── Sidebar ─────────────────────────────────────────────────────── */}
      <aside style={{
        width: '200px',
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
      }}>

        {/* Brand mark */}
        <div style={{
          padding: '18px 16px 16px',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {/* Logo tile */}
            <div style={{
              width: '30px',
              height: '30px',
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-bright) 100%)',
              borderRadius: '7px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '14px',
              fontWeight: 800,
              color: '#fff',
              fontFamily: 'var(--font-mono)',
              letterSpacing: '-0.05em',
              boxShadow: '0 0 12px var(--accent-glow-strong)',
              flexShrink: 0,
            }}>N</div>

            <div>
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: '14px',
                fontWeight: 700,
                color: 'var(--text)',
                letterSpacing: '0.01em',
                lineHeight: 1.1,
              }}>
                NanoClaw
              </div>
              <div style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '9px',
                color: 'var(--text-muted)',
                letterSpacing: '0.15em',
                marginTop: '2px',
              }}>
                CONTROL
              </div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex: 1, padding: '6px 0' }}>
          {NAV_ITEMS.map((item) => {
            const { icon, label } = NAV_CONFIG[item];
            const isActive = active === item;
            return (
              <button
                key={item}
                onClick={() => handleNavClick(item)}
                className={`nc-nav-btn${isActive ? ' active' : ''}`}
              >
                <span className="nav-icon">{icon}</span>
                {label}
              </button>
            );
          })}
        </nav>

        {/* Status footer */}
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '7px',
        }}>
          <Zap size={11} style={{ color: 'var(--green)', flexShrink: 0 }} />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '10px',
            color: 'var(--text-muted)',
            letterSpacing: '0.12em',
          }}>
            ONLINE
          </span>
        </div>
      </aside>

      {/* ── Main content ─────────────────────────────────────────────────── */}
      <main style={{
        flex: 1,
        overflow: isFullHeight ? 'hidden' : 'auto',
        display: 'flex',
        flexDirection: 'column',
      }}>
        <div
          key={active}
          className="fade-up"
          style={{
            flex: 1,
            minHeight: 0,
            padding: isFullHeight ? 0 : '28px 32px',
            display: isFullHeight ? 'flex' : 'block',
            flexDirection: isFullHeight ? 'column' : undefined,
            maxWidth: isFullHeight ? undefined : '960px',
          }}
        >
          {active === 'Overview' && (
            <OverviewPanel onNavigateToMessages={navigateToMessages} />
          )}
          {active === 'Messages' && (
            <MessagesPanel
              key={messagesJid ?? 'default'}
              initialJid={messagesJid}
            />
          )}
          {active === 'Edit'     && <MemoryPanel />}
          {active === 'Schedule' && <TasksPanel />}
          {active === 'Todos'    && <TodosPanel />}
          {active === 'Usage'    && <UsageTab />}
          {active === 'Logs'     && <LogsPanel />}
        </div>
      </main>
    </div>
  );
}
