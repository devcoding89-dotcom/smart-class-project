import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap, QrCode, Brain, Bell, Calendar, Shield,
  Users, BarChart3, Menu, X, ChevronRight, Zap, Star,
  CheckCircle, ArrowRight, Smartphone, Globe, Lock
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

const features = [
  {
    icon: <QrCode className="w-6 h-6" />,
    title: 'QR Attendance with Anti-Cheat',
    desc: 'GPS-verified, device-fingerprinted QR codes that rotate every 60 seconds. Students physically present in class get marked automatically.',
    color: 'from-blue-500 to-cyan-500',
    bg: 'bg-blue-500/10 border-blue-500/20',
    tag: 'Smart Verification',
  },
  {
    icon: <Brain className="w-6 h-6" />,
    title: 'AI Revision Assistant',
    desc: 'RAG-powered AI trained directly on your course PDFs. Ask questions about lectures, get instant cited answers from your own materials.',
    color: 'from-violet-500 to-purple-500',
    bg: 'bg-violet-500/10 border-violet-500/20',
    tag: 'Powered by GPT-4',
  },
  {
    icon: <Bell className="w-6 h-6" />,
    title: 'DND-Breaking Smart Alerts',
    desc: 'Critical class alerts that break through Do Not Disturb mode. Never miss an emergency schedule change or important announcement.',
    color: 'from-rose-500 to-pink-500',
    bg: 'bg-rose-500/10 border-rose-500/20',
    tag: 'Always Heard',
  },
  {
    icon: <Calendar className="w-6 h-6" />,
    title: 'Dynamic Visual Timetable',
    desc: 'Color-coded, interactive timetables updated in real-time. Schedule changes propagate instantly to every student in the class.',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    tag: 'Real-Time Sync',
  },
  {
    icon: <BarChart3 className="w-6 h-6" />,
    title: 'Attendance Analytics',
    desc: "Department-level reports, per-student performance trends, and automated alerts when students fall below the 70% threshold.",
    color: 'from-amber-500 to-orange-500',
    bg: 'bg-amber-500/10 border-amber-500/20',
    tag: 'Deep Insights',
  },
  {
    icon: <Shield className="w-6 h-6" />,
    title: 'Role-Based Security (RLS)',
    desc: "Every feature is row-level secured. Students only see their data, teachers see their classes, admins control the platform.",
    color: 'from-slate-400 to-gray-500',
    bg: 'bg-slate-500/10 border-slate-500/20',
    tag: 'Supabase RLS',
  },
];

const roles = [
  { role: 'Student', color: 'bg-blue-500', icon: <GraduationCap className="w-4 h-4" />, perks: ['Visual timetable', 'AI study assistant', 'Attendance history', 'Smart alerts'] },
  { role: 'Teacher', color: 'bg-teal-500', icon: <Users className="w-4 h-4" />, perks: ['Attendance analytics', 'Upload course materials', 'Class management', 'Alert students'] },
  { role: 'Class Rep', color: 'bg-violet-500', icon: <QrCode className="w-4 h-4" />, perks: ['Generate QR codes', 'Rotate anti-cheat tokens', 'Send class alerts', 'Sync timetable'] },
  { role: 'Dept Admin', color: 'bg-amber-500', icon: <Shield className="w-4 h-4" />, perks: ['Approve accounts', 'Manage courses', 'Department reports', 'User directory'] },
];

const stats = [
  { label: 'Students Supported', value: '10,000+' },
  { label: 'Institutions', value: '50+' },
  { label: 'Attendance Accuracy', value: '99.8%' },
  { label: 'AI Queries/Day', value: '25,000+' },
];

