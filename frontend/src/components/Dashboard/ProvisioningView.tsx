import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Shield, Package } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../lib/utils';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

interface ProvisioningItem {
  id: string;
  status: string;
  accessRequest: {
    id: string;
    targetUser: {
      id: string;
      name: string;
      email: string;
    };
    requester: {
      id: string;
      name: string;
      email: string;
    };
    createdAt: string;
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
  createdAt: string;
}

export default function ProvisioningView() {
  const { token } = useAuth();
  const toast = useToast();
  const [items, setItems] = useState<ProvisioningItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Set<string>>(new Set());

  useEffect(() => {
    loadPendingProvisioning();
  }, []);

  const loadPendingProvisioning = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/pending-provisioning`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setItems(data.data || []);
      }
    } catch (error) {
      console.error('Error loading pending provisioning:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleProvision = async (itemId: string) => {
    setProcessing(prev => new Set(prev).add(itemId));
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/items/${itemId}/provision`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        toast.success('Access Provisioned', 'The user has been granted access to the system.');
        await loadPendingProvisioning();
      } else {
        const error = await response.json();
        toast.error('Provisioning Failed', error.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error provisioning item:', error);
      toast.error('Provisioning Failed', 'Failed to provision item. Please try again.');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const handleReject = async (itemId: string, requestId: string) => {
    const reason = prompt('Reason for rejection (optional):');
    if (reason === null) return;

    setProcessing(prev => new Set(prev).add(itemId));
    try {
      const response = await fetch(`${API_BASE}/api/v1/access-requests/${requestId}/items/${itemId}/reject`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ note: reason || undefined }),
      });

      if (response.ok) {
        toast.success('Request Rejected', 'The access request has been rejected.');
        await loadPendingProvisioning();
      } else {
        const error = await response.json();
        toast.error('Rejection Failed', error.message || 'Unknown error');
      }
    } catch (error) {
      console.error('Error rejecting item:', error);
      toast.error('Rejection Failed', 'Failed to reject item. Please try again.');
    } finally {
      setProcessing(prev => {
        const next = new Set(prev);
        next.delete(itemId);
        return next;
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'requested') {
      return (
        <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/60 border border-white/[0.08] flex items-center gap-1.5">
          <Clock size={14} />
          Awaiting Approval
        </span>
      );
    } else if (statusLower === 'approved') {
      return (
        <span className="px-3 py-1.5 rounded-md text-xs font-medium bg-white/[0.03] text-white/70 border border-white/[0.1] flex items-center gap-1.5">
          <CheckCircle2 size={14} />
          Ready to Provision
        </span>
      );
    }
    return null;
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
            <Package className="text-white/60" size={24} />
            Pending Provisions
          </motion.h2>
          <p className="text-white/40 text-sm font-light">
            Provision access for approved requests
          </p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-light text-emerald-400">{items.length}</p>
          <p className="text-white/40 text-sm">Pending Items</p>
        </div>
      </motion.div>

      {items.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
            <CheckCircle2 size={28} className="text-white/40" />
          </div>
          <h3 className="text-lg font-light text-white mb-2">All Caught Up</h3>
          <p className="text-white/40 font-light text-sm">No pending requests at this time</p>
        </motion.div>
      ) : (

      <div className="grid gap-4">
        {items.map((item, index) => (
          <motion.div
            key={item.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ y: -1 }}
            className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-5 hover:border-white/[0.12] hover:bg-[#141414] transition-all duration-300"
          >
            <div className="flex items-start justify-between mb-5">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                    <Shield size={18} className="text-white/50" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-white mb-0.5">
                      {item.systemInstance.system.name} • {item.systemInstance.name}
                    </p>
                    <p className="text-xs text-white/40 font-light">
                      {item.accessTier.name} Access Tier
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 text-sm">
                  <p className="text-white/60">
                    <span className="text-white/40">For:</span> {item.accessRequest.targetUser.name} ({item.accessRequest.targetUser.email})
                  </p>
                  <p className="text-white/60">
                    <span className="text-white/40">By:</span> {item.accessRequest.requester.name} ({item.accessRequest.requester.email})
                  </p>
                  <p className="text-xs text-white/30 font-light">
                    Requested {formatDate(item.accessRequest.createdAt)}
                  </p>
                </div>
              </div>
              {getStatusBadge(item.status)}
            </div>

            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleProvision(item.id)}
                disabled={processing.has(item.id)}
                className="flex-1 px-5 py-2.5 rounded-lg bg-white text-black font-medium text-sm flex items-center justify-center gap-2 hover:bg-white/90 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processing.has(item.id) ? (
                  <>
                    <motion.div
                      className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full"
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    />
                    Provisioning...
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    Provision Access
                  </>
                )}
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={() => handleReject(item.id, item.accessRequest.id)}
                disabled={processing.has(item.id)}
                className="flex-1 px-5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm flex items-center justify-center gap-2 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <XCircle size={16} />
                Reject
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
      )}
    </div>
  );
}
