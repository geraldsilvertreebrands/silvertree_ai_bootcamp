import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Shield, Plus, Copy, CheckCircle2, Clock, XCircle, X, Search, Filter } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatDate } from '../../lib/utils';

interface AccessGrant {
  id: string;
  userId: string;
  systemInstanceId?: string;
  accessTierId?: string;
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

export default function MyAccessView() {
  const { token, user } = useAuth();
  const toast = useToast();
  const [grants, setGrants] = useState<AccessGrant[]>([]);
  const [requests, setRequests] = useState<AccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal states
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [showCopyModal, setShowCopyModal] = useState(false);

  // Request Access form state
  const [systems, setSystems] = useState<System[]>([]);
  const [instances, setInstances] = useState<SystemInstance[]>([]);
  const [tiers, setTiers] = useState<AccessTier[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedSystem, setSelectedSystem] = useState('');
  const [selectedInstance, setSelectedInstance] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedUser, setSelectedUser] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Copy from User form state
  const [sourceUser, setSourceUser] = useState('');
  const [targetUser, setTargetUser] = useState('');
  const [sourceGrants, setSourceGrants] = useState<AccessGrant[]>([]);
  const [selectedGrantIds, setSelectedGrantIds] = useState<Set<string>>(new Set());
  const [loadingGrants, setLoadingGrants] = useState(false);

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
        fetch(`${API_BASE}/api/v1/users/me/grants`, { headers }),
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

