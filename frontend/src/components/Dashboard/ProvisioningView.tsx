import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, XCircle, Clock, Sparkles, Shield } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
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
        // Reload the list
        await loadPendingProvisioning();
      } else {
        const error = await response.json();
        alert(`Failed to provision: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error provisioning item:', error);
      alert('Failed to provision item. Please try again.');
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
    if (reason === null) return; // User cancelled

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
        // Reload the list
        await loadPendingProvisioning();
      } else {
        const error = await response.json();
        alert(`Failed to reject: ${error.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error rejecting item:', error);
      alert('Failed to reject item. Please try again.');
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
        <motion.span
          whileHover={{ scale: 1.05 }}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 flex items-center gap-2"
        >
          <Clock size={16} />
          Awaiting Approval
        </motion.span>
      );
    } else if (statusLower === 'approved') {
      return (
        <motion.span
          whileHover={{ scale: 1.05 }}
          className="px-4 py-2 rounded-lg text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 flex items-center gap-2"
        >
          <CheckCircle2 size={16} />
          Approved - Awaiting Provision
        </motion.span>
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
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  // All items can be provisioned - REQUESTED items will be approved and provisioned in one step
  // APPROVED items will just be provisioned

  if (items.length === 0) {
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
        <p className="text-white/60 text-lg font-medium">No pending requests at this time</p>
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
              Pending Provisions
            </h3>
            <p className="text-white/60 text-lg font-medium">
              {items.length} item(s) awaiting provisioning
            </p>
          </div>
        </div>
      </motion.div>

      {/* All Items - Provision button works for both REQUESTED and APPROVED */}
      <div className="grid gap-6">
        {items.map((item, index) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.01, y: -2 }}
                className="glass-dark-elevated rounded-xl p-6 relative"
              >
                <div className="relative z-10">
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="w-12 h-12 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                          <Shield size={24} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-bold text-xl text-white mb-1">
                            {item.systemInstance.system.name} • {item.systemInstance.name}
                          </p>
                          <p className="text-white/60 font-medium">
                            {item.accessTier.name} Access Tier
                          </p>
                        </div>
                      </div>
                      <div className="ml-0 space-y-2">
                        <p className="text-sm text-white/80">
                          <span className="font-semibold">Requested for:</span> {item.accessRequest.targetUser.name} ({item.accessRequest.targetUser.email})
                        </p>
                        <p className="text-sm text-white/80">
                          <span className="font-semibold">Requested by:</span> {item.accessRequest.requester.name} ({item.accessRequest.requester.email})
                        </p>
                        <p className="text-xs text-white/50 font-medium">
                          Request created {formatDate(item.accessRequest.createdAt)}
                        </p>
                      </div>
                    </div>
                    {getStatusBadge(item.status)}
                  </div>

                  <div className="flex gap-3">
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleProvision(item.id)}
                      disabled={processing.has(item.id)}
                      className="flex-1 px-6 py-3 rounded-lg bg-green-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {processing.has(item.id) ? (
                        <>
                          <motion.div
                            className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full"
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          />
                          Provisioning...
                        </>
                      ) : (
                        <>
                          <CheckCircle2 size={20} />
                          Provision Access
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleReject(item.id, item.accessRequest.id)}
                      disabled={processing.has(item.id)}
                      className="flex-1 px-6 py-3 rounded-lg bg-red-600 text-white font-medium flex items-center justify-center gap-2 hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
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
