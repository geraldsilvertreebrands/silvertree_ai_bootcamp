import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '../contexts/AuthContext';
import Sidebar from './Dashboard/Sidebar';
import MyAccessView from './Dashboard/MyAccessView';
import ApprovalsView from './Dashboard/ApprovalsView';
import UsersView from './Dashboard/UsersView';
import OverviewView from './Dashboard/OverviewView';

type View = 'my-access' | 'approvals' | 'users' | 'overview' | 'provisioning' | 'removal' | 'log' | 'audit';

export default function Dashboard() {
  const { user } = useAuth();
  const [currentView, setCurrentView] = useState<View>('my-access');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  // Handle hash routing
  useEffect(() => {
    const hash = window.location.hash.substring(1);
    if (hash && ['my-access', 'approvals', 'users', 'overview', 'provisioning', 'removal', 'log', 'audit'].includes(hash)) {
      setCurrentView(hash as View);
    }

    const handleHashChange = () => {
      const newHash = window.location.hash.substring(1);
      if (newHash && ['my-access', 'approvals', 'users', 'overview', 'provisioning', 'removal', 'log', 'audit'].includes(newHash)) {
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
      case 'users':
        return <UsersView />;
      case 'overview':
        return <OverviewView />;
      default:
        return <MyAccessView />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-[#0a0a0f] relative">
      <div className="absolute inset-0 bg-gradient-mesh" />
      
      <Sidebar
        currentView={currentView}
        onViewChange={(view) => setCurrentView(view as View)}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        user={user}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden relative z-10">
        <motion.header
          initial={{ y: -20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="glass-dark border-b border-white/10 px-8 py-6 relative"
        >
          <div className="flex items-center justify-between relative z-10">
            <div>
              <motion.h1
                key={currentView}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-4xl font-bold gradient-text mb-2 tracking-tight"
              >
                {currentView === 'my-access' && 'My Access'}
                {currentView === 'approvals' && 'Pending Approvals'}
                {currentView === 'users' && 'Users & Access'}
                {currentView === 'overview' && 'Access Overview'}
              </motion.h1>
              <motion.p
                key={`${currentView}-desc`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-white/60 mt-1.5 text-base"
              >
                {currentView === 'my-access' && 'Manage your access grants and request new permissions'}
                {currentView === 'approvals' && 'Approve or reject access requests for your team'}
                {currentView === 'users' && 'Manage users and their system access'}
                {currentView === 'overview' && 'View and manage all access grants'}
              </motion.p>
            </div>
          </div>
        </motion.header>

        <main className="flex-1 overflow-y-auto p-8 relative">
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
    </div>
  );
}

