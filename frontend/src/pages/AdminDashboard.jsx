import { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import api from '../api';
import { StatusBadge } from '../components/StatusTimeline';
import { BarChart3, Users, FileText, AlertTriangle, Shield, DollarSign, TrendingUp, CheckCircle } from 'lucide-react';
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import MapCluster from '../components/MapCluster';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, ArcElement, Title, Tooltip, Legend);
const chartOpts = { 
  responsive: true, 
  plugins: { 
    legend: { labels: { color: '#94a3b8', font: { size: 10 } } } 
  }, 
  scales: { 
    x: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } }, 
    y: { ticks: { color: '#64748b', font: { size: 10 } }, grid: { color: 'rgba(255,255,255,0.05)' } } 
  } 
};

function Overview() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.getDashboard().then(setData).catch(console.error).finally(() => setLoading(false)); }, []);

  if (loading) return <div className="p-20 text-center text-gray-500">Loading analytics...</div>;
  if (!data) return <p className="text-red-400">Failed to load dashboard</p>;
  const { overview: o, categoryStats, priorityStats, monthlyTrend, topVendors, costs, fraudAlerts } = data;

  const [allComplaints, setAllComplaints] = useState([]);
  useEffect(() => { api.getComplaints().then(d => setAllComplaints(d.complaints)); }, []);

  const trendChart = {
    labels: monthlyTrend.map(t => t.month),
    datasets: [{
      label: 'New Complaints',
      data: monthlyTrend.map(t => t.count),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99, 102, 241, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  const catChart = {
    labels: categoryStats.map(c => c.category.replace('_', ' ')),
    datasets: [{ label: 'Total', data: categoryStats.map(c => c.count), backgroundColor: 'rgba(99,102,241,0.7)', borderRadius: 6 },
      { label: 'Completed', data: categoryStats.map(c => c.completed), backgroundColor: 'rgba(34,197,94,0.7)', borderRadius: 6 }]
  };
  const prioChart = {
    labels: priorityStats.map(p => p.priority), datasets: [{
      data: priorityStats.map(p => p.count),
      backgroundColor: ['rgba(34,197,94,0.8)', 'rgba(245,158,11,0.8)', 'rgba(249,115,22,0.8)', 'rgba(239,68,68,0.8)']
    }]
  };

  return (
    <div className="animate-fade-in space-y-6">
      <h1 className="text-2xl font-bold">Admin Dashboard 🛡️</h1>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: 'Complaints', val: o.totalComplaints, sub: `${o.pendingComplaints} pending`, icon: FileText, color: 'from-blue-500 to-cyan-500' },
          { label: 'Tenders', val: o.totalTenders, sub: `${o.openTenders} open`, icon: BarChart3, color: 'from-purple-500 to-pink-500' },
          { label: 'Vendors', val: o.totalVendors, sub: `${o.totalApplications} bids`, icon: Users, color: 'from-amber-500 to-orange-500' },
          { label: 'Completed', val: o.completedComplaints, sub: `₹${Math.round(costs.totalEstimatedCost).toLocaleString()}`, icon: CheckCircle, color: 'from-green-500 to-emerald-500' },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-4 hover:scale-[1.02] transition-transform">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${s.color} flex items-center justify-center mb-3`}><s.icon size={20} className="text-white" /></div>
            <p className="text-2xl font-bold">{s.val}</p><p className="text-xs text-gray-400">{s.label}</p>
            <p className="text-xs text-gray-500 mt-1">{s.sub}</p>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 glass rounded-xl p-5"><h2 className="font-semibold mb-4">Complaint Trends</h2><Line data={trendChart} options={chartOpts} /></div>
        <div className="glass rounded-xl p-5"><h2 className="font-semibold mb-4">Priority Distribution</h2><div className="max-w-[200px] mx-auto"><Doughnut data={prioChart} /></div></div>
      </div>
      
      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-4">Live Incident Map</h2>
        <MapCluster items={allComplaints} height="400px" />
      </div>

      <div className="glass rounded-xl p-5"><h2 className="font-semibold mb-4">Complaints by Category</h2><Bar data={catChart} options={chartOpts} /></div>
      <div className="grid grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4">Top Vendors ⭐</h2>
          <div className="space-y-2">{topVendors.slice(0, 5).map((v, i) => (
            <div key={v.vendor_id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
              <div className="flex items-center gap-3"><span className="font-bold text-gray-500">{i + 1}</span>
                <div><p className="font-medium">{v.company_name || v.vendor_name}</p><p className="text-xs text-gray-500">{v.total_jobs_completed} jobs</p></div></div>
              <span className="text-amber-400 font-bold">⭐ {v.rating_avg?.toFixed(1)}</span>
            </div>))}</div>
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4 flex items-center gap-2"><AlertTriangle size={16} className="text-red-400" />Fraud Alerts ({fraudAlerts.length})</h2>
          {fraudAlerts.length === 0 ? <p className="text-gray-500 text-sm">No active alerts</p> :
            <div className="space-y-2">{fraudAlerts.slice(0, 5).map(a => (
              <div key={a.log_id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg text-sm">
                <div><p className="font-medium text-sm">{a.type.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500">{a.user_name} • {a.description?.substring(0, 40)}</p></div>
                <span className={`priority-${a.severity} px-2 py-0.5 rounded-full text-xs`}>{a.severity}</span>
              </div>))}</div>}
        </div>
      </div>
    </div>
  );
}

function ComplaintsMgmt() {
  const [complaints, setComplaints] = useState([]);
  const [tenders, setTenders] = useState([]);
  const [filter, setFilter] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getComplaints(filter ? `status=${filter}` : ''), api.getTenders()])
      .then(([c, t]) => { setComplaints(c.complaints); setTenders(t.tenders); })
      .catch(console.error).finally(() => setLoading(false));
  }, [filter]);

  const handleAutoAssign = async (tenderId) => {
    try { const r = await api.autoAssign(tenderId); alert(`Assigned to ${r.assignedVendor.vendor_name}`); window.location.reload(); }
    catch (err) { alert(err.message); }
  };

  const handleAction = async (tenderId, action) => {
    const notes = prompt('Notes (optional):');
    try { await api.adminAction(tenderId, action, notes); alert('Done!'); window.location.reload(); }
    catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">📋 Complaints & Tenders</h1>
        <select value={filter} onChange={e => setFilter(e.target.value)}
          className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white outline-none">
          <option value="" className="bg-dark-900">All Status</option>
          {['pending', 'tender_created', 'assigned', 'in_progress', 'completed', 'rejected'].map(s =>
            <option key={s} value={s} className="bg-dark-900">{s.replace('_', ' ')}</option>)}
        </select>
      </div>
      {loading ? <p className="text-gray-500">Loading...</p> :
        <div className="space-y-3">{complaints.map(c => {
          const tender = tenders.find(t => t.complaint_id === c.complaint_id);
          return (
            <div key={c.complaint_id} className="glass rounded-xl p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1"><p className="font-medium">{c.description?.substring(0, 100)}</p>
                  <p className="text-xs text-gray-500 mt-1">#{c.complaint_id} • {c.category.replace('_', ' ')} • {c.citizen_name} • {new Date(c.created_at).toLocaleDateString()}</p></div>
                <StatusBadge status={c.status} />
              </div>
              {tender && (
                <div className="mt-3 p-3 bg-white/5 rounded-lg">
                  <div className="flex items-center justify-between text-sm mb-2">
                    <div className="flex items-center gap-4">
                      <span>AI Cost: <strong className="text-green-400">₹{tender.estimated_cost}</strong></span>
                      {tender.manual_cost && <span>Manual: <strong className="text-blue-400">₹{tender.manual_cost}</strong></span>}
                      <span className={`priority-${tender.priority} px-2 py-0.5 rounded-full text-xs`}>{tender.priority}</span>
                    </div>
                    <div className="flex gap-2">
                      {tender.status === 'open' && <button onClick={() => handleAutoAssign(tender.tender_id)}
                        className="px-3 py-1 bg-primary-600 hover:bg-primary-500 rounded-lg text-xs text-white font-medium">Auto-Assign</button>}
                      {['assigned', 'in_progress'].includes(tender.status) && <>
                        <button onClick={() => handleAction(tender.tender_id, 'complete')} className="px-3 py-1 bg-green-600 rounded-lg text-xs text-white">Complete</button>
                        <button onClick={() => handleAction(tender.tender_id, 'reassign')} className="px-3 py-1 bg-amber-600 rounded-lg text-xs text-white">Reassign</button>
                        <button onClick={() => handleAction(tender.tender_id, 'warn_vendor')} className="px-3 py-1 bg-red-600 rounded-lg text-xs text-white">Warn</button>
                      </>}
                      {tender.status !== 'completed' && tender.status !== 'cancelled' &&
                        <button onClick={() => handleAction(tender.tender_id, 'cancel')} className="px-3 py-1 bg-gray-600 rounded-lg text-xs text-white">Cancel</button>}
                    </div>
                  </div>
                  {tender.vendor_company && <p className="text-xs text-gray-400">Assigned to: {tender.vendor_company}</p>}
                </div>
              )}
            </div>
          );
        })}</div>}
    </div>
  );
}

