import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Shield,
  Users,
  CheckCircle,
  Plus,
  FileText,
  LogOut,
  Settings,
  ChevronDown
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import silvertreeLogo from '../../assets/silvertree-logo-white.svg';
import silvertreeIcon from '../../assets/silvertree-icon-white.svg';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
  user: any;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const menuItems = [
  { id: 'my-access', label: 'My Access', icon: Shield, available: true },
  { id: 'approvals', label: 'Pending Approvals', icon: CheckCircle, available: false },
  { id: 'provisioning', label: 'Pending Provisions', icon: Settings, available: false },
  { id: 'users', label: 'Users & Access', icon: Users, available: false },
  { id: 'log', label: 'Log Access Grant', icon: Plus, available: false },
  { id: 'audit', label: 'Audit Log', icon: FileText, available: false },
];

export default function Sidebar({ currentView, onViewChange, user, collapsed, onToggleCollapse }: SidebarProps) {
  const { logout, token } = useAuth();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef<HTMLDivElement>(null);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [pendingProvisions, setPendingProvisions] = useState(0);

  const isManager = user?.managedUsers?.length > 0;
  const isOwner = user?.role === 'owner' || user?.role === 'admin';

  // Fetch notification counts
  useEffect(() => {
    const fetchCounts = async () => {
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      try {
        // Fetch pending approvals count for managers
        if (isManager) {
          const approvalsRes = await fetch(`${API_BASE}/api/v1/access-requests/pending`, { headers });
          if (approvalsRes.ok) {
            const data = await approvalsRes.json();
            setPendingApprovals(data.data?.length || 0);
          }
        }

        // Fetch pending provisions count for owners
        if (isOwner) {
          const provisionsRes = await fetch(`${API_BASE}/api/v1/access-requests/pending-provisioning`, { headers });
          if (provisionsRes.ok) {
            const data = await provisionsRes.json();
            setPendingProvisions(data.data?.length || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching notification counts:', error);
      }
    };

    fetchCounts();
    // Refresh counts every 10 seconds
    const interval = setInterval(fetchCounts, 10000);
    return () => clearInterval(interval);
  }, [token, isManager, isOwner]);

  // Refresh counts when view changes (user might have performed an action)
  useEffect(() => {
    const fetchCounts = async () => {
      if (!token) return;

      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      try {
        if (isManager) {
          const approvalsRes = await fetch(`${API_BASE}/api/v1/access-requests/pending`, { headers });
          if (approvalsRes.ok) {
            const data = await approvalsRes.json();
            setPendingApprovals(data.data?.length || 0);
          }
        }

        if (isOwner) {
          const provisionsRes = await fetch(`${API_BASE}/api/v1/access-requests/pending-provisioning`, { headers });
          if (provisionsRes.ok) {
            const data = await provisionsRes.json();
            setPendingProvisions(data.data?.length || 0);
          }
        }
      } catch (error) {
        console.error('Error fetching notification counts:', error);
      }
    };

    fetchCounts();
  }, [currentView, token, isManager, isOwner]);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const visibleItems = menuItems.filter(item => {
    if (item.id === 'approvals') return isManager;
    if (item.id === 'provisioning') return isOwner;
    if (['users', 'log', 'audit'].includes(item.id)) return isOwner;
    return item.available;
  });

  // Get badge count for menu item
  const getBadgeCount = (itemId: string): number => {
    if (itemId === 'approvals') return pendingApprovals;
    if (itemId === 'provisioning') return pendingProvisions;
    return 0;
  };

  // Get user initials
  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const handleLogout = () => {
    setShowUserMenu(false);
    logout();
  };

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 280 }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="bg-[#0a0a0a] border-r border-white/[0.08] flex flex-col relative overflow-hidden h-screen"
    >
      {/* Header with Logo - Clickable to toggle */}
      <div className={`border-b border-white/[0.06] ${collapsed ? 'p-4' : 'p-6'}`}>
        <motion.button
          onClick={onToggleCollapse}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className={`flex items-center ${collapsed ? 'justify-center w-full' : 'gap-4'}`}
        >
          {collapsed ? (
            <img
              src={silvertreeIcon}
              alt="Silvertree"
              className="h-8 w-8 opacity-90"
            />
          ) : (
            <img
              src={silvertreeLogo}
              alt="Silvertree Brands"
              className="h-8 w-auto opacity-90"
            />
          )}
        </motion.button>

        {/* System Access Management - Only when expanded */}
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="mt-4 pt-4 border-t border-white/[0.06] overflow-hidden"
            >
              <p className="text-[11px] text-white/50 font-light tracking-wide">System Access Management</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Navigation */}
      <nav className={`flex-1 ${collapsed ? 'p-2' : 'p-4'} space-y-1 overflow-y-auto`}>
        {visibleItems.map((item, index) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;
          const badgeCount = getBadgeCount(item.id);

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
              whileHover={{ x: collapsed ? 0 : 2 }}
              whileTap={{ scale: 0.98 }}
              title={collapsed ? `${item.label}${badgeCount > 0 ? ` (${badgeCount})` : ''}` : undefined}
              className={`w-full flex items-center ${collapsed ? 'justify-center px-2' : 'px-4'} gap-3 py-3 rounded-lg transition-all duration-300 relative ${
                isActive
                  ? 'bg-white/[0.05] text-white border border-white/[0.1]'
                  : 'text-white/50 hover:bg-white/[0.02] hover:text-white/80 border border-transparent'
              }`}
            >
              <div className="relative flex-shrink-0">
                <Icon size={18} />
                {/* Badge for collapsed state */}
                {collapsed && badgeCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                )}
              </div>
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="font-light text-sm whitespace-nowrap overflow-hidden flex-1"
                  >
                    {item.label}
                  </motion.span>
                )}
              </AnimatePresence>
              {/* Badge for expanded state */}
              {!collapsed && badgeCount > 0 && (
                <span className="min-w-[20px] h-[20px] px-1.5 bg-emerald-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
              {isActive && !collapsed && (
                <motion.div
                  layoutId="activeIndicator"
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[2px] h-5 bg-white rounded-r-full"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                />
              )}
            </motion.button>
          );
        })}
      </nav>

      {/* Footer - User section with dropdown */}
      <div className={`border-t border-white/[0.06] ${collapsed ? 'p-2' : 'p-4'}`} ref={userMenuRef}>
        {user && (
          <div className="relative">
            <motion.button
              onClick={() => setShowUserMenu(!showUserMenu)}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3 px-3'} py-3 rounded-lg hover:bg-white/[0.03] transition-all duration-300`}
            >
              {/* Avatar */}
              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-white/20 to-white/5 border border-white/[0.1] flex items-center justify-center flex-shrink-0">
                <span className="text-white/80 font-medium text-sm">
                  {getInitials(user.name || user.email)}
                </span>
              </div>

              {/* User info - only when expanded */}
              <AnimatePresence>
                {!collapsed && (
                  <motion.div
                    initial={{ opacity: 0, width: 0 }}
                    animate={{ opacity: 1, width: 'auto' }}
                    exit={{ opacity: 0, width: 0 }}
                    className="flex-1 min-w-0 text-left overflow-hidden"
                  >
                    <p className="font-medium text-white text-sm truncate">{user.name || user.email}</p>
                    <p className="text-xs text-white/40 capitalize">{user.role}</p>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Chevron - only when expanded */}
              {!collapsed && (
                <motion.div
                  animate={{ rotate: showUserMenu ? 180 : 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <ChevronDown size={16} className="text-white/40" />
                </motion.div>
              )}
            </motion.button>

            {/* Dropdown menu */}
            <AnimatePresence>
              {showUserMenu && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className={`absolute ${collapsed ? 'left-full ml-2 bottom-0' : 'bottom-full mb-2 left-0 right-0'} bg-[#141414] border border-white/[0.1] rounded-lg shadow-xl overflow-hidden z-50`}
                >
                  {collapsed && (
                    <div className="px-4 py-3 border-b border-white/[0.06]">
                      <p className="font-medium text-white text-sm">{user.name || user.email}</p>
                      <p className="text-xs text-white/40 capitalize">{user.role}</p>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-white/70 hover:bg-white/[0.05] hover:text-white transition-colors"
                  >
                    <LogOut size={16} />
                    <span className="text-sm">Sign Out</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.aside>
  );
}
