import { useState, useEffect } from 'react';
import logo from '../assets/logo.png';
import { Link, Routes, Route } from 'react-router-dom';
import api from '../api';
import MapPicker from '../components/MapPicker';
import { StatusBadge } from '../components/StatusTimeline';
import { MapPin, Briefcase, Send, User, Building, Star, DollarSign, CheckCircle } from 'lucide-react';

function Overview() {
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState({ jobs: [], applications: [] });
  useEffect(() => {
    api.getVendorProfile().then(d => setProfile(d)).catch(() => { });
    api.getMyJobs().then(setJobs).catch(() => { });
  }, []);

  const stats = {
    active: jobs.jobs?.filter(j => ['assigned', 'in_progress'].includes(j.status)).length || 0,
    completed: jobs.jobs?.filter(j => j.status === 'completed').length || 0,
    pending: jobs.applications?.filter(a => a.status === 'pending').length || 0,
  };

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
              <div key={s.label} className="glass-card p-6 border border-border-primary animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>
                  <s.icon size={24} />
                </div>
                <p className="text-3xl font-bold text-text-primary mb-1">{s.val}</p>
                <p className="text-xs text-text-tertiary font-bold uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="glass-card p-6 border border-border-primary">
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
                  <div key={j.tender_id} className="flex items-center justify-between p-5 bg-bg-secondary rounded-2xl border border-border-primary hover:bg-bg-tertiary transition-all animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
                    <div className="flex-1">
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
                          onClick={async () => { await api.updateTenderStatus(j.tender_id, 'completed'); window.location.reload(); }}
                          className="btn-primary px-5 py-2 text-sm font-bold bg-green-600 hover:bg-green-700 shadow-soft active:scale-95 transition-all"
                        >
                          Complete
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function NearbyTenders() {
  const [tenders, setTenders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [bidForm, setBidForm] = useState({ tenderId: null, amount: '', proposal: '' });

  useEffect(() => { api.getNearbyTenders(10).then(d => setTenders(d.tenders || [])).catch(console.error).finally(() => setLoading(false)); }, []);

  const applyBid = async () => {
    try {
      await api.applyToTender(bidForm.tenderId, parseFloat(bidForm.amount), bidForm.proposal);
      alert('Bid submitted!'); setBidForm({ tenderId: null, amount: '', proposal: '' }); window.location.reload();
    } catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-extrabold text-text-primary mb-2 flex items-center gap-3">
          <MapPin size={28} className="text-secondary-500" /> Nearby Tenders
        </h1>
        <p className="text-text-secondary font-medium">Browse opportunities in your service area</p>
      </div>
      
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-secondary-500"></div>
        </div>
      ) : tenders.length === 0 ? (
        <div className="glass-card p-12 text-center border border-border-primary">
          <p className="text-text-tertiary font-medium">No nearby tenders found. Make sure your location is set in your profile.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tenders.map((t, index) => (
            <div key={t.tender_id} className="glass-card p-6 border border-border-primary hover:border-secondary-500 transition-all group shadow-soft hover:shadow-lg animate-fade-in" style={{ animationDelay: `${index * 0.05}s` }}>
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
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function MyJobs() {
  const [data, setData] = useState({ jobs: [], applications: [] });
  const [loading, setLoading] = useState(true);
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
              <div key={j.tender_id} className="glass-card p-6 border border-border-primary hover:shadow-md transition-shadow bg-bg-secondary/30">
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
                      <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'completed'); window.location.reload(); }}
                        className="px-6 py-2 bg-green-600 text-white rounded-xl text-xs font-bold shadow-soft hover:bg-green-700 transition-all">
                        Complete
                      </button>
                    )}
                  </div>
                </div>
              </div>
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
              <div key={a.application_id} className="glass-card p-5 border border-border-primary flex items-center justify-between bg-bg-secondary/20">
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
              </div>
            ))}
          </div>
        )}
      </div>
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
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-secondary-500"></div>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold text-text-primary mb-2 flex items-center justify-center gap-3">
          <Building size={32} className="text-secondary-500" /> Business Profile
        </h1>
        <p className="text-text-secondary font-medium">Configure your service details and coverage area</p>
      </div>

      <div className="glass-card p-8 space-y-8 border border-border-primary shadow-soft">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest ml-1">Company Name</label>
            <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="input-futuristic w-full" placeholder="e.g. Acme Construction Co." />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest ml-1">Primary Specialty</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="input-futuristic w-full appearance-none">
              {['pothole', 'streetlight', 'water_leakage', 'garbage', 'road_damage', 'drainage', 'electrical'].map(c =>
                <option key={c} value={c} className="bg-bg-primary text-text-primary">{c.replace('_', ' ')}</option>)}
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest ml-1">Office Address</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            className="input-futuristic w-full" placeholder="Full business address..." />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest ml-1">Years of Experience</label>
          <input type="number" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })}
            className="input-futuristic w-full" />
        </div>

        <div className="space-y-4">
          <label className="text-xs font-bold text-text-tertiary uppercase tracking-widest ml-1 flex items-center gap-2">
            <MapPin size={16} className="text-secondary-500" /> Service Operations Center
          </label>
          <div className="border border-border-primary rounded-2xl overflow-hidden shadow-inner">
            <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          </div>
        </div>

        <button onClick={save} className="btn-primary w-full py-4 text-lg font-bold shadow-soft hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-3">
          {isNew ? (
            <div className="flex items-center gap-2">
              <img src={logo} alt="" className="w-5 h-5 object-contain" />
              <span>Create Business Profile</span>
            </div>
          ) : (
            <>💾 Save Changes</>
          )}
        </button>
      </div>
    </div>
  );
}


export default function VendorDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="nearby" element={<NearbyTenders />} />
      <Route path="my-jobs" element={<MyJobs />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  );
}
