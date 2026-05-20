import { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import { Link, Routes, Route } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../api';
import MapPicker from '../components/MapPicker';
import { StatusBadge } from '../components/StatusTimeline';
import { MapPin, Briefcase, Send, User, Building, Star, DollarSign, CheckCircle, X, Camera, Loader } from 'lucide-react';
import SkeletonLoader from '../components/SkeletonLoader';

function WorkUpdateModal({ tenderId, onClose, onSuccess }) {
  const [description, setDescription] = useState('');
  const [progress, setProgress] = useState(100);
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const fd = new FormData();
      fd.append('tender_id', tenderId);
      fd.append('description', description);
      fd.append('progress_percentage', progress);
      if (image) fd.append('image', image);

      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(async (pos) => {
          fd.append('latitude', pos.coords.latitude);
          fd.append('longitude', pos.coords.longitude);
          await submitData(fd);
        }, async () => {
          await submitData(fd);
        });
      } else {
        await submitData(fd);
      }
    } catch (err) {
      alert(err.message);
      setLoading(false);
    }
  };

  const submitData = async (formData) => {
    try {
      await api.submitWorkUpdate(formData);
      alert('Progress update and proof submitted successfully!');
      onSuccess();
    } catch (err) {
      alert(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="glass-card max-w-lg w-full p-8 border border-border-primary shadow-2xl space-y-6 animate-scale-up">
        <div className="flex justify-between items-center pb-4 border-b border-border-primary">
          <h3 className="text-xl font-bold text-text-primary flex items-center gap-2">
            <Camera size={20} className="text-secondary-500" /> Submit Work Proof
          </h3>
          <button onClick={onClose} className="text-text-tertiary hover:text-text-primary transition-colors">
            <X size={24} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider block">Progress ({progress}%)</label>
            <input 
              type="range" 
              min="10" 
              max="100" 
              step="10"
              value={progress} 
              onChange={e => setProgress(parseInt(e.target.value))}
              className="w-full h-2 bg-bg-secondary rounded-lg appearance-none cursor-pointer accent-secondary-500"
            />
            <div className="flex justify-between text-[10px] text-text-tertiary font-bold">
              <span>10%</span>
              <span>50%</span>
              <span>100% (Complete Job)</span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider block">Description of Work Done</label>
            <textarea 
              required
              rows={3}
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="input-futuristic w-full"
              placeholder="Describe materials used, steps taken, etc..."
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-wider block">Photo Evidence (After Photo)</label>
            <div className="relative group">
              <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])} required
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="bg-bg-secondary border-2 border-dashed border-border-primary rounded-xl p-5 text-center group-hover:border-secondary-500 transition-colors">
                {image ? (
                  <p className="text-xs text-secondary-600 font-bold">📸 {image.name}</p>
                ) : (
                  <p className="text-xs text-text-tertiary font-bold">Click to select photo evidence</p>
                )}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="btn-primary w-full py-3.5 font-bold flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader size={18} className="animate-spin" />
                Submitting Proof...
              </>
            ) : (
              <span>Submit Proof</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}

