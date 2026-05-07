import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Mail, Lock, User, Phone, Eye, EyeOff, CreditCard } from 'lucide-react';
import ThemeToggle from '../components/ThemeToggle';

export default function Auth({ mode }) {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
    role: 'citizen', govt_id_type: 'aadhaar', govt_id_number: ''
  });
  const set = (k, v) => setForm({ ...form, [k]: v });

  const handleSubmit = async (e) => {
    e.preventDefault(); setError(''); setLoading(true);
    try {
      const user = mode === 'login' ? await login(form.email, form.password) : await register(form);
      navigate(user.role === 'admin' ? '/admin' : user.role === 'vendor' ? '/vendor' : '/citizen');
    } catch (err) { setError(err.message); } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-bg-primary relative overflow-hidden transition-colors duration-500">
      {/* Theme Toggle in Top Right */}
      <div className="absolute top-6 right-6 z-50">
        <ThemeToggle />
      </div>

      {/* Decorative Elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-secondary-500/10 rounded-full blur-3xl opacity-50" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-primary-500/10 rounded-full blur-3xl opacity-50" />
      </div>

      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-10">
          <div className="text-5xl mb-4 animate-float">🏛️</div>
          <h1 className="text-4xl font-extrabold text-text-primary tracking-tight">MicroTender</h1>
          <p className="text-text-tertiary font-bold uppercase tracking-widest text-xs mt-2">Civic Resolution Protocol</p>
        </div>

        <div className="glass-card p-8 border border-border-primary shadow-2xl bg-surface-primary/80 backdrop-blur-xl">
          <h2 className="text-2xl font-bold mb-8 text-center text-text-primary">{mode === 'login' ? 'Welcome Back' : 'Create Account'}</h2>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-500 text-sm font-medium animate-shake">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {mode === 'register' && (<>
              <div>
                <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-wider ml-1">Full Name</label>
                <div className="relative group">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-secondary-500 transition-colors" />
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="e.g. Rahul Sharma"
                    className="input-futuristic w-full pl-12" />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-wider ml-1">Select Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['citizen', 'vendor', 'admin'].map(r => (
                    <button key={r} type="button" onClick={() => set('role', r)}
                      className={`py-3 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all ${form.role === r
                        ? 'bg-secondary-500 text-white shadow-soft'
                        : 'bg-bg-secondary text-text-tertiary hover:bg-bg-tertiary border border-border-primary'
                        }`}>
                      {r === 'citizen' ? '👤 Citizen' : r === 'vendor' ? '🔧 Vendor' : '🛡️ Admin'}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-wider ml-1">Phone Number</label>
                <div className="relative group">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-secondary-500 transition-colors" />
                  <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+91 XXXXX XXXXX"
                    className="input-futuristic w-full pl-12" />
                </div>
              </div>

              {(form.role === 'citizen' || form.role === 'vendor') && (
                <div className="space-y-4 p-5 bg-bg-secondary rounded-2xl border border-border-primary">
                  <label className="text-xs font-bold text-secondary-500 flex items-center gap-2 uppercase tracking-widest"><CreditCard size={14} />Identity Verification</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['aadhaar', 'pan'].map(t => (
                      <button key={t} type="button" onClick={() => set('govt_id_type', t)}
                        className={`py-2 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all ${form.govt_id_type === t
                          ? 'bg-secondary-500/20 text-secondary-500'
                          : 'bg-bg-primary text-text-tertiary border border-border-primary'
                          }`}>
                        {t === 'aadhaar' ? 'Aadhaar' : 'PAN'}
                      </button>
                    ))}
                  </div>
                  <input type="text" value={form.govt_id_number} onChange={e => set('govt_id_number', e.target.value)}
                    className="input-futuristic w-full text-xs"
                    placeholder={form.govt_id_type === 'aadhaar' ? '12-digit Aadhaar number' : 'PAN Number (ABCDE1234F)'} />
                </div>
              )}
            </>)}

            <div>
              <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-wider ml-1">Email Address</label>
              <div className="relative group">
                <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-secondary-500 transition-colors" />
                <input type="email" value={form.email} onChange={e => set('email', e.target.value)} required placeholder="your@email.com"
                  className="input-futuristic w-full pl-12" />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-wider ml-1">Secret Password</label>
              <div className="relative group">
                <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary group-focus-within:text-secondary-500 transition-colors" />
                <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)} required placeholder="••••••••"
                  className="input-futuristic w-full pl-12 pr-12" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-secondary-500 transition-colors">
                  {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <button type="submit" disabled={loading}
              className="w-full py-4 bg-secondary-600 hover:bg-secondary-700 text-white font-extrabold rounded-2xl transition-all shadow-lg active:scale-95 disabled:opacity-50">
              {loading ? (
                <div className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Verifying...
                </div>
              ) : mode === 'login' ? '🔐 Secure Sign In' : '🚀 Initialize Account'}
            </button>
          </form>

          <div className="mt-8 text-center text-sm font-medium text-text-tertiary">
            {mode === 'login' ? (
              <>Don't have an account? <Link to="/register" className="text-secondary-500 hover:underline font-bold">Create One</Link></>
            ) : (
              <>Already have an account? <Link to="/login" className="text-secondary-500 hover:underline font-bold">Sign In</Link></>
            )}
          </div>

          {mode === 'login' && (
            <div className="mt-8 p-5 bg-bg-secondary rounded-2xl text-[10px] text-text-tertiary space-y-2 border border-border-primary">
              <p className="font-extrabold text-secondary-500 uppercase tracking-widest mb-1">Development Access:</p>
              <div className="grid grid-cols-1 gap-1">
                <p><span className="font-bold text-text-secondary">Citizen:</span> rajesh@gmail.com / password123</p>
                <p><span className="font-bold text-text-secondary">Vendor:</span> vikram@vendor.com / password123</p>
                <p><span className="font-bold text-text-secondary">Admin:</span> admin@microtender.gov / password123</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
