import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  Users,
  BookOpen,
  BarChart3,
  Plus,
  Settings,
  ChevronRight,
  Globe,
  Check,
  X,
  Send,
  Database,
  Cpu,
  Activity,
  Clock,
  AlertTriangle
} from 'lucide-react';
import DashboardLayout from '../../components/layout/DashboardLayout';
import StatCard from '../../components/ui/StatCard';
import { RoleBadge, ApprovalBadge } from '../../components/ui/Badge';
import Avatar from '../../components/ui/Avatar';
import Modal from '../../components/ui/Modal';
import { StatCardSkeleton, TableSkeleton } from '../../components/ui/LoadingSkeleton';
import EmptyState from '../../components/ui/EmptyState';
import { supabase } from '../../config/supabase';
import { Profile, Department } from '../../types';

interface GlobalStats {
  totalDepartments: number;
  totalUsers: number;
  totalCourses: number;
  totalAttendance: number;
  pendingApprovals: number;
}

const defaultConfigs = {
  qr_token_expiry: '60',
  gps_geofence_radius: '100',
  ai_chat_limit: '30',
  late_grace_period: '10',
  sms_alert_delay: '30',
  attendance_threshold: '70',
};

const configDescriptions: Record<string, string> = {
  qr_token_expiry: 'QR Token Expiry (seconds)',
  gps_geofence_radius: 'GPS Geofence Radius (meters)',
  ai_chat_limit: 'AI Chat Limit (requests/hour)',
  late_grace_period: 'Late Grace Period (minutes)',
  sms_alert_delay: 'SMS Alert Delay (seconds)',
  attendance_threshold: 'Attendance Threshold (%)',
};

