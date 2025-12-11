import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FileText, Search, Filter, CheckCircle2, XCircle, Clock, Plus } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/utils';

interface AuditLog {
  id: string;
  action: string;
  actor: {
    id: string;
    name: string;
    email: string;
  } | null;
  targetUser: {
    id: string;
    name: string;
    email: string;
  } | null;
  resourceType: string;
  resourceId: string;
  details: Record<string, any> | null;
  reason: string | null;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

const ACTION_LABELS: Record<string, string> = {
  request_created: 'Request Created',
  request_approved: 'Request Approved',
  request_rejected: 'Request Rejected',
  grant_created: 'Grant Created',
  grant_activated: 'Grant Activated',
  grant_marked_for_removal: 'Marked for Removal',
  grant_removed: 'Grant Removed',
  item_approved: 'Item Approved',
  item_rejected: 'Item Rejected',
  item_provisioned: 'Item Provisioned',
};

export default function AuditLogView() {
  const { token } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [actionFilter, setActionFilter] = useState('all');
  const [total, setTotal] = useState(0);

  useEffect(() => {
    loadAuditLogs();
  }, [actionFilter]);

  const loadAuditLogs = async () => {
    setLoading(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      let url = `${API_BASE}/api/v1/audit-logs?limit=100`;
      if (actionFilter !== 'all') {
        url += `&action=${actionFilter}`;
      }

      const response = await fetch(url, { headers });
      if (response.ok) {
        const data = await response.json();
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (error) {
      console.error('Error loading audit logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = useMemo(() => {
    if (!searchTerm) return logs;
    const search = searchTerm.toLowerCase();
    return logs.filter(log =>
      log.actor?.name?.toLowerCase().includes(search) ||
      log.actor?.email?.toLowerCase().includes(search) ||
      log.targetUser?.name?.toLowerCase().includes(search) ||
      log.targetUser?.email?.toLowerCase().includes(search) ||
      log.action?.toLowerCase().includes(search)
    );
  }, [logs, searchTerm]);

  const getActionIcon = (action: string) => {
    if (action.includes('approved') || action.includes('activated') || action.includes('provisioned')) {
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    }
    if (action.includes('rejected') || action.includes('removed')) {
      return <XCircle size={14} className="text-red-400" />;
    }
    if (action.includes('created')) {
      return <Plus size={14} className="text-blue-400" />;
    }
    return <Clock size={14} className="text-amber-400" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('approved') || action.includes('activated') || action.includes('provisioned')) {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
    }
    if (action.includes('rejected') || action.includes('removed')) {
      return 'bg-red-500/10 text-red-400 border-red-500/20';
    }
    if (action.includes('created')) {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
    return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
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
            <FileText className="text-white/60" size={24} />
            Audit Log
          </motion.h2>
          <p className="text-white/40 text-sm font-light">
            Track all access management activities
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light text-white">{total}</p>
          <p className="text-white/40 text-sm">Total Events</p>
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
            placeholder="Search by user..."
            className="w-full pl-10 pr-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white placeholder-white/30 focus:border-white/20 focus:outline-none transition-colors text-sm"
          />
        </div>

        {/* Action Filter */}
        <div className="flex items-center gap-2">
          <Filter size={16} className="text-white/40" />
          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="px-4 py-2.5 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors text-sm"
          >
            <option value="all">All Actions</option>
            <option value="request_created">Request Created</option>
            <option value="request_approved">Request Approved</option>
            <option value="request_rejected">Request Rejected</option>
            <option value="grant_created">Grant Created</option>
            <option value="grant_activated">Grant Activated</option>
            <option value="grant_marked_for_removal">Marked for Removal</option>
            <option value="grant_removed">Grant Removed</option>
            <option value="item_provisioned">Item Provisioned</option>
          </select>
        </div>
      </motion.div>

      {/* Logs List */}
      <AnimatePresence>
        {filteredLogs.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
          >
            <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
              <FileText size={28} className="text-white/40" />
            </div>
            <h3 className="text-lg font-light text-white mb-2">No Audit Logs</h3>
            <p className="text-white/40 font-light text-sm">
              {searchTerm || actionFilter !== 'all'
                ? 'Try adjusting your filters'
                : 'No audit events have been recorded yet'}
            </p>
          </motion.div>
        ) : (
          <div className="space-y-3">
            {filteredLogs.map((log, index) => (
              <motion.div
                key={log.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-4 hover:border-white/[0.12] transition-all duration-300"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <span className={`px-2.5 py-1 rounded text-xs font-medium border flex items-center gap-1.5 ${getActionColor(log.action)}`}>
                        {getActionIcon(log.action)}
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-xs text-white/30 font-light">
                        {formatDate(log.createdAt)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      {log.actor && (
                        <p className="text-white/60">
                          <span className="text-white/40">By:</span> {log.actor.name} ({log.actor.email})
                        </p>
                      )}
                      {log.targetUser && (
                        <p className="text-white/60">
                          <span className="text-white/40">For:</span> {log.targetUser.name} ({log.targetUser.email})
                        </p>
                      )}
                      {log.reason && (
                        <p className="text-white/50 italic">
                          "{log.reason}"
                        </p>
                      )}
                      {log.details && (
                        <p className="text-white/40 text-xs">
                          {log.details.systemName && `${log.details.systemName}`}
                          {log.details.instanceName && ` • ${log.details.instanceName}`}
                          {log.details.tierName && ` • ${log.details.tierName}`}
                          {log.details.systems?.length > 0 && `Systems: ${log.details.systems.join(', ')}`}
                          {log.details.itemCount && ` • ${log.details.itemCount} item(s)`}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-xs text-white/30">
                    <p>{log.resourceType}</p>
                    <p className="font-mono">{log.resourceId?.slice(0, 8)}...</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
