import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Filter, Check, X, ChevronDown, Shield, Trash2,
  UserCheck, UserX, Clock, MoreVertical, Mail, Phone
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import { RoleBadge, ApprovalBadge } from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Modal from '../../components/ui/Modal';
import { TableSkeleton } from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { supabase } from '../../config/supabase';
import { Profile, UserRole } from '../../types';

const roleOptions: UserRole[] = ['student', 'class_rep', 'teacher', 'dept_admin', 'super_admin'];
const statusOptions = ['all', 'pending', 'approved', 'rejected'] as const;

export default function SuperAdminUsersPage() {
  const [users, setUsers] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      let query = supabase.from('profiles').select('*').order('created_at', { ascending: false });
      if (roleFilter !== 'all') query = query.eq('role', roleFilter);
      if (statusFilter !== 'all') query = query.eq('approval_status', statusFilter);
      const { data } = await query;
      setUsers((data || []) as Profile[]);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setIsLoading(false);
    }
  }, [roleFilter, statusFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter(u => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.full_name?.toLowerCase().includes(q) ||
      u.phone?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  });

  const handleApproval = async (userId: string, status: 'approved' | 'rejected') => {
    setActionLoading(userId);
    try {
      await supabase.from('profiles').update({ approval_status: status }).eq('id', userId);
      fetchUsers();
    } catch (err) {
      console.error('Approval action failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleRoleChange = async (userId: string, newRole: UserRole) => {
    setActionLoading(userId);
    try {
      await supabase.from('profiles').update({ role: newRole }).eq('id', userId);
      fetchUsers();
    } catch (err) {
      console.error('Role change failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeleteUser = async () => {
    if (!selectedUser) return;
    setActionLoading(selectedUser.id);
    try {
      // Delete profile (cascades from auth.users FK)
      await supabase.from('profiles').delete().eq('id', selectedUser.id);
      setShowDeleteConfirm(false);
      setShowDetailModal(false);
      setSelectedUser(null);
      fetchUsers();
    } catch (err) {
      console.error('Delete failed:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const pendingCount = users.filter(u => u.approval_status === 'pending').length;

  return (
    <DashboardLayout
      title="User Management"
      subtitle={`${users.length} users total · ${pendingCount} pending approval`}
    >
      {/* Filters Bar */}
      <div className="card mb-5">
        <div className="p-4 flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, phone, or role..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>

          {/* Role Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={roleFilter}
              onChange={(e) => setRoleFilter(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none min-w-[140px]"
            >
              <option value="all">All Roles</option>
              {roleOptions.map(r => (
                <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>

          {/* Status Filter */}
          <div className="relative">
            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="input-field pl-10 pr-8 appearance-none min-w-[140px]"
            >
              {statusOptions.map(s => (
                <option key={s} value={s}>{s === 'all' ? 'All Statuses' : s.replace(/\b\w/g, c => c.toUpperCase())}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Total Users', count: users.length, icon: <Users className="w-4 h-4 text-blue-600" />, bg: 'bg-blue-50' },
          { label: 'Pending', count: pendingCount, icon: <Clock className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50' },
          { label: 'Approved', count: users.filter(u => u.approval_status === 'approved').length, icon: <UserCheck className="w-4 h-4 text-green-600" />, bg: 'bg-green-50' },
          { label: 'Rejected', count: users.filter(u => u.approval_status === 'rejected').length, icon: <UserX className="w-4 h-4 text-red-600" />, bg: 'bg-red-50' },
        ].map(s => (
          <div key={s.label} className="card p-4 flex items-center gap-3">
            <div className={`p-2 rounded-lg ${s.bg}`}>{s.icon}</div>
            <div>
              <p className="text-lg font-bold text-gray-900">{s.count}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Users Table */}
      <div className="card">
        {isLoading ? <TableSkeleton rows={8} /> : filteredUsers.length === 0 ? (
          <EmptyState title="No users found" icon={<Users className="w-5 h-5 text-gray-400" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="table-th">User</th>
                  <th className="table-th">Role</th>
                  <th className="table-th">Status</th>
                  <th className="table-th hidden md:table-cell">Phone</th>
                  <th className="table-th hidden lg:table-cell">Joined</th>
                  <th className="table-th">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="table-row hover:bg-gray-50/50 cursor-pointer" onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}>
                    <td className="table-td">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={u.full_name || 'U'} size="sm" />
                        <div>
                          <p className="text-sm font-medium text-gray-900">{u.full_name || 'Unknown'}</p>
                          <p className="text-xxs text-gray-400 hidden sm:block">{u.id.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td className="table-td"><RoleBadge role={u.role} /></td>
                    <td className="table-td"><ApprovalBadge status={u.approval_status} /></td>
                    <td className="table-td hidden md:table-cell text-xs text-gray-500">{u.phone || '—'}</td>
                    <td className="table-td hidden lg:table-cell text-xs text-gray-500">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="table-td" onClick={(e) => e.stopPropagation()}>
                      {u.approval_status === 'pending' ? (
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => handleApproval(u.id, 'approved')}
                            disabled={actionLoading === u.id}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg border border-green-200 transition-colors disabled:opacity-50"
                            title="Approve"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleApproval(u.id, 'rejected')}
                            disabled={actionLoading === u.id}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-colors disabled:opacity-50"
                            title="Reject"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelectedUser(u); setShowDetailModal(true); }}
                          className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
                        >
                          <MoreVertical className="w-4 h-4 text-gray-400" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => { setShowDetailModal(false); setSelectedUser(null); }} title="User Details" size="md">
        {selectedUser && (
          <div className="space-y-5">
            {/* User Info Header */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl">
              <Avatar name={selectedUser.full_name || 'U'} size="lg" />
              <div>
                <h3 className="text-lg font-bold text-gray-900">{selectedUser.full_name}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <RoleBadge role={selectedUser.role} />
                  <ApprovalBadge status={selectedUser.approval_status} />
                </div>
              </div>
            </div>

            {/* Contact Info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Phone className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700">{selectedUser.phone || 'No phone'}</span>
              </div>
              <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg">
                <Mail className="w-4 h-4 text-gray-400" />
                <span className="text-sm text-gray-700 truncate">{selectedUser.id.slice(0, 12)}...</span>
              </div>
            </div>

            {/* Change Role */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1.5">Change Role</label>
              <select
                value={selectedUser.role}
                onChange={(e) => {
                  handleRoleChange(selectedUser.id, e.target.value as UserRole);
                  setSelectedUser({ ...selectedUser, role: e.target.value as UserRole });
                }}
                className="input-field"
              >
                {roleOptions.map(r => (
                  <option key={r} value={r}>{r.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>
                ))}
              </select>
            </div>

            {/* Approval Actions */}
            {selectedUser.approval_status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => { handleApproval(selectedUser.id, 'approved'); setSelectedUser({ ...selectedUser, approval_status: 'approved' }); }}
                  className="btn-primary flex-1 justify-center"
                >
                  <Check className="w-4 h-4" /> Approve User
                </button>
                <button
                  onClick={() => { handleApproval(selectedUser.id, 'rejected'); setSelectedUser({ ...selectedUser, approval_status: 'rejected' }); }}
                  className="btn-secondary flex-1 justify-center text-red-600 border-red-200 hover:bg-red-50"
                >
                  <X className="w-4 h-4" /> Reject User
                </button>
              </div>
            )}

            {/* Danger Zone */}
            <div className="pt-3 border-t border-gray-100">
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="btn-secondary w-full justify-center text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> Delete User Account
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete Confirmation Modal */}
      <Modal isOpen={showDeleteConfirm} onClose={() => setShowDeleteConfirm(false)} title="Confirm Deletion" size="sm">
        <div className="space-y-4">
          <div className="bg-red-50 border border-red-100 rounded-xl p-4">
            <p className="text-sm text-red-700">
              Are you sure you want to delete <strong>{selectedUser?.full_name}</strong>'s account?
              This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowDeleteConfirm(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button
              onClick={handleDeleteUser}
              disabled={!!actionLoading}
              className="flex-1 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {actionLoading ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <><Trash2 className="w-4 h-4" /> Delete</>}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
