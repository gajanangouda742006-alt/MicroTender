import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { Mail, Lock, User, Phone, Eye, EyeOff, CreditCard } from 'lucide-react';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-dark-950 via-dark-900 to-primary-900/30">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 -left-20 w-72 h-72 bg-primary-600/20 rounded-full blur-3xl animate-float" />
        <div className="absolute bottom-1/4 -right-20 w-96 h-96 bg-accent-600/10 rounded-full blur-3xl animate-float" style={{ animationDelay: '1.5s' }} />
      </div>
      <div className="w-full max-w-md relative z-10 animate-fade-in">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏛️</div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">MicroTender</h1>
          <p className="text-gray-400 text-sm mt-1">Civic Issue Resolution Platform</p>
        </div>
        <div className="glass-strong rounded-2xl p-8 shadow-2xl">
          <h2 className="text-xl font-semibold mb-6 text-center">{mode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          {error && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{error}</div>}
          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'register' && (<>
              <div><label className="text-sm text-gray-400 mb-1 block">Full Name</label>
                <div className="relative"><User size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input type="text" value={form.name} onChange={e => set('name', e.target.value)} required placeholder="Enter your full name"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none transition" /></div></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Role</label>
                <div className="grid grid-cols-3 gap-2">
                  {['citizen','vendor','admin'].map(r=>(
                    <button key={r} type="button" onClick={()=>set('role',r)} className={`py-2 rounded-xl text-xs font-medium transition-all ${form.role===r?'bg-primary-600 text-white shadow-lg shadow-primary-600/30':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                      {r==='citizen'?'👤 Citizen':r==='vendor'?'🔧 Vendor':'🛡️ Admin'}</button>))}</div></div>
              <div><label className="text-sm text-gray-400 mb-1 block">Phone</label>
                <div className="relative"><Phone size={16} className="absolute left-3 top-3 text-gray-500" />
                  <input type="tel" value={form.phone} onChange={e=>set('phone',e.target.value)} placeholder="Phone number"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none transition" /></div></div>
              {(form.role==='citizen'||form.role==='vendor')&&(
                <div className="space-y-3 p-3 bg-white/5 rounded-xl border border-white/10">
                  <label className="text-sm text-gray-300 font-medium flex items-center gap-2"><CreditCard size={14}/>Government ID</label>
                  <div className="grid grid-cols-2 gap-2">
                    {['aadhaar','pan'].map(t=>(
                      <button key={t} type="button" onClick={()=>set('govt_id_type',t)} className={`py-2 rounded-lg text-xs font-medium transition-all ${form.govt_id_type===t?'bg-primary-600 text-white':'bg-white/5 text-gray-400'}`}>
                        {t==='aadhaar'?'Aadhaar Card':'PAN Card'}</button>))}
                  </div>
                  <input type="text" value={form.govt_id_number} onChange={e=>set('govt_id_number',e.target.value)}
                    className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none transition text-sm"
                    placeholder={form.govt_id_type==='aadhaar'?'12-digit Aadhaar number':'PAN (e.g. ABCDE1234F)'}/></div>)}
            </>)}
            <div><label className="text-sm text-gray-400 mb-1 block">Email</label>
              <div className="relative"><Mail size={16} className="absolute left-3 top-3 text-gray-500" />
                <input type="email" value={form.email} onChange={e=>set('email',e.target.value)} required placeholder="your@email.com"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none transition" /></div></div>
            <div><label className="text-sm text-gray-400 mb-1 block">Password</label>
              <div className="relative"><Lock size={16} className="absolute left-3 top-3 text-gray-500" />
                <input type={showPass?'text':'password'} value={form.password} onChange={e=>set('password',e.target.value)} required placeholder="••••••••"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none transition" />
                <button type="button" onClick={()=>setShowPass(!showPass)} className="absolute right-3 top-3 text-gray-500 hover:text-gray-300">
                  {showPass?<EyeOff size={16}/>:<Eye size={16}/>}</button></div></div>
            <button type="submit" disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 text-white font-semibold rounded-xl transition-all shadow-lg shadow-primary-600/30 disabled:opacity-50">
              {loading?'Processing...':mode==='login'?'🔐 Sign In':'🚀 Create Account'}</button>
          </form>
          <div className="mt-6 text-center text-sm text-gray-500">
            {mode==='login'?<>No account? <Link to="/register" className="text-primary-400 hover:text-primary-300 font-medium">Register</Link></>
              :<>Have an account? <Link to="/login" className="text-primary-400 hover:text-primary-300 font-medium">Sign In</Link></>}
          </div>
          {mode==='login'&&(<div className="mt-4 p-3 bg-white/5 rounded-xl text-xs text-gray-500 space-y-1">
            <p className="font-medium text-gray-400">Demo Credentials:</p>
            <p>👤 rajesh@gmail.com / password123</p>
            <p>🔧 vikram@vendor.com / password123</p>
            <p>🛡️ admin@microtender.gov / password123</p></div>)}
        </div>
      </div>
    </div>
  );
}