function VendorsMgmt() {
  const [vendors, setVendors] = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getAllVendors().then(d => setVendors(d.vendors)).catch(console.error).finally(() => setLoading(false)); }, []);

  const viewDetails = async (id) => {
    try { const d = await api.getVendorDetails(id); setSelected(d); } catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">👥 Vendor Management</h1>
      <div className="grid grid-cols-3 gap-4">
        <div className="col-span-2">
          {loading ? <p className="text-gray-500">Loading...</p> :
            <div className="space-y-3">{vendors.map(v => (
              <div key={v.vendor_id} onClick={() => viewDetails(v.vendor_id)}
                className="glass rounded-xl p-4 hover:bg-white/10 cursor-pointer transition flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 flex items-center justify-center font-bold">{v.name?.[0]}</div>
                  <div><p className="font-medium">{v.company_name || v.name}</p>
                    <p className="text-xs text-gray-500">{v.category?.replace('_', ' ')} • {v.email} • {v.phone}</p></div>
                </div>
                <div className="flex items-center gap-4 text-sm">
                  <span className="text-amber-400">⭐ {v.rating_avg?.toFixed(1)}</span>
                  <span className="text-gray-400">{v.total_jobs_completed} jobs</span>
                  <span className={`px-2 py-0.5 rounded-full text-xs ${v.is_active ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {v.is_active ? 'Active' : 'Inactive'}</span>
                </div>
              </div>))}</div>}
        </div>
        {selected && (
          <div className="glass rounded-xl p-5 space-y-4 sticky top-6 max-h-[80vh] overflow-y-auto">
            <h2 className="font-semibold">{selected.vendor.company_name || selected.vendor.name}</h2>
            <div className="space-y-2 text-sm">
              <p><span className="text-gray-400">Email:</span> {selected.vendor.email}</p>
              <p><span className="text-gray-400">Phone:</span> {selected.vendor.phone}</p>
              <p><span className="text-gray-400">ID:</span> {selected.vendor.govt_id_type} - {selected.vendor.govt_id_number}</p>
              <p><span className="text-gray-400">Experience:</span> {selected.vendor.experience_years} years</p>
              <p><span className="text-gray-400">Address:</span> {selected.vendor.address}</p>
              <p><span className="text-gray-400">Rating:</span> ⭐ {selected.vendor.rating_avg?.toFixed(1)} ({selected.vendor.total_ratings} reviews)</p>
              <p><span className="text-gray-400">Reputation:</span> {selected.vendor.reputation_score}</p>
            </div>
            {selected.misuseAlerts?.length > 0 && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3">
                <p className="text-red-400 text-xs font-medium mb-2">⚠️ Misuse Alerts</p>
                {selected.misuseAlerts.map((a, i) => <p key={i} className="text-xs text-red-300">{a.message}</p>)}
              </div>
            )}
            <div><p className="text-gray-400 text-xs mb-2">Recent Ratings</p>
              {selected.ratings?.slice(0, 3).map(r => (
                <div key={r.rating_id} className="p-2 bg-white/5 rounded-lg text-xs mb-1">
                  <p>{'⭐'.repeat(r.score)} by {r.citizen_name}</p>
                  {r.feedback && <p className="text-gray-500 mt-1">{r.feedback}</p>}
                </div>))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function FraudAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showResolved, setShowResolved] = useState(false);

  useEffect(() => { api.getFraudAlerts(showResolved ? 'true' : 'false').then(d => setAlerts(d.alerts)).catch(console.error).finally(() => setLoading(false)); }, [showResolved]);

  const resolve = async (id) => {
    try { await api.resolveFraudAlert(id); setAlerts(alerts.filter(a => a.log_id !== id)); } catch (err) { alert(err.message); }
  };

  return (
    <div className="animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">🚨 Fraud Alerts</h1>
        <button onClick={() => setShowResolved(!showResolved)}
          className="px-4 py-2 glass rounded-xl text-sm hover:bg-white/10 transition">
          {showResolved ? 'Show Active' : 'Show Resolved'}</button>
      </div>
      {loading ? <p className="text-gray-500">Loading...</p> : alerts.length === 0 ?
        <div className="glass rounded-xl p-8 text-center"><p className="text-gray-400">No {showResolved ? 'resolved' : 'active'} alerts</p></div> :
        <div className="space-y-3">{alerts.map(a => (
          <div key={a.log_id} className="glass rounded-xl p-4 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                a.severity === 'critical' ? 'bg-red-500/20 text-red-400' : a.severity === 'high' ? 'bg-orange-500/20 text-orange-400' : a.severity === 'medium' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400'
              }`}><AlertTriangle size={20} /></div>
              <div><p className="font-medium text-sm">{a.type.replace(/_/g, ' ')}</p>
                <p className="text-xs text-gray-500">{a.user_name} ({a.user_role}) • {a.description?.substring(0, 60)}</p>
                <p className="text-xs text-gray-600">{new Date(a.created_at).toLocaleString()}</p></div>
            </div>
            <div className="flex items-center gap-3">
              <span className={`priority-${a.severity} px-2.5 py-1 rounded-full text-xs font-medium`}>{a.severity}</span>
              {!a.resolved && <button onClick={() => resolve(a.log_id)} className="px-3 py-1.5 bg-green-600 hover:bg-green-500 rounded-lg text-xs text-white font-medium">Resolve</button>}
            </div>
          </div>))}</div>}
    </div>
  );
}

export default function AdminDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="complaints" element={<ComplaintsMgmt />} />
      <Route path="vendors" element={<VendorsMgmt />} />
      <Route path="fraud" element={<FraudAlerts />} />
    </Routes>
  );
}
