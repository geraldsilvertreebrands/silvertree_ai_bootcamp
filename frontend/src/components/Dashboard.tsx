import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Dashboard/Sidebar';
import MyAccessView from './Dashboard/MyAccessView';
import ApprovalsView from './Dashboard/ApprovalsView';
import ProvisioningView from './Dashboard/ProvisioningView';
import UsersView from './Dashboard/UsersView';
import LogGrantView from './Dashboard/LogGrantView';
import AuditLogView from './Dashboard/AuditLogView';

type View = 'my-access' | 'approvals' | 'provisioning' | 'users' | 'removal' | 'log' | 'audit';

export default function Dashboard() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('my-access');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Handle hash routing
  useEffect(() => {
    const validViews = ['my-access', 'approvals', 'provisioning', 'users', 'removal', 'log', 'audit'];
    const hash = window.location.hash.substring(1);
    if (hash && validViews.includes(hash)) {
      setCurrentView(hash as View);
    }

    const handleHashChange = () => {
      const newHash = window.location.hash.substring(1);
      if (newHash && validViews.includes(newHash)) {
        setCurrentView(newHash as View);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const renderView = () => {
    switch (currentView) {
      case 'my-access':
        return <MyAccessView />;
      case 'approvals':
        return <ApprovalsView />;
      case 'provisioning':
        return <ProvisioningView />;
      case 'users':
        return <UsersView />;
      case 'log':
        return <LogGrantView />;
      case 'audit':
        return <AuditLogView />;
      default:
        return <MyAccessView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-black relative">
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        user={user}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      <main className="flex-1 overflow-y-auto p-8 bg-[#050505]">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentView}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          >
            {renderView()}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