export default function LandingPage() {
  const { isAuthenticated, profile, isLoading } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeRole, setActiveRole] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const roleRouteMap: Record<string, string> = {
    student: '/student/dashboard',
    class_rep: '/class-rep/dashboard',
    teacher: '/teacher/dashboard',
    dept_admin: '/dept-admin/dashboard',
    super_admin: '/super-admin/dashboard',
  };

  const dashboardRoute = profile ? (roleRouteMap[profile.role] ?? '/login') : '/login';

  // Auto-redirect authenticated + approved users (e.g. after Google OAuth callback)
  useEffect(() => {
    if (!isLoading && isAuthenticated && profile?.approval_status === 'approved') {
      navigate(dashboardRoute, { replace: true });
    }
  }, [isLoading, isAuthenticated, profile, dashboardRoute, navigate]);

  return (
    <div className="min-h-screen bg-[#060b18] text-white overflow-x-hidden">

      {/* ── NAVBAR ─────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-[#060b18]/90 backdrop-blur-xl border-b border-white/5 shadow-xl' : ''}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-blue-600 rounded-xl">
                <GraduationCap className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-white">SmartClass</span>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-blue-200/70 hover:text-white transition-colors">Features</a>
              <a href="#roles" className="text-sm text-blue-200/70 hover:text-white transition-colors">Roles</a>
              <a href="#stats" className="text-sm text-blue-200/70 hover:text-white transition-colors">Platform</a>
            </nav>

            {/* Desktop CTA */}
            <div className="hidden md:flex items-center gap-3">
              {isAuthenticated ? (
                <button onClick={() => navigate(dashboardRoute)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all">
                  Go to Dashboard <ArrowRight className="w-3.5 h-3.5" />
                </button>
              ) : (
                <>
                  <Link to="/login" className="text-sm text-blue-200/70 hover:text-white transition-colors font-medium">Sign In</Link>
                  <Link to="/register" className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all">
                    Get Started <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                </>
              )}
            </div>

            {/* Mobile menu button */}
            <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
              {menuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer */}
        {menuOpen && (
          <div className="md:hidden bg-[#0d1525]/98 backdrop-blur-xl border-t border-white/5 px-4 pb-6 pt-4 space-y-4">
            <a href="#features" onClick={() => setMenuOpen(false)} className="block text-sm text-blue-200/70 hover:text-white py-2 transition-colors">Features</a>
            <a href="#roles" onClick={() => setMenuOpen(false)} className="block text-sm text-blue-200/70 hover:text-white py-2 transition-colors">Roles</a>
            <a href="#stats" onClick={() => setMenuOpen(false)} className="block text-sm text-blue-200/70 hover:text-white py-2 transition-colors">Platform</a>
            <div className="pt-2 border-t border-white/10 space-y-3">
              {isAuthenticated ? (
                <button onClick={() => { navigate(dashboardRoute); setMenuOpen(false); }}
                  className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2">
                  Go to Dashboard <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <Link to="/login" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-center text-sm text-white/70 hover:text-white border border-white/10 hover:border-white/20 rounded-xl transition-all">
                    Sign In
                  </Link>
                  <Link to="/register" onClick={() => setMenuOpen(false)} className="block w-full py-3 text-center text-sm font-semibold bg-blue-600 hover:bg-blue-700 text-white rounded-xl transition-all">
                    Create Account
                  </Link>
                </>
              )}
            </div>
          </div>
        )}
      </header>

      {/* ── HERO ───────────────────────────────────────────────── */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-4 pt-20 pb-16 overflow-hidden">
        {/* Background glows */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-blue-600/20 rounded-full blur-[120px]" />
          <div className="absolute top-1/2 left-1/4 w-[300px] h-[300px] bg-violet-600/15 rounded-full blur-[100px]" />
          <div className="absolute bottom-1/4 right-1/4 w-[250px] h-[250px] bg-cyan-600/10 rounded-full blur-[80px]" />
        </div>

        {/* Grid pattern */}
        <div className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-300 mb-6">
            <Zap className="w-3 h-3" />
            Now with AI-powered revision assistant
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-7xl font-extrabold leading-tight mb-6 tracking-tight">
            The Academic Platform
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-violet-400 bg-clip-text text-transparent">
              Built for Everyone
            </span>
          </h1>

          <p className="text-base sm:text-lg text-blue-200/60 max-w-2xl mx-auto mb-10 leading-relaxed">
            SmartClass brings QR attendance, AI-powered study tools, real-time alerts, and dynamic timetables into one beautifully unified platform — accessible on any device.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-16">
            {isAuthenticated ? (
              <button onClick={() => navigate(dashboardRoute)}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-sm">
                Go to My Dashboard <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link to="/register"
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-2xl transition-all shadow-lg shadow-blue-600/30 hover:shadow-blue-500/40 hover:-translate-y-0.5 text-sm">
                  Get Started Free <ArrowRight className="w-4 h-4" />
                </Link>
                <Link to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-7 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white font-medium rounded-2xl transition-all text-sm">
                  Sign In
                </Link>
              </>
            )}
          </div>

          {/* Hero Feature Pills */}
          <div className="flex flex-wrap justify-center gap-2">
            {['QR Anti-Cheat Attendance', 'AI Revision Assistant', 'DND-Breaking Alerts', 'Real-Time Timetable', 'Role-Based Dashboards'].map((tag) => (
              <span key={tag} className="px-3 py-1 bg-white/5 border border-white/10 rounded-full text-xs text-blue-200/60">
                {tag}
              </span>
            ))}
          </div>
        </div>

        {/* Floating cards — hidden on very small screens */}
        <div className="relative max-w-5xl mx-auto mt-16 w-full hidden sm:block">
          <div className="grid grid-cols-3 gap-4 px-4">
            {[
              { label: 'Session Active', sub: 'CSE101 — Block B, Room 102', dot: 'bg-green-400', icon: <QrCode className="w-5 h-5 text-blue-400" /> },
              { label: 'AI Assistant', sub: 'Explain binary search trees...', dot: 'bg-violet-400', icon: <Brain className="w-5 h-5 text-violet-400" /> },
              { label: 'Alert Sent', sub: 'Class starts in 5 minutes!', dot: 'bg-rose-400', icon: <Bell className="w-5 h-5 text-rose-400" /> },
            ].map((card) => (
              <div key={card.label} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-4 hover:-translate-y-1 transition-transform duration-300">
                <div className="flex items-center gap-2.5 mb-2">
                  <div className="p-1.5 bg-white/5 rounded-lg">{card.icon}</div>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${card.dot} animate-pulse`} />
                    <p className="text-xs font-semibold text-white">{card.label}</p>
                  </div>
                </div>
                <p className="text-xs text-blue-200/50 leading-relaxed">{card.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── STATS ──────────────────────────────────────────────── */}
      <section id="stats" className="py-16 px-4 border-y border-white/5">
        <div className="max-w-5xl mx-auto grid grid-cols-2 lg:grid-cols-4 gap-6">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="text-3xl sm:text-4xl font-extrabold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">{s.value}</p>
              <p className="text-xs text-blue-200/50 mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── FEATURES ───────────────────────────────────────────── */}
      <section id="features" className="py-20 px-4">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">What Makes Us Different</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">
              Everything your institution needs
            </h2>
            <p className="text-blue-200/50 max-w-xl mx-auto text-sm leading-relaxed">
              Six powerful pillars that eliminate daily academic inefficiencies and bring your entire institution into one seamless flow.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f) => (
              <div key={f.title}
                className={`group relative p-6 rounded-2xl border ${f.bg} hover:scale-[1.02] transition-all duration-300 cursor-default`}>
                {/* Icon */}
                <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${f.color} mb-4 shadow-lg`}>
                  <span className="text-white">{f.icon}</span>
                </div>
                {/* Tag */}
                <span className={`absolute top-5 right-5 text-[10px] font-semibold px-2 py-0.5 rounded-full bg-gradient-to-r ${f.color} text-white opacity-80`}>
                  {f.tag}
                </span>
                <h3 className="text-sm font-bold text-white mb-2">{f.title}</h3>
                <p className="text-xs text-blue-200/50 leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── ROLES ──────────────────────────────────────────────── */}
      <section id="roles" className="py-20 px-4 bg-gradient-to-b from-transparent via-blue-950/10 to-transparent">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-xs font-semibold text-blue-400 uppercase tracking-widest mb-3">Built for Everyone</p>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-white mb-4">Your role, your dashboard</h2>
            <p className="text-blue-200/50 max-w-xl mx-auto text-sm">
              SmartClass adapts to every user — each role gets a tailored experience and the exact tools they need, nothing more.
            </p>
          </div>

          {/* Role Tabs */}
          <div className="flex flex-wrap justify-center gap-2 mb-8">
            {roles.map((r, i) => (
              <button key={r.role} onClick={() => setActiveRole(i)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold transition-all ${activeRole === i ? `${r.color} text-white shadow-lg` : 'bg-white/5 text-blue-200/60 hover:bg-white/10'}`}>
                {r.icon} {r.role}
              </button>
            ))}
          </div>

          {/* Role Card */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className={`p-2.5 ${roles[activeRole].color} rounded-xl`}>{roles[activeRole].icon}</div>
              <div>
                <p className="text-sm font-bold text-white">{roles[activeRole].role} Dashboard</p>
                <p className="text-xs text-blue-200/50">Tailored experience for {roles[activeRole].role.toLowerCase()}s</p>
              </div>
            </div>
            <ul className="space-y-3">
              {roles[activeRole].perks.map((perk) => (
                <li key={perk} className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span className="text-sm text-blue-100/80">{perk}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── MOBILE READY STRIP ─────────────────────────────────── */}
      <section className="py-16 px-4">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-r from-blue-600/10 via-violet-600/10 to-cyan-600/10 border border-white/10 rounded-3xl p-8 sm:p-12 flex flex-col sm:flex-row items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-blue-400" />
                <span className="text-xs font-semibold text-blue-400 uppercase tracking-wider">Mobile First</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-3">Works beautifully on every device</h3>
              <p className="text-sm text-blue-200/50 leading-relaxed mb-6">
                Designed from the ground up for phones, tablets, and desktops. Whether you're scanning a QR code on your phone or reviewing reports on a laptop — SmartClass adapts perfectly.
              </p>
              <div className="flex flex-wrap gap-3">
                {[<Smartphone key="ph" className="w-4 h-4" />, <Globe key="gl" className="w-4 h-4" />, <Lock key="lk" className="w-4 h-4" />].map((icon, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-blue-300/60">
                    {icon} {['Phone optimized', 'Web accessible', 'Secure by default'][i]}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 flex-shrink-0">
              {['GPS Verified', 'Real-Time', 'AI Powered', 'Always On'].map((tag) => (
                <div key={tag} className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-center">
                  <Star className="w-4 h-4 text-yellow-400 mx-auto mb-1" />
                  <p className="text-xs font-semibold text-white">{tag}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── FINAL CTA ──────────────────────────────────────────── */}
      <section className="py-24 px-4 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-blue-600/20 rounded-full blur-[100px]" />
        </div>
        <div className="relative max-w-2xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full text-xs font-medium text-blue-300 mb-6">
            <Zap className="w-3 h-3" /> Free to get started
          </div>
          <h2 className="text-3xl sm:text-5xl font-extrabold text-white mb-5 leading-tight">
            Ready to transform your institution?
          </h2>
          <p className="text-blue-200/50 mb-10 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
            Join thousands of students and educators already using SmartClass. Set up takes less than 5 minutes.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            {isAuthenticated ? (
              <button onClick={() => navigate(dashboardRoute)}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5 text-sm">
                Go to My Dashboard <ChevronRight className="w-4 h-4" />
              </button>
            ) : (
              <>
                <Link to="/register"
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-2xl transition-all shadow-xl shadow-blue-600/30 hover:-translate-y-0.5 text-sm">
                  Create Free Account <ChevronRight className="w-4 h-4" />
                </Link>
                <Link to="/login"
                  className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-8 py-4 bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium rounded-2xl transition-all text-sm">
                  Sign In Instead
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── FOOTER ─────────────────────────────────────────────── */}
      <footer className="border-t border-white/5 py-8 px-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-blue-600 rounded-lg">
              <GraduationCap className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-white">SmartClass</span>
          </div>
          <p className="text-xs text-blue-200/30 text-center">
            © 2026 SmartClass Academic Platform. Built with React, TypeScript & Supabase.
          </p>
          <div className="flex gap-4">
            <Link to="/login" className="text-xs text-blue-200/40 hover:text-white transition-colors">Sign In</Link>
            <Link to="/register" className="text-xs text-blue-200/40 hover:text-white transition-colors">Register</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
