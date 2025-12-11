import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, Shield, Search, Filter, CheckCircle2, Clock, XCircle, Trash2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/utils';

interface AccessGrant {
  id: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
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

interface System {
  id: string;
  name: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function OverviewView() {
  const { token } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [systems, setSystems] = useState<System[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [systemFilter, setSystemFilter] = useState('all');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [grantsRes, systemsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/access-overview?limit=1000`, { headers }),
        fetch(`${API_BASE}/api/v1/systems`, { headers }),
      ]);

      if (grantsRes.ok) {
        const data = await grantsRes.json();
        setGrants(data.data || []);
      }

      if (systemsRes.ok) {
        const data = await systemsRes.json();
        setSystems(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGrants = useMemo(() => {
    return grants.filter((grant) => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase();
        const matchesUser = grant.user?.name?.toLowerCase().includes(search) ||
          grant.user?.email?.toLowerCase().includes(search);
        const matchesSystem = grant.systemInstance?.system?.name?.toLowerCase().includes(search) ||
          grant.systemInstance?.name?.toLowerCase().includes(search);
        const matchesTier = grant.accessTier?.name?.toLowerCase().includes(search);
        if (!matchesUser && !matchesSystem && !matchesTier) {
          return false;
        }
      }

      // Status filter
      if (statusFilter !== 'all' && grant.status.toLowerCase() !== statusFilter) {
        return false;
      }

      // System filter
      if (systemFilter !== 'all' && grant.systemInstance?.system?.id !== systemFilter) {
        return false;
      }

      return true;
    });
  }, [grants, searchTerm, statusFilter, systemFilter]);

  // Group grants by user
  const groupedByUser = useMemo(() => {
    const groups: Record<string, { user: AccessGrant['user']; grants: AccessGrant[] }> = {};
    filteredGrants.forEach((grant) => {
      const userId = grant.userId;
      if (!groups[userId]) {
        groups[userId] = { user: grant.user, grants: [] };
      }
      groups[userId].grants.push(grant);
    });
    return Object.values(groups);
  }, [filteredGrants]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'to_remove':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'removed':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-white/[0.03] text-white/60 border-white/[0.08]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 size={12} />;
      case 'to_remove':
        return <Clock size={12} />;
      case 'removed':
        return <XCircle size={12} />;
      default:
        return null;
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
            <Eye className="text-white/60" size={24} />
            Access Overview
          </motion.h2>
          <p className="text-white/40 text-sm font-light">
            View all access grants across the organization
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light text-white">{filteredGrants.length}</p>
          <p className="text-white/40 text-sm">Total Grants</p>
        </div>
      </motion.div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="flex flex-wrap gap-4"
      >
        {/* Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search users, systems, or tiers..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-white/20 focus:outline-none transition-colors text-sm"
          />
        </div>

        {/* Status Filter */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-white/40" />
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="to_remove">Pending Removal</option>
            <option value="removed">Removed</option>
          </select>
        </div>

        {/* System Filter */}
        <select
          value={systemFilter}
          onChange={(e) => setSystemFilter(e.target.value)}
          className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors text-sm"
        >
          <option value="all">All Systems</option>
          {systems.map((system) => (
            <option key={system.id} value={system.id}>
              {system.name}
            </option>
          ))}
        </select>
      </motion.div>

      {/* Results */}
      <AnimatePresence>
        {groupedByUser.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
              <Eye size={28} className="text-white/40" />
            </div>
            <h3 className="text-lg font-light text-white mb-2">No Grants Found</h3>
            <p className="text-white/40 font-light text-sm">
              {searchTerm || statusFilter !== 'all' || systemFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No access grants have been created yet'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-4">
            {groupedByUser.map(({ user, grants: userGrants }, index) => (
              <motion.div
                key={user?.id || index}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] overflow-hidden"
              >
                {/* User Header */}
                <div className="p-4 border-b border-white/[0.06] flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                      <span className="text-white/60 font-medium text-sm">
                        {user?.name?.charAt(0)?.toUpperCase() || '?'}
                      </span>
                    </div>
                    <div>
                      <p className="font-medium text-white">{user?.name || 'Unknown User'}</p>
                      <p className="text-xs text-white/40">{user?.email || ''}</p>
                    </div>
                  </div>
                  <span className="text-white/40 text-sm">
                    {userGrants.length} grant{userGrants.length !== 1 ? 's' : ''}
                  </span>
                </div>

                {/* User Grants */}
                <div className="divide-y divide-white/[0.04]">
                  {userGrants.map((grant) => (
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
                      <span
                        className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(grant.status)}`}
                      >
                        {getStatusIcon(grant.status)}
                        {grant.status}
                      </span>
                    </div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
