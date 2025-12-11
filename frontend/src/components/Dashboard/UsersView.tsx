import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Users, Search, Shield, ChevronDown, ChevronRight, Mail, User as UserIcon } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/utils';

interface User {
  id: string;
  name: string;
  email: string;
  role: string;
  manager?: {
    id: string;
    name: string;
    email: string;
  };
  createdAt: string;
}

interface AccessGrant {
  id: string;
  systemInstance: {
    id: string;
    name: string;
    system: {
      id: string;
      name: string;
    };
  };
  accessTier: {
    id: string;
    name: string;
  };
  status: string;
  grantedAt: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function UsersView() {
  const { token } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());
  const [userGrants, setUserGrants] = useState<Record<string, AccessGrant[]>>({});
  const [loadingGrants, setLoadingGrants] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${API_BASE}/api/v1/users?limit=1000`, { headers });
      if (response.ok) {
        const data = await response.json();
        setUsers(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading users:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUserGrants = async (userId: string) => {
    if (userGrants[userId]) return; // Already loaded

    setLoadingGrants((prev) => new Set(prev).add(userId));
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(
        `${API_BASE}/api/v1/access-overview?userId=${userId}&status=active&limit=100`,
        { headers }
      );
      if (response.ok) {
        const data = await response.json();
        setUserGrants((prev) => ({
          ...prev,
          [userId]: data.data || [],
        }));
      }
    } catch (error) {
      console.error('Error loading user grants:', error);
    } finally {
      setLoadingGrants((prev) => {
        const next = new Set(prev);
        next.delete(userId);
        return next;
      });
    }
  };

  const toggleUserExpanded = (userId: string) => {
    const newExpanded = new Set(expandedUsers);
    if (newExpanded.has(userId)) {
      newExpanded.delete(userId);
    } else {
      newExpanded.add(userId);
      loadUserGrants(userId);
    }
    setExpandedUsers(newExpanded);
  };

  const filteredUsers = useMemo(() => {
    if (!searchTerm) return users;
    const search = searchTerm.toLowerCase();
    return users.filter(
      (user) =>
        user.name?.toLowerCase().includes(search) ||
        user.email?.toLowerCase().includes(search) ||
        user.role?.toLowerCase().includes(search)
    );
  }, [users, searchTerm]);

  const getRoleBadgeColor = (role: string) => {
    switch (role?.toLowerCase()) {
      case 'admin':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'owner':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'manager':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      default:
        return 'bg-white/[0.03] text-white/60 border-white/[0.08]';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 border-2 border-white/20 border-t-white rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-2xl font-light text-white mb-1 flex items-center gap-3"
          >
            <Users className="text-white/60" size={24} />
            Users & Access
          </motion.h2>
          <p className="text-white/40 text-sm font-light">
            Manage users and their access permissions
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light text-white">{users.length}</p>
          <p className="text-white/40 text-sm">Total Users</p>
        </div>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder="Search by name, email, or role..."
          className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-white/20 focus:outline-none transition-colors text-sm"
        />
      </motion.div>

      {/* Users List */}
      <AnimatePresence>
        {filteredUsers.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
              <Users size={28} className="text-white/40" />
            </div>
            <h3 className="text-lg font-light text-white mb-2">No Users Found</h3>
            <p className="text-white/40 font-light text-sm">
              {searchTerm ? 'Try adjusting your search' : 'No users have been created yet'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredUsers.map((user, index) => {
              const isExpanded = expandedUsers.has(user.id);
              const grants = userGrants[user.id] || [];
              const isLoadingGrants = loadingGrants.has(user.id);

              return (
                <motion.div
                  key={user.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] overflow-hidden"
                >
                  {/* User Header */}
                  <button
                    onClick={() => toggleUserExpanded(user.id)}
                    className="w-full p-4 flex items-center justify-between hover:bg-white/[0.02] transition-colors text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                        <span className="text-white/60 font-medium text-sm">
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-white">{user.name}</p>
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium border ${getRoleBadgeColor(user.role)}`}
                          >
                            {user.role || 'user'}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-white/40">
                          <span className="flex items-center gap-1">
                            <Mail size={12} />
                            {user.email}
                          </span>
                          {user.manager && (
                            <span className="flex items-center gap-1">
                              <UserIcon size={12} />
                              Reports to: {user.manager.name}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      {grants.length > 0 && (
                        <span className="text-white/40 text-sm">
                          {grants.length} grant{grants.length !== 1 ? 's' : ''}
                        </span>
                      )}
                      {isExpanded ? (
                        <ChevronDown size={20} className="text-white/40" />
                      ) : (
                        <ChevronRight size={20} className="text-white/40" />
                      )}
                    </div>
                  </button>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="border-t border-white/[0.06] overflow-hidden"
                      >
                        {isLoadingGrants ? (
                          <div className="p-6 flex items-center justify-center">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                              className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
                            />
                          </div>
                        ) : grants.length === 0 ? (
                          <div className="p-6 text-center">
                            <Shield size={24} className="mx-auto mb-2 text-white/20" />
                            <p className="text-white/40 text-sm">No active access grants</p>
                          </div>
                        ) : (
                          <div className="divide-y divide-white/[0.04]">
                            {grants.map((grant) => (
                              <div
                                key={grant.id}
                                className="px-4 py-3 flex items-center justify-between hover:bg-white/[0.02] transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <Shield size={16} className="text-white/30" />
                                  <div>
                                    <p className="text-sm text-white">
                                      {grant.systemInstance?.system?.name} • {grant.systemInstance?.name}
                                    </p>
                                    <p className="text-xs text-white/40">
                                      {grant.accessTier?.name} • Granted {formatDate(grant.grantedAt)}
                                    </p>
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                                  {grant.status}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
