import { motion } from 'framer-motion';
import { 
  Shield, 
  Users, 
  CheckCircle, 
  Eye, 
  Plus, 
  FileText,
  LogOut,
  Menu,
  X
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
  user: any;
}

const menuItems = [
  { id: 'my-access', label: 'My Access', icon: Shield, available: true },
  { id: 'approvals', label: 'Pending Approvals', icon: CheckCircle, available: false },
  { id: 'users', label: 'Users & Access', icon: Users, available: false },
  { id: 'overview', label: 'Access Overview', icon: Eye, available: false },
  { id: 'log', label: 'Log Access Grant', icon: Plus, available: false },
  { id: 'audit', label: 'Audit Log', icon: FileText, available: false },
];

export default function Sidebar({ currentView, onViewChange, collapsed, onToggleCollapse, user }: SidebarProps) {
  const { logout } = useAuth();
  const isManager = false; // TODO: Check if user is manager
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  const visibleItems = menuItems.filter(item => {
    if (item.id === 'approvals') return isManager || isOwner;
    if (['users', 'overview', 'log', 'audit'].includes(item.id)) return isOwner;
    return item.available;
  });

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 80 : 280 }}
      className="glass-dark border-r border-white/10 flex flex-col relative overflow-hidden h-screen"
    >
      {/* Animated background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/5 via-transparent to-purple-500/5 pointer-events-none" />
      
      {/* Header */}
      <div className="p-6 border-b border-white/10 relative z-10">
        <div className="flex items-center justify-between mb-6">
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-3"
            >
              <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
                <span className="text-white font-bold text-lg">C</span>
              </div>
              <div>
                <h2 className="font-bold text-lg gradient-text">Corolla</h2>
                <p className="text-xs text-white/50 font-medium">Access Management</p>
              </div>
            </motion.div>
          )}
          {collapsed && (
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center mx-auto">
              <span className="text-white font-bold text-lg">C</span>
            </div>
          )}
        </div>
        <motion.button
          onClick={onToggleCollapse}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="w-full p-2.5 rounded-xl hover:bg-white/10 transition-all duration-200 flex items-center justify-center text-white/70 hover:text-white border border-white/5 hover:border-white/10"
        >
          {collapsed ? <Menu size={20} /> : <X size={20} />}
        </motion.button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto relative z-10">
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05, type: "spring" }}
              onClick={() => {
                onViewChange(item.id);
                window.location.hash = item.id;
              }}
              whileHover={{ x: 4 }}
              whileTap={{ scale: 0.98 }}
              className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 relative group ${
                isActive
                  ? 'bg-blue-600/20 text-white border border-blue-500/30'
                  : 'text-white/60 hover:bg-white/5 hover:text-white border border-transparent hover:border-white/10'
              }`}
            >
              <Icon 
                size={20} 
                className={`flex-shrink-0 ${isActive ? 'text-blue-400' : ''}`}
              />
              {!collapsed && (
                <span className="font-medium text-sm">{item.label}</span>
              )}
              {isActive && (
                <>
                  <motion.div
                    layoutId="activeIndicator"
                    className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r-full"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                </>
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-white/10 space-y-2 relative z-10">
        {!collapsed && user && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="px-4 py-3 rounded-xl bg-white/5 border border-white/10 backdrop-blur-sm"
          >
            <p className="text-xs text-white/50 uppercase tracking-wider mb-1.5 font-semibold">Signed in as</p>
            <p className="font-semibold text-white text-sm mb-0.5">{user.name || user.email}</p>
            <p className="text-xs text-white/50 capitalize font-medium">{user.role}</p>
          </motion.div>
        )}
        <motion.button
          onClick={logout}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200 border border-transparent hover:border-red-500/20"
        >
          <LogOut size={20} />
          {!collapsed && <span className="font-medium text-sm">Sign Out</span>}
        </motion.button>
      </div>
    </motion.aside>
  );
}