  const activeGrants = useMemo(() => {
    let filtered = grants.filter(grant => grant.status.toLowerCase() === 'active');

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(grant =>
        grant.systemInstance?.system?.name?.toLowerCase().includes(search) ||
        grant.systemInstance?.name?.toLowerCase().includes(search) ||
        grant.accessTier?.name?.toLowerCase().includes(search)
      );
    }

    return filtered;
  }, [grants, searchTerm]);

  const pendingRequests = useMemo(() => {
    let filtered = requests.filter(request => {
      const status = request.status.toLowerCase();
      return status === 'requested';
    });

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        request.items.some(item =>
          item.systemInstance?.system?.name?.toLowerCase().includes(search) ||
          item.systemInstance?.name?.toLowerCase().includes(search) ||
          item.accessTier?.name?.toLowerCase().includes(search)
        )
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  const rejectedRequests = useMemo(() => {
    let filtered = requests.filter(request => request.status.toLowerCase() === 'rejected');

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(request =>
        request.items.some(item =>
          item.systemInstance?.system?.name?.toLowerCase().includes(search) ||
          item.systemInstance?.name?.toLowerCase().includes(search) ||
          item.accessTier?.name?.toLowerCase().includes(search)
        )
      );
    }

    return filtered;
  }, [requests, searchTerm]);

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'requested':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'approved':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'rejected':
        return 'bg-red-500/10 text-red-400 border-red-500/20';
      default:
        return 'bg-white/[0.02] text-white/50 border-white/[0.06]';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'active':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'requested':
        return <Clock size={14} className="text-amber-400" />;
      case 'approved':
        return <CheckCircle2 size={14} className="text-emerald-400" />;
      case 'rejected':
        return <XCircle size={14} className="text-red-400" />;
      default:
        return null;
    }
  };

  // Load systems and users when opening Request Access modal
  const openRequestModal = async () => {
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
        // Set current user as default
        if (user?.id) {
          setSelectedUser(user.id);
        }
      }

      setShowRequestModal(true);
    } catch (error) {
      console.error('Error loading form data:', error);
      toast.error('Failed to load data', 'Please try again.');
    }
  };

  // Load instances and tiers when system changes
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

  // Submit access request
  const handleRequestAccess = async (e: React.FormEvent) => {
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

      const requestBody = {
        targetUserId: selectedUser,
        items: [{
          systemInstanceId: selectedInstance,
          accessTierId: selectedTier,
        }],
      };

      const response = await fetch(`${API_BASE}/api/v1/access-requests`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to create access request');
      }

      const result = await response.json();
      const status = result.status || 'requested';

      if (status === 'approved') {
        toast.success('Request Auto-Approved', 'Your request has been auto-approved and is awaiting provisioning.');
      } else {
        toast.success('Request Submitted', 'Your request has been submitted and is awaiting manager approval.');
      }

      setShowRequestModal(false);
      resetRequestForm();
      loadData();
    } catch (error) {
      toast.error('Request Failed', error instanceof Error ? error.message : 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  const resetRequestForm = () => {
    setSelectedSystem('');
    setSelectedInstance('');
    setSelectedTier('');
    setSelectedUser(user?.id || '');
    setInstances([]);
    setTiers([]);
  };

  // Copy from User functionality
  const openCopyModal = async () => {
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const usersRes = await fetch(`${API_BASE}/api/v1/users`, { headers });
      if (usersRes.ok) {
        const data = await usersRes.json();
        setUsers(data.data || data || []);
        if (user?.id) {
          setTargetUser(user.id);
        }
      }

      setShowCopyModal(true);
    } catch (error) {
      console.error('Error loading users:', error);
      toast.error('Failed to load users', 'Please try again.');
    }
  };

  // Load source user's grants
  const handleSourceUserChange = async (userId: string) => {
    setSourceUser(userId);
    setSourceGrants([]);
    setSelectedGrantIds(new Set());

    if (!userId) return;

    setLoadingGrants(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      const response = await fetch(
        `${API_BASE}/api/v1/access-overview?userId=${userId}&status=active&limit=1000`,
        { headers }
      );

      if (response.ok) {
        const data = await response.json();
        const grants = data.data || [];
        setSourceGrants(grants);
        // Select all grants by default
        const allIds = new Set<string>(grants.map((g: AccessGrant) =>
          `${g.systemInstanceId || g.systemInstance?.id}-${g.accessTierId || g.accessTier?.id}`
        ));
        setSelectedGrantIds(allIds);
      }
    } catch (error) {
      console.error('Error loading grants:', error);
    } finally {
      setLoadingGrants(false);
    }
  };

  const toggleGrantSelection = (grantKey: string) => {
    const newSet = new Set(selectedGrantIds);
    if (newSet.has(grantKey)) {
      newSet.delete(grantKey);
    } else {
      newSet.add(grantKey);
    }
    setSelectedGrantIds(newSet);
  };

  // Submit copy from user
  const handleCopyFromUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!sourceUser || !targetUser) {
      toast.warning('Missing selection', 'Please select both source and target users');
      return;
    }

    if (sourceUser === targetUser) {
      toast.warning('Invalid selection', 'Source and target users cannot be the same');
      return;
    }

    if (selectedGrantIds.size === 0) {
      toast.warning('No grants selected', 'Please select at least one grant to copy');
      return;
    }

    setSubmitting(true);
    try {
      const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      };

      // Get unique system IDs from selected grants
      const selectedGrants = sourceGrants.filter(g => {
        const key = `${g.systemInstanceId || g.systemInstance?.id}-${g.accessTierId || g.accessTier?.id}`;
        return selectedGrantIds.has(key);
      });
      const systemIds = [...new Set(selectedGrants.map(g => g.systemInstance?.system?.id).filter(Boolean))];

      const requestBody: {
        sourceUserId: string;
        targetUserId: string;
        systemIds?: string[];
      } = {
        sourceUserId: sourceUser,
        targetUserId: targetUser,
      };

      if (systemIds.length > 0) {
        requestBody.systemIds = systemIds;
      }

      const response = await fetch(`${API_BASE}/api/v1/access-requests/copy-from-user`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || 'Failed to copy grants');
      }

      const result = await response.json();
      const created = result.summary?.created || 0;
      const autoApproved = result.summary?.autoApproved || 0;

      toast.success(
        'Access Copied Successfully',
        `Created ${created} request(s)${autoApproved > 0 ? `, ${autoApproved} auto-approved` : ''}`
      );

      setShowCopyModal(false);
      resetCopyForm();
      loadData();
    } catch (error) {
      toast.error('Copy Failed', error instanceof Error ? error.message : 'Failed to copy grants');
    } finally {
      setSubmitting(false);
    }
  };

  const resetCopyForm = () => {
    setSourceUser('');
    setTargetUser(user?.id || '');
    setSourceGrants([]);
    setSelectedGrantIds(new Set());
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
    <div className="space-y-12">
      {/* Header Actions */}
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
            <Shield className="text-white/60" size={24} />
            My Access
          </motion.h2>
          <p className="text-white/40 text-sm font-light">View and manage your access permissions</p>
        </div>
        <div className="flex gap-3">
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={openRequestModal}
            className="px-5 py-2.5 rounded-lg bg-white text-black font-medium text-sm flex items-center gap-2 hover:bg-white/90 transition-all duration-300"
          >
            <Plus size={16} />
            Request Access
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={openCopyModal}
            className="px-5 py-2.5 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm flex items-center gap-2 hover:bg-white/[0.05] hover:border-white/[0.12] transition-all duration-300"
          >
            <Copy size={16} />
            Copy from User
          </motion.button>
        </div>
      </motion.div>

      {/* Search and Filter */}
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
            placeholder="Search by system, instance, or tier..."
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
            <option value="all">All Sections</option>
            <option value="active">Current Access Only</option>
            <option value="pending">Pending Only</option>
            <option value="rejected">Rejected Only</option>
          </select>
        </div>
      </motion.div>

      {/* Section 1: Current Access */}
      {(statusFilter === 'all' || statusFilter === 'active') && (
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
          <Shield size={16} className="text-white/40" />
          Current Access
          <span className="text-white/30 font-light normal-case tracking-normal">({activeGrants.length})</span>
        </h3>

        <AnimatePresence>
          {activeGrants.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
            >
              <div className="w-16 h-16 mx-auto mb-6 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                <Shield size={28} className="text-white/40" />
              </div>
              <h3 className="text-lg font-light text-white mb-2">No Active Access</h3>
              <p className="text-white/40 mb-8 font-light text-sm">Request access to get started</p>
              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                onClick={openRequestModal}
                className="px-6 py-3 rounded-lg bg-white text-black font-medium text-sm flex items-center gap-2 mx-auto hover:bg-white/90 transition-all duration-300"
              >
                <Plus size={16} />
                Request Your First Access
              </motion.button>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {activeGrants.map((grant, index) => (
                <motion.div
                  key={grant.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -1 }}
                  className="rounded-lg border border-white/[0.08] bg-[#0f0f0f] p-5 hover:border-white/[0.12] hover:bg-[#141414] transition-all duration-300"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-4 mb-3">
                        <div className="w-10 h-10 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                          <Shield size={18} className="text-white/50" />
                        </div>
                        <div className="flex-1">
                          <h4 className="font-medium text-white mb-0.5">
                            {grant.systemInstance.system.name}
                          </h4>
                          <p className="text-xs text-white/40 font-light">
                            {grant.systemInstance.name} • {grant.accessTier.name}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span
                          className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(grant.status)}`}
                        >
                          {getStatusIcon(grant.status)}
                          {grant.status}
                        </span>
                        <span className="text-xs text-white/30 font-light">
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
      )}

      {/* Section 2: Pending Requests */}
      {(statusFilter === 'all' || statusFilter === 'pending') && (
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
          <Clock size={16} className="text-white/40" />
          Pending Requests
          <span className="text-white/30 font-light normal-case tracking-normal">({pendingRequests.length})</span>
        </h3>

        <AnimatePresence>
          {pendingRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                <Clock size={24} className="text-white/40" />
              </div>
              <h3 className="text-lg font-light text-white mb-2">No Pending Requests</h3>
              <p className="text-white/40 font-light text-sm">All your access requests have been processed</p>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {pendingRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -1 }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.1] transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(request.status)}`}
                    >
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                    <span className="text-xs text-white/30 font-light">
                      {formatDate(request.createdAt)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {request.items.map((item) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ x: 2 }}
                        className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all duration-300"
                      >
                        <p className="font-medium text-white text-sm mb-0.5">
                          {item.systemInstance.system.name} • {item.systemInstance.name}
                        </p>
                        <p className="text-xs text-white/40 font-light">{item.accessTier.name}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Section 3: Rejected Requests */}
      {(statusFilter === 'all' || statusFilter === 'rejected') && (
      <div>
        <h3 className="text-sm font-medium text-white/60 mb-4 flex items-center gap-2 uppercase tracking-[0.1em]">
          <XCircle size={16} className="text-white/40" />
          Rejected Requests
          <span className="text-white/30 font-light normal-case tracking-normal">({rejectedRequests.length})</span>
        </h3>

        <AnimatePresence>
          {rejectedRequests.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-12 text-center"
            >
              <div className="w-14 h-14 mx-auto mb-4 rounded-lg border border-white/[0.1] bg-white/[0.02] flex items-center justify-center">
                <XCircle size={24} className="text-white/40" />
              </div>
              <h3 className="text-lg font-light text-white mb-2">No Rejected Requests</h3>
              <p className="text-white/40 font-light text-sm">All your requests have been approved or are pending</p>
            </motion.div>
          ) : (
            <div className="grid gap-3">
              {rejectedRequests.map((request, index) => (
                <motion.div
                  key={request.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  whileHover={{ y: -1 }}
                  className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-5 hover:border-white/[0.1] transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span
                      className={`px-3 py-1.5 rounded-md text-xs font-medium border flex items-center gap-1.5 ${getStatusColor(request.status)}`}
                    >
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                    <span className="text-xs text-white/30 font-light">
                      {formatDate(request.createdAt)}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {request.items.map((item) => (
                      <motion.div
                        key={item.id}
                        whileHover={{ x: 2 }}
                        className="p-3 rounded-md bg-white/[0.02] border border-white/[0.06] hover:bg-white/[0.04] transition-all duration-300"
                      >
                        <p className="font-medium text-white text-sm mb-0.5">
                          {item.systemInstance.system.name} • {item.systemInstance.name}
                        </p>
                        <p className="text-xs text-white/40 font-light">{item.accessTier.name}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </AnimatePresence>
      </div>
      )}

      {/* Request Access Modal */}
      <AnimatePresence>
        {showRequestModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowRequestModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-light text-white">Request Access</h2>
                <button
                  onClick={() => setShowRequestModal(false)}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X size={20} className="text-white/60" />
                </button>
              </div>

              <form onSubmit={handleRequestAccess} className="space-y-6">
                {/* System Selection - Block Style */}
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-3">
                    Select System
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
                    Select Instance
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
                    Select Access Tier
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
                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRequestModal(false);
                      resetRequestForm();
                    }}
                    className="flex-1 px-5 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !selectedInstance || !selectedTier}
                    className="flex-1 px-5 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Requesting...' : 'Request Access'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Copy from User Modal */}
      <AnimatePresence>
        {showCopyModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={() => setShowCopyModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-[#0a0a0a] border border-white/[0.08] rounded-xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-light text-white">Copy Access from User</h2>
                <button
                  onClick={() => setShowCopyModal(false)}
                  className="p-2 hover:bg-white/[0.05] rounded-lg transition-colors"
                >
                  <X size={20} className="text-white/60" />
                </button>
              </div>

              <form onSubmit={handleCopyFromUser} className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Copy from (Source User) *
                  </label>
                  <select
                    value={sourceUser}
                    onChange={(e) => handleSourceUserChange(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors"
                  >
                    <option value="">Select source user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-1">User whose access will be copied</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/70 mb-2">
                    Copy to (Target User) *
                  </label>
                  <select
                    value={targetUser}
                    onChange={(e) => setTargetUser(e.target.value)}
                    required
                    className="w-full px-4 py-3 bg-white/[0.03] border border-white/[0.08] rounded-lg text-white focus:border-white/20 focus:outline-none transition-colors"
                  >
                    <option value="">Select target user...</option>
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-white/40 mt-1">User who will receive the copied access</p>
                </div>

                {sourceUser && (
                  <div>
                    <label className="block text-sm font-medium text-white/70 mb-2">
                      Select Grants to Copy
                    </label>
                    <div className="max-h-64 overflow-y-auto border border-white/[0.08] rounded-lg bg-white/[0.02]">
                      {loadingGrants ? (
                        <div className="flex items-center justify-center p-8">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full"
                          />
                        </div>
                      ) : sourceGrants.length === 0 ? (
                        <p className="text-white/40 text-center p-8 text-sm">
                          Source user has no active grants to copy.
                        </p>
                      ) : (
                        <div className="divide-y divide-white/[0.06]">
                          {sourceGrants.map((grant) => {
                            const grantKey = `${grant.systemInstanceId || grant.systemInstance?.id}-${grant.accessTierId || grant.accessTier?.id}`;
                            const isSelected = selectedGrantIds.has(grantKey);
                            return (
                              <label
                                key={grant.id}
                                className="flex items-center gap-3 p-3 hover:bg-white/[0.03] cursor-pointer transition-colors"
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleGrantSelection(grantKey)}
                                  className="w-4 h-4 rounded border-white/20 bg-white/[0.05] text-white focus:ring-0 focus:ring-offset-0"
                                />
                                <div className="flex-1">
                                  <p className="text-sm font-medium text-white">
                                    {grant.systemInstance?.system?.name || 'Unknown System'}
                                  </p>
                                  <p className="text-xs text-white/40">
                                    {grant.systemInstance?.name || 'Unknown'} • {grant.accessTier?.name || 'Unknown'}
                                  </p>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-white/40 mt-1">
                      Check the grants you want to copy. Unchecked grants will be excluded.
                    </p>
                  </div>
                )}

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCopyModal(false);
                      resetCopyForm();
                    }}
                    className="flex-1 px-5 py-3 rounded-lg bg-white/[0.03] border border-white/[0.08] text-white/80 font-light text-sm hover:bg-white/[0.05] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting || !sourceUser || !targetUser || selectedGrantIds.size === 0}
                    className="flex-1 px-5 py-3 rounded-lg bg-white text-black font-medium text-sm hover:bg-white/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Copying...' : 'Copy Access'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
