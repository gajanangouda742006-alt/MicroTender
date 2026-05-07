import { useState, useEffect } from 'react';
import { Link, Routes, Route } from 'react-router-dom';
import api from '../api';
import MapPicker from '../components/MapPicker';
import { StatusBadge } from '../components/StatusTimeline';
import { MapPin, Briefcase, Send, User, Building, Star, DollarSign } from 'lucide-react';

function Overview() {
  const [profile, setProfile] = useState(null);
  const [jobs, setJobs] = useState({ jobs: [], applications: [] });
  useEffect(() => {
    api.getVendorProfile().then(d => setProfile(d)).catch(() => {});
    api.getMyJobs().then(setJobs).catch(() => {});
  }, []);

  const stats = {
    active: jobs.jobs?.filter(j => ['assigned', 'in_progress'].includes(j.status)).length || 0,
    completed: jobs.jobs?.filter(j => j.status === 'completed').length || 0,
    pending: jobs.applications?.filter(a => a.status === 'pending').length || 0,
  };

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold">Vendor Dashboard 🔧</h1>
      {!profile?.vendor ? (
        <div className="glass rounded-xl p-8 text-center">
          <p className="text-gray-400 mb-4">Complete your vendor profile to start receiving tenders</p>
          <a href="/vendor/profile" className="px-6 py-2 bg-primary-600 rounded-xl text-white font-medium">Setup Profile</a>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Rating', val: profile.vendor.rating_avg?.toFixed(1) || '0.0', icon: Star, color: 'from-amber-500 to-orange-500' },
              { label: 'Active Jobs', val: stats.active, icon: Briefcase, color: 'from-blue-500 to-cyan-500' },
              { label: 'Completed', val: stats.completed, icon: Briefcase, color: 'from-green-500 to-emerald-500' },
              { label: 'Pending Bids', val: stats.pending, icon: Send, color: 'from-purple-500 to-pink-500' },
            ].map(s => (
              <div key={s.label} className="glass rounded-xl p-4 hover:scale-[1.02] transition-transform">
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${s.color} flex items-center justify-center mb-3`}><s.icon size={20} className="text-white" /></div>
                <p className="text-2xl font-bold">{s.val}</p><p className="text-xs text-gray-400">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="glass rounded-xl p-5">
            <h2 className="font-semibold mb-4">Active Jobs</h2>
            {stats.active === 0 ? <p className="text-gray-500 text-sm">No active jobs</p> :
              <div className="space-y-3">{jobs.jobs?.filter(j => ['assigned', 'in_progress'].includes(j.status)).map(j => (
                <div key={j.tender_id} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                  <div><p className="font-medium text-sm">{j.description?.substring(0, 60)}...</p>
                    <p className="text-xs text-gray-500">{j.category} • ₹{j.estimated_cost}</p></div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={j.status} />
                    {j.status === 'assigned' && <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'in_progress'); window.location.reload(); }}
                      className="px-3 py-1 bg-orange-500 hover:bg-orange-600 rounded-lg text-xs text-white font-medium">Start Work</button>}
                    {j.status === 'in_progress' && <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'completed'); window.location.reload(); }}
                      className="px-3 py-1 bg-green-500 hover:bg-green-600 rounded-lg text-xs text-white font-medium">Complete</button>}
                  </div>
                </div>
              ))}</div>}
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
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">📍 Nearby Tenders</h1>
      {loading ? <p className="text-gray-500">Loading...</p> : tenders.length === 0 ?
        <div className="glass rounded-xl p-8 text-center"><p className="text-gray-400">No nearby tenders found. Make sure your location is set in your profile.</p></div> :
        <div className="grid grid-cols-2 gap-4">{tenders.map(t => (
          <div key={t.tender_id} className="glass rounded-xl p-5 hover:border-primary-500/50 transition-all">
            <div className="flex items-start justify-between mb-3">
              <span className={`priority-${t.priority} px-2 py-0.5 rounded-full text-xs font-medium`}>{t.priority}</span>
              <span className="text-xs text-gray-500">{t.distance} km away</span>
            </div>
            <p className="font-medium mb-1 text-sm">{t.description?.substring(0, 80)}...</p>
            <p className="text-xs text-gray-500 mb-3">{t.category?.replace('_', ' ')} • by {t.citizen_name}</p>
            <div className="flex items-center justify-between mb-3">
              <p className="text-green-400 font-bold">₹{t.estimated_cost}</p>
              {t.hasApplied && <span className="text-xs text-primary-400 font-medium">✅ Applied</span>}
            </div>
            {!t.hasApplied && (
              <Link 
                to={`/vendor/tender/${t.tender_id}`}
                className="w-full block text-center py-2 bg-primary-600/20 hover:bg-primary-600/40 text-primary-400 rounded-lg text-xs font-medium transition"
              >
                View Details & Bid
              </Link>
            )}
          </div>
        ))}</div>}
    </div>
  );
}

function MyJobs() {
  const [data, setData] = useState({ jobs: [], applications: [] });
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getMyJobs().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">💼 My Jobs & Applications</h1>
      <div className="space-y-4">
        <h2 className="font-semibold text-lg">Assigned Jobs</h2>
        {data.jobs?.length === 0 ? <p className="text-gray-500 text-sm glass rounded-xl p-4">No assigned jobs yet</p> :
          <div className="space-y-3">{data.jobs?.map(j => (
            <div key={j.tender_id} className="glass rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div><p className="font-medium">{j.description?.substring(0, 80)}...</p>
                  <p className="text-xs text-gray-500 mt-1">{j.category} • ₹{j.estimated_cost} • {j.citizen_name} ({j.citizen_phone})</p></div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  {j.status === 'assigned' && <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'in_progress'); window.location.reload(); }}
                    className="px-3 py-1.5 bg-orange-500 rounded-lg text-xs text-white font-medium">Start</button>}
                  {j.status === 'in_progress' && <button onClick={async () => { await api.updateTenderStatus(j.tender_id, 'completed'); window.location.reload(); }}
                    className="px-3 py-1.5 bg-green-500 rounded-lg text-xs text-white font-medium">Complete</button>}
                </div>
              </div>
            </div>
          ))}</div>}
        <h2 className="font-semibold text-lg mt-6">My Applications</h2>
        {data.applications?.length === 0 ? <p className="text-gray-500 text-sm glass rounded-xl p-4">No applications yet</p> :
          <div className="space-y-3">{data.applications?.map(a => (
            <div key={a.application_id} className="glass rounded-xl p-4 flex items-center justify-between">
              <div><p className="font-medium text-sm">{a.description?.substring(0, 60)}...</p>
                <p className="text-xs text-gray-500">{a.category} • Bid: ₹{a.bid_amount}</p></div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${a.status === 'accepted' ? 'bg-green-500/20 text-green-400' : a.status === 'rejected' ? 'bg-red-500/20 text-red-400' : 'bg-amber-500/20 text-amber-400'}`}>
                {a.status}</span>
            </div>))}</div>}
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

  if (loading) return <p className="text-gray-500">Loading...</p>;

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">👤 Vendor Profile</h1>
      <div className="glass rounded-xl p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-sm text-gray-400 mb-1 block">Company Name</label>
            <input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-500 transition" /></div>
          <div><label className="text-sm text-gray-400 mb-1 block">Specialty</label>
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-500">
              {['pothole', 'streetlight', 'water_leakage', 'garbage', 'road_damage', 'drainage', 'electrical'].map(c =>
                <option key={c} value={c} className="bg-dark-900">{c.replace('_', ' ')}</option>)}</select></div>
        </div>
        <div><label className="text-sm text-gray-400 mb-1 block">Address</label>
          <input value={form.address} onChange={e => setForm({ ...form, address: e.target.value })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-500" /></div>
        <div><label className="text-sm text-gray-400 mb-1 block">Experience (years)</label>
          <input type="number" value={form.experience_years} onChange={e => setForm({ ...form, experience_years: parseInt(e.target.value) || 0 })}
            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white outline-none focus:border-primary-500" /></div>
        <div><label className="text-sm text-gray-400 mb-1 block">Your Location</label>
          <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} /></div>
        <button onClick={save} className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl text-white font-semibold shadow-lg transition">
          {isNew ? '🚀 Create Profile' : '💾 Save Changes'}</button>
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
