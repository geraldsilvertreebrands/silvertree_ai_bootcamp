import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Copy, CheckCircle2, Clock, XCircle, Sparkles } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import Card from '../ui/Card';
import Button from '../ui/Button';
import { formatDate } from '../../lib/utils';

interface AccessGrant {
  id: string;
  userId: string;
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

interface AccessRequest {
  id: string;
  status: string;
  items: Array<{
    id: string;
    status: string;
    systemInstance: {
      name: string;
      system: { name: string };
    };
    accessTier: { name: string };
  }>;
  createdAt: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function MyAccessView() {
  const { token } = useAuth();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [grantsRes, requestsRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/users/my-grants`, { headers }),
        fetch(`${API_BASE}/api/v1/access-requests`, { headers }),
      ]);

      if (grantsRes.ok) {
        const grantsData = await grantsRes.json();
        setGrants(grantsData.data || []);
      }

      if (requestsRes.ok) {
        const requestsData = await requestsRes.json();
        setRequests(requestsData.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-green-500/10 text-green-400 border-green-500/20';
      case 'requested':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'approved':
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-white/5 text-white/60 border-white/10';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 size={16} />;
      case 'requested':
        return <Clock size={16} />;
      case 'approved':
        return <CheckCircle2 size={16} />;
      case 'rejected':
        return <XCircle size={16} />;
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
          className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Actions */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between mb-8"
      >
        <div>
          <motion.h2
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl font-bold gradient-text mb-2 flex items-center gap-3"
          >
            <Sparkles className="text-blue-400" size={28} />
            Current Access
          </motion.h2>
          <p className="text-white/60 text-lg font-medium">Your active system access permissions</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="px-6 py-3 rounded-lg bg-blue-600 text-white font-medium flex items-center gap-2 hover:bg-blue-700 transition-colors"
          >
            <Plus size={20} />
            Request Access
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="px-6 py-3 rounded-xl bg-white/5 border border-white/10 text-white font-semibold flex items-center gap-2 hover:bg-white/10 transition-all"
          >
            <Copy size={20} />
            Copy from User
          </motion.button>
        </div>
      </motion.div>

      {/* Access Grants */}
      <div>
        <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Shield size={20} className="text-indigo-400" />
          Active Grants ({grants.length})
        </h3>
        
        <AnimatePresence>
          {grants.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="glass-dark-elevated rounded-3xl p-12 text-center relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-purple-500/10 to-pink-500/10" />
              <div className="w-20 h-20 mx-auto mb-6 rounded-xl bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                <Shield size={40} className="text-blue-400" />
              </div>
              <h3 className="text-2xl font-bold text-white mb-2">No Active Access</h3>
              <p className="text-white/60 mb-8 font-medium">Request access to get started</p>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="px-8 py-4 rounded-lg bg-blue-600 text-white font-medium flex items-center gap-2 mx-auto hover:bg-blue-700 transition-colors"
              >
                <Plus size={20} />
                Request Your First Access
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid gap-4">
              {grants.map((grant, index) => (
                <motion.div
                  key={grant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ scale: 1.01, y: -2 }}
                  className="glass-dark-elevated rounded-xl p-6 group relative"
                >
                  <div className="flex items-start justify-between relative z-10">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-4">
                        <div className="w-12 h-12 rounded-lg bg-blue-600/10 border border-blue-500/20 flex items-center justify-center">
                          <Shield size={24} className="text-blue-400" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-bold text-xl text-white mb-1">
                            {grant.systemInstance.system.name}
                          </h4>
                          <p className="text-sm text-white/60 font-medium">
                            {grant.systemInstance.name} • {grant.accessTier.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <motion.span
                          whileHover={{ scale: 1.05 }}
                          className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${getStatusColor(grant.status)} backdrop-blur-sm`}
                        >
                          {getStatusIcon(grant.status)}
                          {grant.status}
                        </motion.span>
                        <span className="text-xs text-white/50 font-medium">
                          Granted {formatDate(grant.grantedAt)}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Access Requests */}
      {requests.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Clock size={20} className="text-amber-400" />
            Access Requests ({requests.length})
          </h3>
          
          <div className="grid gap-4">
            {requests.map((request, index) => (
              <motion.div
                key={request.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-dark-elevated rounded-2xl p-6"
              >
                <div className="flex items-center justify-between mb-6">
                  <motion.span
                    whileHover={{ scale: 1.05 }}
                    className={`px-4 py-2 rounded-xl text-xs font-bold border flex items-center gap-2 ${getStatusColor(request.status)} backdrop-blur-sm`}
                  >
                    {getStatusIcon(request.status)}
                    {request.status}
                  </motion.span>
                  <span className="text-sm text-white/50 font-medium">
                    {formatDate(request.createdAt)}
                  </span>
                </div>
                <div className="space-y-3">
                  {request.items.map((item) => (
                    <motion.div
                      key={item.id}
                      whileHover={{ x: 4 }}
                      className="p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                    >
                      <p className="font-semibold text-white mb-1">
                        {item.systemInstance.system.name} • {item.systemInstance.name}
                      </p>
                      <p className="text-sm text-white/60 font-medium">{item.accessTier.name}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