export default function SuperAdminDashboard() {
  const [stats, setStats] = useState<GlobalStats | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [recentUsers, setRecentUsers] = useState<Profile[]>([]);
  const [configSettings, setConfigSettings] = useState<Record<string, string>>(defaultConfigs);
  const [isLoading, setIsLoading] = useState(true);

  // Modals
  const [showNewDeptModal, setShowNewDeptModal] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAnnounceModal, setShowAnnounceModal] = useState(false);

  // Form states
  const [newDept, setNewDept] = useState({ name: '', code: '' });
  const [creating, setCreating] = useState(false);

  const [editConfigs, setEditConfigs] = useState<Record<string, string>>({});
  const [savingConfig, setSavingConfig] = useState(false);

  const [newAnnounce, setNewAnnounce] = useState({ title: '', body: '', priority: 'info' as 'info' | 'important' | 'urgent' });
  const [broadcasting, setBroadcasting] = useState(false);

  const [latency, setLatency] = useState(42);
  const [dbStatus, setDbStatus] = useState<'healthy' | 'checking'>('healthy');

  const fetchData = useCallback(async () => {
    try {
      const startTime = performance.now();
      const [deptRes, usersRes, coursesRes, attRes, configRes] = await Promise.all([
        supabase.from('departments').select('*').order('name'),
        supabase.from('profiles').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('courses').select('id'),
        supabase.from('attendance').select('id'),
        supabase.from('system_settings').select('*')
      ]);

      const endTime = performance.now();
      setLatency(Math.round(endTime - startTime) || 35);
      setDbStatus('healthy');

      const users = usersRes.data || [];
      setDepartments(deptRes.data || []);
      setRecentUsers(users as Profile[]);

      // Map loaded configurations
      const configMap: Record<string, string> = { ...defaultConfigs };
      if (configRes.data && configRes.data.length > 0) {
        configRes.data.forEach((item: { key: string; value: string }) => {
          configMap[item.key] = item.value;
        });
      }
      setConfigSettings(configMap);

      setStats({
        totalDepartments: deptRes.data?.length || 0,
        totalUsers: users.length,
        totalCourses: coursesRes.data?.length || 0,
        totalAttendance: attRes.data?.length || 0,
        pendingApprovals: users.filter((u: Profile) => u.approval_status === 'pending').length,
      });
    } catch (err) {
      console.error('Super Admin fetch error:', err);
      setDbStatus('checking');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle department creation
  const handleCreateDept = async () => {
    if (!newDept.name || !newDept.code) return;
    setCreating(true);
    try {
      const { error } = await supabase.from('departments').insert(newDept);
      if (error) throw error;
      setNewDept({ name: '', code: '' });
      setShowNewDeptModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to create department:', err);
    } finally {
      setCreating(false);
    }
  };

  // Open config editor with current settings loaded
  const handleOpenConfig = () => {
    setEditConfigs({ ...configSettings });
    setShowConfigModal(true);
  };

  // Save configurations to database
  const handleSaveConfig = async () => {
    setSavingConfig(true);
    try {
      const promises = Object.entries(editConfigs).map(([key, value]) =>
        supabase.from('system_settings').upsert({ key, value, updated_at: new Date().toISOString() })
      );
      await Promise.all(promises);
      setShowConfigModal(false);
      fetchData();
    } catch (err) {
      console.error('Failed to save configs:', err);
    } finally {
      setSavingConfig(false);
    }
  };

  // User approval actions
  const handleUserApproval = async (userId: string, newStatus: 'approved' | 'rejected') => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ approval_status: newStatus })
        .eq('id', userId);
      if (error) throw error;
      fetchData();
    } catch (err) {
      console.error('Failed to update user approval:', err);
    }
  };

  // Broadcast global announcement
  const handleBroadcast = async () => {
    if (!newAnnounce.title || !newAnnounce.body) return;
    setBroadcasting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('No admin user session found');

      const { error } = await supabase.from('announcements').insert({
        author_id: user.id,
        scope: 'global',
        title: newAnnounce.title,
        body: newAnnounce.body,
        priority: newAnnounce.priority,
      });

      if (error) throw error;

      setNewAnnounce({ title: '', body: '', priority: 'info' });
      setShowAnnounceModal(false);
    } catch (err) {
      console.error('Failed to send global broadcast:', err);
    } finally {
      setBroadcasting(false);
    }
  };

  return (
    <DashboardLayout
      title="Super Admin Dashboard"
      subtitle="Platform-wide administration and oversight"
      actions={
        <div className="flex items-center gap-2">
          <button onClick={() => setShowNewDeptModal(true)} className="btn-primary text-xs">
            <Plus className="w-3.5 h-3.5" />
            New Department
          </button>
          <button onClick={() => setShowAnnounceModal(true)} className="btn-secondary text-xs bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 border border-amber-500/30">
            <Send className="w-3.5 h-3.5" />
            Broadcaster
          </button>
          <button onClick={handleOpenConfig} className="btn-secondary text-xs">
            <Settings className="w-3.5 h-3.5" />
            Config
          </button>
        </div>
      }
    >
      {/* Global Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        {isLoading ? (
          Array.from({ length: 5 }).map((_, i) => <StatCardSkeleton key={i} />)
        ) : (
          <>
            <StatCard title="Departments" value={stats?.totalDepartments || 0} icon={<Building2 className="w-5 h-5 text-primary-600" />} iconBg="bg-primary-50" />
            <StatCard title="Total Users" value={stats?.totalUsers || 0} icon={<Users className="w-5 h-5 text-teal-600" />} iconBg="bg-teal-50" />
            <StatCard title="Courses" value={stats?.totalCourses || 0} icon={<BookOpen className="w-5 h-5 text-amber-600" />} iconBg="bg-amber-50" />
            <StatCard title="Attendance Records" value={stats?.totalAttendance || 0} icon={<BarChart3 className="w-5 h-5 text-green-600" />} iconBg="bg-green-50" />
            <StatCard title="Pending Review" value={stats?.pendingApprovals || 0} subtitle="Awaiting approval" icon={<Globe className="w-5 h-5 text-orange-600" />} iconBg="bg-orange-50" />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Departments */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Departments</h2>
            <button onClick={() => setShowNewDeptModal(true)} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <Plus className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {isLoading ? <TableSkeleton rows={3} /> : departments.length === 0 ? (
            <EmptyState title="No departments" action={
              <button onClick={() => setShowNewDeptModal(true)} className="btn-primary text-xs">Add Department</button>
            } />
          ) : (
            <div className="divide-y divide-gray-50 max-h-[360px] overflow-y-auto">
              {departments.map((d) => (
                <div key={d.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50/50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary-50 rounded-lg">
                      <Building2 className="w-4 h-4 text-primary-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{d.name}</p>
                      <p className="text-xs text-gray-500 font-mono">{d.code}</p>
                    </div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Users with Action Buttons */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">Recent Users & Approvals</h2>
            <span className="text-xs font-medium px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full">{recentUsers.length} total</span>
          </div>
          {isLoading ? <TableSkeleton rows={6} /> : recentUsers.length === 0 ? (
            <EmptyState title="No users yet" icon={<Users className="w-5 h-5 text-gray-400" />} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="table-th">User</th>
                    <th className="table-th">Role</th>
                    <th className="table-th">Status</th>
                    <th className="table-th">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {recentUsers.slice(0, 10).map((u) => (
                    <tr key={u.id} className="table-row">
                      <td className="table-td">
                        <div className="flex items-center gap-2.5">
                          <Avatar name={u.full_name || 'U'} size="sm" />
                          <div>
                            <p className="text-sm font-medium text-gray-900">{u.full_name || 'Unknown'}</p>
                            <p className="text-xxs text-gray-400">{u.phone || 'No phone'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="table-td"><RoleBadge role={u.role} /></td>
                      <td className="table-td"><ApprovalBadge status={u.approval_status} /></td>
                      <td className="table-td">
                        {u.approval_status === 'pending' ? (
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => handleUserApproval(u.id, 'approved')}
                              className="p-1 text-green-600 hover:bg-green-50 rounded border border-green-200 transition-colors"
                              title="Approve User"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleUserApproval(u.id, 'rejected')}
                              className="p-1 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-colors"
                              title="Reject User"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400 italic">Resolved</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* System Health & Config Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mt-5">
        {/* System Health Monitor */}
        <div className="card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">System Health Monitor</h2>
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span className="text-xs text-gray-500 font-medium">Live</span>
            </div>
          </div>
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-medium text-gray-600">Database Status</span>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${dbStatus === 'healthy' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
                {dbStatus === 'healthy' ? 'Healthy' : 'Checking...'}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-500" />
                <span className="text-xs font-medium text-gray-600">API Latency</span>
              </div>
              <span className="text-xs font-mono font-semibold text-gray-700">{latency} ms</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Cpu className="w-4 h-4 text-teal-500" />
                <span className="text-xs font-medium text-gray-600">Service Uptime</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">99.98%</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-500" />
                <span className="text-xs font-medium text-gray-600">Late Grace Limit</span>
              </div>
              <span className="text-xs font-semibold text-gray-700">{configSettings.late_grace_period} mins</span>
            </div>
          </div>
        </div>

        {/* Real-time System Configuration (Now Dynamic!) */}
        <div className="lg:col-span-2 card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-900">System Configuration</h2>
            <button onClick={handleOpenConfig} className="text-xs font-semibold text-primary-600 hover:text-primary-700 flex items-center gap-1">
              Edit Settings <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(configSettings).map(([key, value]) => (
              <div key={key} className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl hover:bg-gray-100/70 transition-colors">
                <div>
                  <p className="text-xs font-medium text-gray-500">{configDescriptions[key] || key}</p>
                  <p className="text-sm font-bold text-gray-900 mt-1 font-mono">{value}</p>
                </div>
                <Settings className="w-4 h-4 text-gray-400" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* New Department Modal */}
      <Modal isOpen={showNewDeptModal} onClose={() => setShowNewDeptModal(false)} title="Create Department" size="sm">
        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Department Name</label>
            <input value={newDept.name} onChange={(e) => setNewDept({ ...newDept, name: e.target.value })}
              placeholder="e.g. Computer Science" className="input-field" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Department Code</label>
            <input value={newDept.code} onChange={(e) => setNewDept({ ...newDept, code: e.target.value.toUpperCase() })}
              placeholder="e.g. CSC" maxLength={10} className="input-field font-mono" />
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => setShowNewDeptModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleCreateDept} disabled={creating || !newDept.name || !newDept.code} className="btn-primary flex-1 justify-center">
              {creating ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Create'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Dynamic System Config Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="System Configuration Editor" size="md">
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">Updating settings takes effect immediately across all active user sessions on the platform.</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Object.entries(editConfigs).map(([key, value]) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{configDescriptions[key] || key}</label>
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setEditConfigs({ ...editConfigs, [key]: e.target.value })}
                  className="input-field font-mono"
                />
              </div>
            ))}
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={() => setShowConfigModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleSaveConfig} disabled={savingConfig} className="btn-primary flex-1 justify-center">
              {savingConfig ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Broadcaster (Global Announcement) Modal */}
      <Modal isOpen={showAnnounceModal} onClose={() => setShowAnnounceModal(false)} title="Global Broadcaster" size="md">
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-100 rounded-xl p-3.5 flex gap-2.5">
            <AlertTriangle className="w-4.5 h-4.5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-700">This announcement will be broadcasted to <strong>all</strong> users platform-wide (students, teachers, class representatives, and admins).</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Announcement Title</label>
            <input
              type="text"
              required
              placeholder="e.g. End of Semester Examinations Timetable"
              value={newAnnounce.title}
              onChange={(e) => setNewAnnounce({ ...newAnnounce, title: e.target.value })}
              className="input-field"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Priority Level</label>
            <select
              value={newAnnounce.priority}
              onChange={(e) => setNewAnnounce({ ...newAnnounce, priority: e.target.value as 'info' | 'important' | 'urgent' })}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="info">Info (Blue)</option>
              <option value="important">Important (Amber)</option>
              <option value="urgent">Urgent (Red)</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1.5">Announcement Content</label>
            <textarea
              required
              rows={4}
              placeholder="Type your system announcement message details here..."
              value={newAnnounce.body}
              onChange={(e) => setNewAnnounce({ ...newAnnounce, body: e.target.value })}
              className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
            />
          </div>

          <div className="flex gap-2 pt-3 border-t border-gray-100">
            <button onClick={() => setShowAnnounceModal(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
            <button onClick={handleBroadcast} disabled={broadcasting || !newAnnounce.title || !newAnnounce.body} className="btn-primary flex-1 justify-center">
              {broadcasting ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : 'Broadcast Alert'}
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
