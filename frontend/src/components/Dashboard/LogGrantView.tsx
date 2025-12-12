import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Shield, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';

interface System {
  id: string;
  name: string;
}

interface SystemInstance {
  id: string;
  name: string;
}

interface AccessTier {
  id: string;
  name: string;
}

interface User {
  id: string;
  name: string;
  email: string;
}

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:3000';

export default function LogGrantView() {
  const { token } = useAuth();
  const toast = useToast();

  // Form state
  const [systems, setSystems] = useState<System[]>([]);
  const [instances, setInstances] = useState<SystemInstance[]>([]);
  const [tiers, setTiers] = useState<AccessTier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedSystem, setSelectedSystem] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [systemsRes, usersRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/systems`, { headers }),
        fetch(`${API_BASE}/api/v1/users`, { headers }),
      ]);

      if (systemsRes.ok) {
        const data = await systemsRes.json();
        setSystems(data.data || data || []);
      }

      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('Failed to load data', 'Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleSystemChange = async (systemId: string) => {
    setSelectedSystem(systemId);
    setSelectedInstance('');
    setSelectedTier('');
    setInstances([]);
    setTiers([]);

    if (!systemId) return;

    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const [instancesRes, tiersRes] = await Promise.all([
        fetch(`${API_BASE}/api/v1/systems/${systemId}/instances`, { headers }),
        fetch(`${API_BASE}/api/v1/systems/${systemId}/access-tiers`, { headers }),
      ]);

      if (instancesRes.ok) {
        const data = await instancesRes.json();
        setInstances(data.data || data || []);
      }

      if (tiersRes.ok) {
        const data = await tiersRes.json();
        setTiers(data.data || data || []);
      }
    } catch (error) {
      console.error('Error loading system data:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser || !selectedInstance || !selectedTier) {
      toast.warning('Missing fields', 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(`${API_BASE}/api/v1/access-grants`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          userId: selectedUser,
          systemInstanceId: selectedInstance,
          accessTierId: selectedTier,
          status: 'active',
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create access grant');
      }

      toast.success('Access Grant Created', 'The user has been granted access to the system.');
      resetForm();
    } catch (error) {
      toast.error('Grant Failed', error instanceof Error ? error.message : 'Failed to create grant');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setSelectedSystem('');
    setSelectedInstance('');
    setSelectedTier('');
    setSelectedUser('');
    setInstances([]);
    setTiers([]);
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
    <div className="space-y-8 max-w-3xl mx-auto">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <motion.h2
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="text-2xl font-light text-white mb-1 flex items-center gap-3"
        >
          <Plus className="text-white/60" size={24} />
          Log Access Grant
        </motion.h2>
        <p className="text-white/40 text-sm font-light">
          Manually grant access to a user without going through the request workflow
        </p>
      </motion.div>

      {/* Form */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-6"
      >
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* User Selection */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-2">
              User *
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              required
              className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors"
            >
              <option value="">Select user...</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email})
                </option>
              ))}
            </select>
          </div>

          {/* System Selection - Block Style */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Select System *
            </label>
            <div className="grid grid-cols-2 gap-2">
              {systems.map((s) => {
                const isSelected = selectedSystem === s.id;
                return (
                  <motion.button
                    key={s.id}
                    type="button"
                    onClick={() => handleSystemChange(s.id)}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                    className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                      isSelected
                        ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                        : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:border-white/[0.1]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${
                        isSelected ? 'bg-emerald-500/20' : 'bg-white/[0.03]'
                      }`}>
                        <Shield size={16} className={isSelected ? 'text-emerald-400' : 'text-white/40'} />
                      </div>
                      <span className="font-medium text-sm">{s.name}</span>
                    </div>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {/* Instance Selection - Block Style */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Select Instance *
            </label>
            <div className={`grid grid-cols-2 gap-2 ${!selectedSystem ? 'opacity-40 pointer-events-none' : ''}`}>
              {!selectedSystem ? (
                <div className="col-span-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center">
                  <p className="text-white/40 text-sm">Select a system first</p>
                </div>
              ) : instances.length === 0 ? (
                <div className="col-span-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center">
                  <p className="text-white/40 text-sm">No instances available</p>
                </div>
              ) : (
                instances.map((i) => {
                  const isSelected = selectedInstance === i.id;
                  return (
                    <motion.button
                      key={i.id}
                      type="button"
                      onClick={() => setSelectedInstance(i.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:border-white/[0.1]'
                      }`}
                    >
                      <span className="font-medium text-sm">{i.name}</span>
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>

          {/* Access Tier Selection - Block Style */}
          <div>
            <label className="block text-sm font-medium text-white/70 mb-3">
              Select Access Tier *
            </label>
            <div className={`grid grid-cols-2 gap-2 ${!selectedInstance ? 'opacity-40 pointer-events-none' : ''}`}>
              {!selectedInstance ? (
                <div className="col-span-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center">
                  <p className="text-white/40 text-sm">Select an instance first</p>
                </div>
              ) : tiers.length === 0 ? (
                <div className="col-span-2 p-4 rounded-lg border border-white/[0.06] bg-white/[0.02] text-center">
                  <p className="text-white/40 text-sm">No tiers available</p>
                </div>
              ) : (
                tiers.map((t) => {
                  const isSelected = selectedTier === t.id;
                  return (
                    <motion.button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTier(t.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`p-4 rounded-lg border text-left transition-all duration-200 ${
                        isSelected
                          ? 'bg-emerald-500/10 border-emerald-500/50 text-white'
                          : 'bg-white/[0.02] border-white/[0.06] text-white/60 hover:bg-white/[0.04] hover:border-white/[0.1]'
                      }`}
                    >
                      <span className="font-medium text-sm">{t.name}</span>
                    </motion.button>
                  );
                })
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={resetForm}
              className="flex-1 px-5 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm hover:bg-white/[0.05] transition-colors"
            >
              Reset
            </button>
            <button
              type="submit"
              disabled={submitting || !selectedUser || !selectedInstance || !selectedTier}
              className="flex-1 px-5 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Creating...' : 'Grant Access'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
