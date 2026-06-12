import { useState, FormEvent, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { GraduationCap, Mail, Lock, User, Phone, AlertCircle, ChevronLeft } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { supabase } from '../../config/supabase';
import { UserRole, Department, Level } from '../../types';

const roleRoutes: Record<UserRole, string> = {
  student: '/student/dashboard',
  class_rep: '/class-rep/dashboard',
  teacher: '/teacher/dashboard',
  dept_admin: '/dept-admin/dashboard',
  super_admin: '/super-admin/dashboard',
};

const roles: { value: UserRole; label: string; desc: string; color: string }[] = [
  { value: 'student', label: 'Student', desc: 'Access timetable, scan QR attendance, use AI tutor', color: 'border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10' },
  { value: 'class_rep', label: 'Class Rep', desc: 'Generate QR codes, send alerts, manage attendance', color: 'border-teal-500/40 bg-teal-500/5 hover:bg-teal-500/10' },
  { value: 'teacher', label: 'Teacher', desc: 'View attendance analytics, manage materials', color: 'border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10' },
  { value: 'dept_admin', label: 'Dept Admin', desc: 'Manage users, courses, and department reports', color: 'border-orange-500/40 bg-orange-500/5 hover:bg-orange-500/10' },
  { value: 'super_admin', label: 'Super Admin', desc: 'Full platform administration and configuration', color: 'border-red-500/40 bg-red-500/5 hover:bg-red-500/10' },
];

export default function RegisterPage() {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const [step, setStep] = useState<1 | 2>(1);
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [form, setForm] = useState({
    full_name: '', email: '', password: '', phone: '',
    department_id: '', level_id: '',
  });
  const [departments, setDepartments] = useState<Department[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    supabase.from('departments').select('*').order('name').then(({ data }) => {
      if (data) setDepartments(data);
    });
  }, []);

  useEffect(() => {
    if (form.department_id) {
      supabase.from('levels').select('*').eq('department_id', form.department_id).order('year').then(({ data }) => {
        if (data) setLevels(data);
        setForm((f) => ({ ...f, level_id: '' }));
      });
    }
  }, [form.department_id]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    setError('');
    setIsLoading(true);
    try {
      await signUp(form.email, form.password, {
        full_name: form.full_name,
        role: selectedRole,
        phone: form.phone,
        department_id: form.department_id || undefined,
        level_id: form.level_id || undefined,
      });
      if (selectedRole === 'super_admin') {
        // Show pending approval message
        setSuccess(true);
      } else {
        // Immediate navigation for other roles
        const target = roleRoutes[selectedRole] || '/student/dashboard';
        navigate(target);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  // Google OAuth continue
  const handleGoogleContinue = async () => {
    try {
      await supabase.auth.signInWithOAuth({ provider: 'google' });
    } catch (err) {
      console.error('Google sign‑in error:', err);
      setError('Google sign‑in failed.');
    }
  };

  // Show pending approval message for super_admin after signup
  if (success && selectedRole === 'super_admin') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 text-center max-w-sm">
          <AlertCircle className="w-16 h-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Registration Pending</h2>
          <p className="text-blue-300/60 mb-6">Your Super Admin account requires approval by an existing administrator.</p>
          <Link to="/login" className="btn-primary w-full block text-center">Back to Sign In</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-950 to-slate-900 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="p-2.5 bg-primary-600 rounded-xl">
            <GraduationCap className="w-6 h-6 text-white" />
          </div>
          <span className="text-xl font-bold text-white">SmartClass</span>
        </div>

        <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8">
          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-7">
            {[1, 2].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step >= s ? 'bg-primary-600 text-white' : 'bg-white/10 text-blue-300/50'
                }`}>{s}</div>
                {s < 2 && <div className={`h-px w-12 transition-all ${step > s ? 'bg-primary-600' : 'bg-white/10'}`} />}
              </div>
            ))}
            <span className="text-xs text-blue-300/60 ml-2">
              {step === 1 ? 'Choose your role' : 'Enter your details'}
            </span>
          </div>

          {step === 1 ? (
            <div>
              <h1 className="text-xl font-bold text-white mb-1">Select your role</h1>
              <p className="text-blue-300/60 text-sm mb-5">Choose the role that matches your position in the institution.</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    onClick={() => setSelectedRole(r.value)}
                    className={`text-left p-4 rounded-xl border transition-all ${r.color} ${
                      selectedRole === r.value ? 'ring-2 ring-primary-500' : ''
                    }`}
                  >
                    <p className="text-sm font-semibold text-white">{r.label}</p>
                    <p className="text-xs text-blue-300/60 mt-1 leading-relaxed">{r.desc}</p>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setStep(2)}
                disabled={!selectedRole}
                className="btn-primary w-full justify-center mt-5"
              >
                Continue
              </button>
              {selectedRole !== 'super_admin' && (
                <button
                  type="button"
                  onClick={handleGoogleContinue}
                  className="btn-secondary w-full justify-center mt-3 gap-2.5"
                >
                  <svg className="w-4 h-4" viewBox="0 0 24 24">
                    <path
                      fill="#EA4335"
                      d="M5.2662,9.7645 C6.1988,6.9386 8.8588,4.9091 12,4.9091 C13.6909,4.9091 15.2182,5.5091 16.4182,6.4909 L19.9091,3 C17.7818,1.1455 15.0545,0 12,0 C7.3309,0 3.3273,2.6909 1.3909,6.6273 L5.2662,9.7645 Z"
                    />
                    <path
                      fill="#34A853"
                      d="M16.0407,18.013 C14.9509,18.7182 13.56,19.0909 12,19.0909 C8.8588,19.0909 6.1988,17.0614 5.2662,14.2355 L1.3909,17.3727 C3.3273,21.3091 7.3309,24 12,24 C14.9564,24 17.7327,22.9527 19.8327,21.1636 L16.0407,18.013 Z"
                    />
                    <path
                      fill="#4285F4"
                      d="M23.49,12.2727 C23.49,11.49 23.4191,10.7836 23.3,10.0909 L12,10.0909 L12,14.7273 L18.4473,14.7273 C18.1745,16.2055 17.3127,17.2745 16.0407,18.013 L19.8327,21.1636 C22.0473,19.1182 23.49,16.0364 23.49,12.2727 Z"
                    />
                    <path
                      fill="#FBBC05"
                      d="M5.2662,9.7645 C5.0182,10.5109 4.8818,11.3073 4.8818,12.1364 C4.8818,12.9655 5.0182,13.7618 5.2662,14.2355 L1.3909,17.3727 C0.5,15.5891 0,13.62 0,11.5364 C0,9.4527 0.5,7.4836 1.3909,5.7 L5.2662,9.7645 Z"
                    />
                  </svg>
                  <span>Continue with Google</span>
                </button>
              )}
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="flex items-center gap-2 mb-5">
                <button type="button" onClick={() => setStep(1)} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
                  <ChevronLeft className="w-4 h-4 text-blue-300" />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-white">Create your account</h1>
                  <p className="text-blue-300/60 text-xs">Registering as <span className="text-primary-400 font-medium">{roles.find(r => r.value === selectedRole)?.label}</span></p>
                </div>
              </div>

              {error && (
                <div className="flex items-start gap-2.5 bg-red-500/10 border border-red-500/20 rounded-xl p-3.5 mb-4">
                  <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Full Name</label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/60" />
                    <input type="text" required value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="John Doe" className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Email Address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/60" />
                    <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="you@university.edu" className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/60" />
                    <input type="password" required minLength={8} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })}
                      placeholder="Min 8 characters" className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-blue-400/60" />
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+234 800 000 0000" className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-blue-300/30 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Department</label>
                  <select value={form.department_id} onChange={(e) => setForm({ ...form, department_id: e.target.value })}
                    className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent">
                    <option value="" className="bg-slate-800">Select department</option>
                    {departments.map((d) => <option key={d.id} value={d.id} className="bg-slate-800">{d.name}</option>)}
                  </select>
                </div>

                {(selectedRole === 'student' || selectedRole === 'class_rep') && (
                  <div>
                    <label className="block text-xs font-medium text-blue-200/80 mb-1.5">Level</label>
                    <select value={form.level_id} onChange={(e) => setForm({ ...form, level_id: e.target.value })}
                      disabled={!form.department_id}
                      className="w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent disabled:opacity-50">
                      <option value="" className="bg-slate-800">Select level</option>
                      {levels.map((l) => <option key={l.id} value={l.id} className="bg-slate-800">{l.name}</option>)}
                    </select>
                  </div>
                )}
              </div>

              <button type="submit" disabled={isLoading} className="btn-primary w-full justify-center mt-5">
                {isLoading ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Creating account...</> : 'Create Account'}
              </button>
            </form>
          )}

          <p className="mt-4 text-center text-sm text-blue-300/60">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium transition-colors">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