function Overview() {
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState({ jobs: [], applications: [] });
  const [updatingTenderId, setUpdatingTenderId] = useState(null);

  useEffect(() => {
    api.getVendorProfile().then(d => setProfile(d)).catch(() => { });
    api.getMyJobs().then(setJobs).catch(() => { });
  }, []);

  const stats = {
    active: jobs.jobs?.filter(j => ['assigned', 'in_progress'].includes(j.status)).length || 0,
    completed: jobs.jobs?.filter(j => j.status === 'completed').length || 0,
    pending: jobs.applications?.filter(a => a.status === 'pending').length || 0,
  };

  // Dummy data for the chart to simulate vendor earnings and velocity over time
  const chartData = [
    { name: 'Mon', jobs: 2, earnings: 1500 },
    { name: 'Tue', jobs: 3, earnings: 3200 },
    { name: 'Wed', jobs: 1, earnings: 800 },
    { name: 'Thu', jobs: 4, earnings: 4500 },
    { name: 'Fri', jobs: 5, earnings: 6000 },
    { name: 'Sat', jobs: 2, earnings: 2100 },
    { name: 'Sun', jobs: 6, earnings: 7500 },
  ];

  return (
    <div className="animate-fade-in space-y-8">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold mb-2 text-text-primary">
          Vendor Dashboard 🔧
        </h1>
        <p className="text-text-secondary font-medium">Manage your jobs and grow your business</p>
      </div>
      {!profile?.vendor ? (
        <div className="glass-card p-10 text-center border border-border-primary shadow-soft">
          <div className="text-5xl mb-6 animate-float">🏗️</div>
          <p className="text-text-secondary mb-8 max-w-md mx-auto font-medium">Complete your vendor profile to start receiving tenders and building your reputation</p>
          <Link to="/vendor/profile" className="btn-primary px-10 py-3.5 font-bold hover:scale-105 transition-transform inline-block">
            Setup Profile
          </Link>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { label: 'Rating', val: profile.vendor.rating_avg?.toFixed(1) || '0.0', icon: Star, color: 'bg-amber-500/10 text-amber-500' },
              { label: 'Active Jobs', val: stats.active, icon: Briefcase, color: 'bg-secondary-500/10 text-secondary-500' },
              { label: 'Completed', val: stats.completed, icon: CheckCircle, color: 'bg-green-500/10 text-green-500' },
              { label: 'Pending Bids', val: stats.pending, icon: Send, color: 'bg-accent-pink/10 text-accent-pink' },
            ].map((s, index) => (
              <motion.div key={s.label} whileHover={{ y: -10 }} className="glass-card hover-3d p-6 border border-border-primary animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>
                  <s.icon size={24} />
                </div>
                <p className="text-3xl font-bold text-text-primary mb-1">{s.val}</p>
                <p className="text-xs text-text-tertiary font-bold uppercase tracking-wider">{s.label}</p>
              </motion.div>
            ))}
          </div>

          {/* Real-Time Earnings Chart */}
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="glass-card p-6 border border-border-primary hover-3d overflow-hidden relative group">
            <div className="absolute inset-0 bg-gradient-to-r from-accent-purple/10 to-accent-cyan/10 opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none" />
            <div className="flex justify-between items-center mb-6 relative z-10">
              <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
                <DollarSign size={20} className="text-green-500" /> Earnings & Velocity
              </h2>
            </div>
            <div className="h-72 w-full relative z-10">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorEarnings" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#ffffff15" vertical={false} />
                  <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `₹${value}`} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }}
                    itemStyle={{ color: '#fff', fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="earnings" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorEarnings)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </motion.div>
          <div className="glass-card hover-3d p-6 border border-border-primary">
            <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2">
              <Briefcase size={20} className="text-secondary-500" /> Active Jobs
            </h2>
            {stats.active === 0 ? (
              <div className="text-center py-12">
                <div className="text-4xl mb-4 opacity-20">📋</div>
                <p className="text-text-tertiary mb-6 font-medium">No active jobs at the moment</p>
                <Link to="/vendor/nearby" className="btn-secondary px-8 py-2.5 font-bold">
                  Browse Nearby Tenders
                </Link>
              </div>
            ) : (
              <div className="space-y-4">
                {jobs.jobs?.filter(j => ['assigned', 'in_progress'].includes(j.status)).map((j, index) => (
                  <motion.div key={j.tender_id} whileHover={{ x: 5 }} className="flex items-center justify-between p-5 bg-bg-secondary rounded-2xl border border-border-primary hover:bg-bg-tertiary hover-3d transition-all animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="flex-1 pr-4">
                      <p className="font-bold text-text-primary text-base mb-1">{j.description?.substring(0, 80)}...</p>
                      <p className="text-xs text-text-tertiary font-bold uppercase tracking-widest">{j.category} • <span className="text-green-600">₹{j.estimated_cost}</span></p>
                    </div>
                    <div className="flex items-center gap-4">
                      <StatusBadge status={j.status} />
                      {j.status === 'assigned' && (
                        <button
                          onClick={async () => { await api.updateTenderStatus(j.tender_id, 'in_progress'); window.location.reload(); }}
                          className="btn-primary px-5 py-2 text-sm font-bold shadow-soft active:scale-95 transition-all"
                        >
                          Start Work
                        </button>
                      )}
                      {j.status === 'in_progress' && (
                        <button
                          onClick={() => setUpdatingTenderId(j.tender_id)}
                          className="btn-primary px-5 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 shadow-soft active:scale-95 transition-all"
                        >
                          Update Progress
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
      {updatingTenderId && (
        <WorkUpdateModal 
          tenderId={updatingTenderId} 
          onClose={() => setUpdatingTenderId(null)} 
          onSuccess={() => { setUpdatingTenderId(null); window.location.reload(); }} 
        />
      )}
    </div>
  );
}

function NearbyTenders() {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidForm, setBidForm] = useState({ tenderId: null, amount: '', proposal: '' });

  useEffect(() => { api.getNearbyTenders(10).then(d => setTenders(d.tenders || []))
    .catch(console.error).finally(() => setLoading(false)); }, []);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-text-primary mb-2 flex items-center gap-3">
          <MapPin size={28} className="text-secondary-500" /> Nearby Tenders
        </h1>
        <p className="text-text-secondary font-medium">Browse opportunities in your service area</p>
      </div>
      
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
          {[1,2,3,4].map(i => <SkeletonLoader key={i} type="card" />)}
        </div>
      ) : tenders.length === 0 ? (
        <div className="glass-card p-12 text-center border border-border-primary">
          <p className="text-text-tertiary font-medium">No nearby tenders found. Make sure your location is set in your profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tenders.map((t, index) => (
            <motion.div key={t.tender_id} whileHover={{ scale: 1.02 }} className="glass-card hover-3d p-6 border border-border-primary hover:border-secondary-500 transition-all group shadow-soft hover:shadow-lg animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="flex items-start justify-between mb-4">
                <span className={`priority-${t.priority} px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest`}>{t.priority}</span>
                <span className="text-xs font-bold text-text-tertiary flex items-center gap-1">
                  <MapPin size={12} /> {t.distance} km away
                </span>
              </div>
              <p className="font-bold text-text-primary text-lg mb-2 leading-tight group-hover:text-secondary-600 transition-colors">{t.description?.substring(0, 100)}...</p>
              <p className="text-xs text-text-tertiary mb-4 font-semibold uppercase tracking-wider">
                {t.category?.replace('_', ' ')} • by <span className="text-text-secondary">{t.citizen_name}</span>
              </p>
              <div className="flex items-center justify-between mb-5 bg-bg-secondary p-3 rounded-xl border border-border-primary">
                <div>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Est. Budget</p>
                  <p className="text-xl font-extrabold text-green-600">₹{t.estimated_cost}</p>
                </div>
                {t.hasApplied && <span className="px-3 py-1 bg-secondary-500/10 text-secondary-500 rounded-lg text-xs font-bold uppercase tracking-widest flex items-center gap-1"><CheckCircle size={12}/> Applied</span>}
              </div>
              {!t.hasApplied && (
                <Link
                  to={`/vendor/tender/${t.tender_id}`}
                  className="w-full block text-center py-3 bg-secondary-600 text-white hover:bg-secondary-700 rounded-xl text-sm font-bold shadow-soft transition-all active:scale-95"
                >
                  View Details & Bid
                </Link>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyJobs() {
  const [data, setData] = useState({ jobs: [], applications: [] });
  const [loading, setLoading] = useState(true);
  const [updatingTenderId, setUpdatingTenderId] = useState(null);

  useEffect(() => { api.getMyJobs().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-10">
      <div>
        <h1 className="text-3xl font-extrabold text-text-primary mb-2">💼 My Jobs & Applications</h1>
        <p className="text-text-secondary font-medium">Track your active contracts and pending bids</p>
      </div>

      <div className="space-y-6">
        <h2 className="text-xl font-bold text-text-primary flex items-center gap-2">
          <Briefcase size={22} className="text-secondary-500" /> Assigned Jobs
        </h2>
        {data.jobs?.length === 0 ? (
          <div className="glass-card p-8 text-center border border-border-primary">
            <p className="text-text-tertiary font-medium italic">No assigned jobs yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {data.jobs?.map(j => (
              <motion.div key={j.tender_id} whileHover={{ x: 5 }} className="glass-card hover-3d p-6 border border-border-primary hover:shadow-md transition-shadow bg-bg-secondary/30">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <p className="font-bold text-text-primary text-lg mb-2">{j.description?.substring(0, 100)}...</p>
                    <p className="text-xs font-bold text-text-tertiary uppercase tracking-widest flex flex-wrap gap-4">
                      <span>{j.category}</span>
                      <span className="text-green-600">₹{j.estimated_cost}</span>
                      <span className="text-secondary-500">{j.citizen_name}</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-3 w-full md:w-auto">
                    <StatusBadge status={j.status} />
                    {j.status === 'assigned' && (
                      <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'in_progress'); window.location.reload(); }}
                        className="px-6 py-2 bg-secondary-600 text-white rounded-xl text-xs font-bold shadow-soft hover:bg-secondary-700 transition-all">
                        Start
                      </button>
                    )}
                    {j.status === 'in_progress' && (
                      <button onClick={() => setUpdatingTenderId(j.tender_id)}
                        className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-bold shadow-soft hover:bg-green-700 transition-all">
                        Update Progress
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        <h2 className="text-xl font-bold text-text-primary mt-12 flex items-center gap-2">
          <Send size={22} className="text-accent-pink" /> My Applications
        </h2>
        {data.applications?.length === 0 ? (
          <div className="glass-card p-8 text-center border border-border-primary">
            <p className="text-text-tertiary font-medium italic">No applications yet</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {data.applications?.map(a => (
              <motion.div key={a.application_id} whileHover={{ scale: 1.02 }} className="glass-card hover-3d p-5 border border-border-primary flex items-center justify-between bg-bg-secondary/20">
                <div className="pr-4">
                  <p className="font-bold text-text-primary text-sm mb-1 truncate max-w-[200px] md:max-w-[300px]">{a.description?.substring(0, 60)}...</p>
                  <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">{a.category} • Bid: <span className="text-green-600">₹{a.bid_amount}</span></p>
                </div>
                <span className={`px-4 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${
                  a.status === 'accepted' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                  a.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                  'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                }`}>
                  {a.status}
                </span>
              </motion.div>
            ))}
          </div>
        )}
      </div>
      {updatingTenderId && (
        <WorkUpdateModal 
          tenderId={updatingTenderId} 
          onClose={() => setUpdatingTenderId(null)} 
          onSuccess={() => { setUpdatingTenderId(null); window.location.reload(); }} 
        />
      )}
    </div>
  );
}

function Profile() {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({ company_name: '', category: 'pothole', address: '', experience_years: 0, latitude: 19.076, longitude: 72.8777 });
  const [loading, setLoading] = useState(true);
  const [isNew, setIsNew] = useState(false);

  useEffect(() => {
    api.getVendorProfile()
      .then(d => { setProfile(d); setForm({ company_name: d.vendor.company_name || '', category: d.vendor.category || 'pothole', address: d.vendor.address || '', experience_years: d.vendor.experience_years || 0, latitude: d.vendor.latitude || 19.076, longitude: d.vendor.longitude || 72.8777 }); })
      .catch(() => setIsNew(true))
      .finally(() => setLoading(false));
  }, []);

  const save = async () => {
    try {
      if (isNew) { await api.registerVendor(form); }
      else { await api.updateVendorProfile(form); }
      alert('Profile saved!'); window.location.reload();
    } catch (err) { alert(err.message); }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto space-y-6 mt-10">
      <SkeletonLoader type="card" />
      <SkeletonLoader type="card" />
    </div>
  );

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="max-w-3xl mx-auto"
    >
      <div className="text-center mb-10">
        <motion.div 
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-secondary-500/20 to-accent-purple/20 border border-secondary-500/30 mb-4 shadow-glass"
        >
          <Building size={32} className="text-secondary-400 drop-shadow-glow" />
        </motion.div>
        <h1 className="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-white to-text-secondary mb-2">
          Business Profile
        </h1>
        <p className="text-text-tertiary font-medium">Configure your service details and coverage area</p>
      </div>

      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5 }}
        className="glass-card p-8 space-y-8 border border-border-primary shadow-2xl relative overflow-hidden"
      >
        {/* Decorative background glow */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-secondary-500/10 rounded-full blur-3xl pointer-events-none" />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          <motion.div whileFocus={{ scale: 1.02 }} className="space-y-2 group">
            <label className="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1 group-focus-within:text-secondary-400 transition-colors">Company Name</label>
            <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="input-futuristic w-full bg-bg-primary/50 focus:bg-bg-primary transition-all" placeholder="e.g. Acme Construction Co." />
          </motion.div>
          <motion.div whileFocus={{ scale: 1.02 }} className="space-y-2 group">
            <label className="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1 group-focus-within:text-accent-purple transition-colors">Primary Specialty</label>
            <div className="relative">
              <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
                className="input-futuristic w-full appearance-none bg-bg-primary/50 focus:bg-bg-primary transition-all pr-10 cursor-pointer">
                {['pothole', 'streetlight', 'water_leakage', 'garbage', 'road_damage', 'drainage', 'electrical'].map(c =>
                  <option key={c} value={c} className="bg-bg-secondary text-text-primary">{c.replace('_', ' ')}</option>)}
              </select>
              <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-text-tertiary">▼</div>
            </div>
          </motion.div>
        </div>

        <motion.div whileFocus={{ scale: 1.01 }} className="space-y-2 relative z-10 group">
          <label className="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1 group-focus-within:text-secondary-400 transition-colors">Office Address</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            className="input-futuristic w-full bg-bg-primary/50 focus:bg-bg-primary transition-all" placeholder="Full business address..." />
        </motion.div>

        <motion.div whileFocus={{ scale: 1.02 }} className="space-y-2 relative z-10 group">
          <label className="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1 group-focus-within:text-accent-pink transition-colors">Years of Experience</label>
          <input type="number" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })}
            className="input-futuristic w-full bg-bg-primary/50 focus:bg-bg-primary transition-all max-w-[200px]" />
        </motion.div>

        <div className="space-y-4 relative z-10">
          <label className="text-xs font-black text-text-tertiary uppercase tracking-widest ml-1 flex items-center gap-2">
            <MapPin size={16} className="text-secondary-500" /> Service Operations Center
          </label>
          <div className="border border-border-primary rounded-2xl overflow-hidden shadow-inner ring-1 ring-white/5 hover:ring-secondary-500/50 transition-all duration-500">
            <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          </div>
        </div>

        <motion.button 
          whileHover={{ scale: 1.02, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={save} 
          className="btn-primary w-full py-4 text-lg font-bold shadow-[0_0_20px_rgba(var(--color-secondary-500),0.3)] hover:shadow-[0_0_30px_rgba(var(--color-secondary-500),0.5)] transition-all flex items-center justify-center gap-3 relative z-10 overflow-hidden group"
        >
          <div className="absolute inset-0 w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-[shimmer_1.5s_infinite]" />
          {isNew ? (
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="w-5 h-5 object-contain" />
              <span>Create Business Profile</span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <CheckCircle size={20} />
              <span>Save Changes</span>
            </div>
          )}
        </motion.button>
      </motion.div>
    </motion.div>
  );
}

import NotificationsPanel from './NotificationsPanel';

export default function VendorDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="nearby" element={<NearbyTenders />} />
      <Route path="my-jobs" element={<MyJobs />} />
      <Route path="profile" element={<Profile />} />
      <Route path="notifications" element={<NotificationsPanel />} />
    </Routes>
  );
}
