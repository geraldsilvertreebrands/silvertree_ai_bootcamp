import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { formatDate } from '../../lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function ApprovalsView() {
  const { token } = useAuth();
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPendingApprovals();
  }, []);

  const loadPendingApprovals = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/pending`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setRequests(data.data || []);
      }
    } catch (error) {
      console.error('Error loading approvals:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/${requestId}/approve`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        loadPendingApprovals();
      }
    } catch (error) {
      console.error('Error approving request:', error);
    }
  };

  const handleReject = async (requestId: string, reason: string) => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/${requestId}/reject`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ reason }),
      });

      if (response.ok) {
        loadPendingApprovals();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (requests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
                className="glass-dark-elevated rounded-2xl p-12 text-center"
      >
        <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-green-600/10 border border-green-500/20 flex items-center justify-center">
          <CheckCircle2 size={40} className="text-green-400" />
        </div>
        <h3 className="text-3xl font-bold gradient-text mb-3">All Caught Up!</h3>
        <p className="text-white/60 text-lg font-medium">No pending approvals at this time</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-dark-elevated rounded-2xl p-6"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-2xl font-bold gradient-text mb-2 flex items-center gap-3">
              <Sparkles className="text-blue-400" size={24} />
              Pending Approvals
            </h3>
            <p className="text-white/60 text-lg font-medium">{requests.length} request(s) awaiting your review</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-6">
        {requests.map((request, index) => (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="glass-dark-elevated rounded-xl p-6 relative"
                >
            <div className="relative z-10">
              <div className="flex items-start justify-between mb-6">
                <div>
                  <p className="font-bold text-xl text-white mb-2">
                    Request from {request.requester?.name || 'Unknown'}
                  </p>
                  <p className="text-white/60 font-medium">
                    For {request.targetUser?.name || 'Unknown'} • {formatDate(request.createdAt)}
                  </p>
                </div>
                <motion.span
                  whileHover={{ scale: 1.05 }}
                  className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-2"
                >
                  <Clock size={16} />
                  Pending
                </motion.span>
              </div>

              <div className="space-y-3 mb-6">
                {request.items?.map((item: any) => (
                  <motion.div
                    key={item.id}
                    whileHover={{ x: 4 }}
                    className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <p className="font-semibold text-white mb-1">
                      {item.systemInstance?.system?.name || 'Unknown System'}
                    </p>
                    <p className="text-sm text-white/60 font-medium">
                      {item.systemInstance?.name || 'Unknown'} • {item.accessTier?.name || 'Unknown'}
                    </p>
                  </motion.div>
                ))}
              </div>

              <div className="flex gap-3">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleApprove(request.id)}
                  className="flex-1 px-6 py-3 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors"
                >
                  <CheckCircle2 size={20} />
                  Approve
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => {
                    const reason = prompt('Reason for rejection:');
                    if (reason) handleReject(request.id, reason);
                  }}
                  className="flex-1 px-6 py-3 rounded-lg bg-red-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-colors"
                >
                  <XCircle size={20} />
                  Reject
                </motion.button>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

