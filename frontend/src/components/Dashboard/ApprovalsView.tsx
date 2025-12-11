import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function ApprovalsView() {
  const { token } = useAuth();
  const toast = useToast();
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
        toast.success('Request Approved', 'The access request has been approved and is pending provisioning.');
        loadPendingApprovals();
      } else {
        const error = await response.json();
        toast.error('Approval Failed', error.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast.error('Approval Failed', 'Failed to approve request. Please try again.');
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
        toast.success('Request Rejected', 'The access request has been rejected.');
        loadPendingApprovals();
      } else {
        const error = await response.json();
        toast.error('Rejection Failed', error.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Rejection Failed', 'Failed to reject request. Please try again.');
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

  if (requests.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
      >
        <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
          <CheckCircle2 size={28} className="text-white/40" />
        </div>
        <h3 className="text-lg font-light text-white mb-2">All Caught Up</h3>
        <p className="text-white/40 font-light text-sm">No pending approvals at this time</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-8">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xl font-light text-white mb-1 flex items-center gap-3">
              <Clock size={20} className="text-white/60" />
              Pending Approvals
            </h3>
            <p className="text-white/40 text-sm font-light">{requests.length} request(s) awaiting your review</p>
          </div>
        </div>
      </motion.div>

      <div className="grid gap-4">
        {requests.map((request, index) => (
          <motion.div
            key={request.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -1 }}
            className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-5 hover:border-white/[0.12] hover:bg-[#141414] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-5">
              <div>
                <p className="font-medium text-white mb-1">
                  Request from {request.requester?.name || 'Unknown'}
                </p>
                <p className="text-white/40 text-sm font-light">
                  For {request.targetUser?.name || 'Unknown'} • {formatDate(request.createdAt)}
                </p>
              </div>
              <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/60 border border-white/[0.08] flex items-center gap-1.5">
                <Clock size={14} />
                Pending
              </span>
            </div>

            <div className="space-y-2 mb-5">
              {request.items?.map((item: any) => (
                <motion.div
                  key={item.id}
                  whileHover={{ x: 2 }}
                  className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all duration-300"
                >
                  <p className="font-medium text-white text-sm mb-0.5">
                    {item.systemInstance?.system?.name || 'Unknown System'}
                  </p>
                  <p className="text-xs text-white/40 font-light">
                    {item.systemInstance?.name || 'Unknown'} • {item.accessTier?.name || 'Unknown'}
                  </p>
                </motion.div>
              ))}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleApprove(request.id)}
                className="flex-1 px-5 py-2.5 rounded-lg bg-white text-black font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all duration-300"
              >
                <CheckCircle2 size={16} />
                Approve
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => {
                  const reason = prompt('Reason for rejection:');
                  if (reason) handleReject(request.id, reason);
                }}
                className="flex-1 px-5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm flex items-center justify-center gap-2 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300"
              >
                <XCircle size={16} />
                Reject
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
