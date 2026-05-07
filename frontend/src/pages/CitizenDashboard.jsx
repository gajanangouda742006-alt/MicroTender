import { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import MapPicker from '../components/MapPicker';
import StatusTimeline from '../components/StatusTimeline';
import { StatusBadge } from '../components/StatusTimeline';
import { FileText, MapPin, Camera, Send, Star, Trophy, Clock, CheckCircle, AlertTriangle } from 'lucide-react';

function Overview() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { api.getComplaints().then(d => setComplaints(d.complaints)).catch(console.error).finally(() => setLoading(false)); }, []);

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => ['pending','under_review','tender_created'].includes(c.status)).length,
    active: complaints.filter(c => ['assigned','in_progress'].includes(c.status)).length,
    completed: complaints.filter(c => c.status === 'completed').length,
  };

  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome, {user?.name} 👋</h1>
        <p className="text-gray-400 text-sm">Track your civic complaints and contributions</p>
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[
          { label:'Total',val:stats.total,icon:FileText,color:'from-blue-500 to-cyan-500' },
          { label:'Pending',val:stats.pending,icon:Clock,color:'from-amber-500 to-orange-500' },
          { label:'Active',val:stats.active,icon:AlertTriangle,color:'from-purple-500 to-pink-500' },
          { label:'Resolved',val:stats.completed,icon:CheckCircle,color:'from-green-500 to-emerald-500' },
        ].map(s=>(
          <div key={s.label} className="glass rounded-xl p-4 hover:scale-[1.02] transition-transform">
            <div className={`w-10 h-10 rounded-lg bg-gradient-to-r ${s.color} flex items-center justify-center mb-3`}><s.icon size={20} className="text-white"/></div>
            <p className="text-2xl font-bold">{s.val}</p><p className="text-xs text-gray-400">{s.label} Complaints</p>
          </div>
        ))}
      </div>
      <div className="flex gap-4">
        <button onClick={()=>navigate('/citizen/new-complaint')} className="px-6 py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl text-white font-semibold shadow-lg shadow-primary-600/30 transition-all flex items-center gap-2">
          <FileText size={18}/>New Complaint</button>
        <button onClick={()=>navigate('/citizen/scoreboard')} className="px-6 py-3 glass hover:bg-white/10 rounded-xl text-white font-medium transition-all flex items-center gap-2">
          <Trophy size={18}/>Scoreboard</button>
      </div>
      <div className="glass rounded-xl p-5">
        <h2 className="font-semibold mb-4">Recent Complaints</h2>
        {loading ? <p className="text-gray-500">Loading...</p> : complaints.length===0 ? <p className="text-gray-500">No complaints yet</p> :
          <div className="space-y-3">{complaints.slice(0,5).map(c=>(
            <div key={c.complaint_id} onClick={()=>navigate(`/citizen/complaint/${c.complaint_id}`)}
              className="flex items-center justify-between p-3 bg-white/5 rounded-lg hover:bg-white/10 cursor-pointer transition">
              <div className="flex items-center gap-3">
                <span className="text-xl">{{'pothole':'🕳️','streetlight':'💡','water_leakage':'💧','garbage':'🗑️','road_damage':'🛣️','drainage':'🌊','electrical':'⚡'}[c.category]||'📋'}</span>
                <div><p className="text-sm font-medium">{c.description?.substring(0,60)}...</p>
                  <p className="text-xs text-gray-500">{c.category} • {new Date(c.created_at).toLocaleDateString()}</p></div>
              </div>
              <StatusBadge status={c.status}/>
            </div>))}</div>}
      </div>
    </div>
  );
}

function NewComplaint() {
  const [form, setForm] = useState({ category:'pothole', description:'', latitude:19.076, longitude:72.8777 });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const navigate = useNavigate();
  const categories = ['pothole','streetlight','water_leakage','garbage','road_damage','drainage','electrical','other'];

  const submit = async (e) => {
    e.preventDefault(); setLoading(true);
    try {
      const fd = new FormData();
      fd.append('category', form.category); fd.append('description', form.description);
      fd.append('latitude', form.latitude); fd.append('longitude', form.longitude);
      if (image) fd.append('image', image);
      const data = await api.createComplaint(fd);
      setResult(data);
    } catch (err) { alert(err.message); } finally { setLoading(false); }
  };

  if (result) return (
    <div className="animate-fade-in max-w-xl mx-auto">
      <div className="glass rounded-2xl p-8 text-center">
        <div className="text-5xl mb-4">✅</div>
        <h2 className="text-xl font-bold mb-2">Complaint Submitted!</h2>
        <p className="text-gray-400 mb-4">Your complaint has been registered and a micro-tender has been generated automatically.</p>
        <div className="bg-white/5 rounded-xl p-4 text-left space-y-2 text-sm mb-6">
          <p><span className="text-gray-400">Complaint ID:</span> #{result.complaint.complaint_id}</p>
          <p><span className="text-gray-400">Estimated Cost:</span> ₹{result.tender?.estimated_cost}</p>
          <p><span className="text-gray-400">Priority:</span> <span className={`priority-${result.tender?.priority} px-2 py-0.5 rounded-full text-xs`}>{result.tender?.priority}</span></p>
        </div>
        {result.fraudWarnings?.length>0&&<div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 mb-4 text-left">
          <p className="text-amber-400 text-xs font-medium mb-1">⚠️ Warnings:</p>
          {result.fraudWarnings.map((w,i)=><p key={i} className="text-xs text-amber-300">{w}</p>)}</div>}
        <button onClick={()=>navigate('/citizen')} className="px-6 py-2 bg-primary-600 hover:bg-primary-500 rounded-xl text-white font-medium transition">Back to Dashboard</button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">📝 New Complaint</h1>
      <form onSubmit={submit} className="space-y-5">
        <div className="glass rounded-xl p-5">
          <label className="text-sm text-gray-400 mb-2 block">Category</label>
          <div className="grid grid-cols-4 gap-2">
            {categories.map(c=>(
              <button key={c} type="button" onClick={()=>setForm({...form,category:c})}
                className={`py-2 px-3 rounded-lg text-xs font-medium transition-all ${form.category===c?'bg-primary-600 text-white':'bg-white/5 text-gray-400 hover:bg-white/10'}`}>
                {{'pothole':'🕳️','streetlight':'💡','water_leakage':'💧','garbage':'🗑️','road_damage':'🛣️','drainage':'🌊','electrical':'⚡','other':'📋'}[c]} {c.replace('_',' ')}
              </button>))}
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <label className="text-sm text-gray-400 mb-2 block">Description</label>
          <textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})} required rows={4}
            className="w-full bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:border-primary-500 outline-none p-3 transition resize-none"
            placeholder="Describe the issue in detail..." />
        </div>
        <div className="glass rounded-xl p-5">
          <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2"><Camera size={14}/>Photo (optional)</label>
          <input type="file" accept="image/*" capture="environment" onChange={e=>setImage(e.target.files[0])}
            className="w-full text-sm text-gray-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white file:font-medium file:cursor-pointer hover:file:bg-primary-500"/>
          {image&&<p className="text-xs text-green-400 mt-2">✅ {image.name}</p>}
        </div>
        <div className="glass rounded-xl p-5">
          <label className="text-sm text-gray-400 mb-2 block flex items-center gap-2"><MapPin size={14}/>Location</label>
          <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat,lng)=>setForm({...form,latitude:lat,longitude:lng})}/>
        </div>
        <button type="submit" disabled={loading} className="w-full py-3 bg-gradient-to-r from-primary-600 to-accent-600 hover:from-primary-500 hover:to-accent-500 rounded-xl text-white font-semibold shadow-lg disabled:opacity-50 flex items-center justify-center gap-2">
          {loading?'Submitting...':<><Send size={18}/>Submit Complaint</>}</button>
      </form>
    </div>
  );
}

function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => { api.getComplaints().then(d=>setComplaints(d.complaints)).catch(console.error).finally(()=>setLoading(false)); }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">📋 My Complaints</h1>
      {loading?<p className="text-gray-500">Loading...</p>:complaints.length===0?<p className="text-gray-500">No complaints found</p>:
        <div className="space-y-3">{complaints.map(c=>(
          <div key={c.complaint_id} onClick={()=>navigate(`/citizen/complaint/${c.complaint_id}`)}
            className="glass rounded-xl p-4 hover:bg-white/10 cursor-pointer transition flex items-center justify-between">
            <div className="flex items-center gap-4">
              <span className="text-2xl">{{'pothole':'🕳️','streetlight':'💡','water_leakage':'💧','garbage':'🗑️','road_damage':'🛣️','drainage':'🌊','electrical':'⚡'}[c.category]||'📋'}</span>
              <div><p className="font-medium">{c.description?.substring(0,80)}...</p>
                <p className="text-xs text-gray-500 mt-1">#{c.complaint_id} • {c.category.replace('_',' ')} • {new Date(c.created_at).toLocaleDateString()}</p></div>
            </div>
            <StatusBadge status={c.status}/>
          </div>))}</div>}
    </div>
  );
}

function ComplaintDetail() {
  const id = window.location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState({ score:5, feedback:'' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getComplaint(id).then(setData).catch(console.error).finally(()=>setLoading(false)); }, [id]);

  const submitRating = async () => {
    try { await api.rateComplaint(id, rating.score, rating.feedback); alert('Rating submitted!'); window.location.reload(); }
    catch(err) { alert(err.message); }
  };

  if (loading) return <p className="text-gray-500">Loading...</p>;
  if (!data) return <p className="text-gray-500">Complaint not found</p>;
  const { complaint, tender, applications, rating: existingRating } = data;

  return (
    <div className="animate-fade-in max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold">Complaint #{complaint.complaint_id}</h1>
      <div className="grid grid-cols-2 gap-6">
        <div className="glass rounded-xl p-5 space-y-4">
          <h2 className="font-semibold">Details</h2>
          <div className="space-y-2 text-sm">
            <p><span className="text-gray-400">Category:</span> {complaint.category.replace('_',' ')}</p>
            <p><span className="text-gray-400">Description:</span> {complaint.description}</p>
            <p><span className="text-gray-400">Location:</span> {complaint.latitude?.toFixed(4)}, {complaint.longitude?.toFixed(4)}</p>
            <p><span className="text-gray-400">Filed:</span> {new Date(complaint.created_at).toLocaleString()}</p>
          </div>
          {complaint.image_url&&<img src={complaint.image_url} alt="Complaint" className="rounded-lg w-full max-h-48 object-cover"/>}
        </div>
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-4">Status Timeline</h2>
          <StatusTimeline currentStatus={complaint.status}/>
        </div>
      </div>
      {tender&&(
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-3">Micro-Tender</h2>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div><span className="text-gray-400">Estimated Cost:</span><p className="text-lg font-bold text-green-400">₹{tender.estimated_cost}</p></div>
            <div><span className="text-gray-400">Priority:</span><p><span className={`priority-${tender.priority} px-2 py-0.5 rounded-full text-xs`}>{tender.priority}</span></p></div>
            <div><span className="text-gray-400">Vendor:</span><p className="font-medium">{tender.vendor_company||'Not assigned'}</p></div>
          </div>
        </div>
      )}
      {complaint.status==='completed'&&!existingRating&&(
        <div className="glass rounded-xl p-5">
          <h2 className="font-semibold mb-3">Rate the Vendor</h2>
          <div className="flex gap-2 mb-3">
            {[1,2,3,4,5].map(s=>(<button key={s} onClick={()=>setRating({...rating,score:s})}
              className={`text-2xl transition-transform hover:scale-125 ${s<=rating.score?'':'opacity-30'}`}>{s<=rating.score?'⭐':'☆'}</button>))}
          </div>
          <textarea value={rating.feedback} onChange={e=>setRating({...rating,feedback:e.target.value})} rows={2} placeholder="Your feedback..."
            className="w-full bg-white/5 border border-white/10 rounded-xl text-white p-3 mb-3 outline-none focus:border-primary-500 text-sm resize-none"/>
          <button onClick={submitRating} className="px-4 py-2 bg-primary-600 hover:bg-primary-500 rounded-lg text-white text-sm font-medium">Submit Rating</button>
        </div>
      )}
    </div>
  );
}

function Scoreboard() {
  const [board, setBoard] = useState([]);
  useEffect(() => { api.getScoreboard().then(d=>setBoard(d.scoreboard)).catch(console.error); }, []);

  return (
    <div className="animate-fade-in">
      <h1 className="text-2xl font-bold mb-6">🏆 Citizen Scoreboard</h1>
      <div className="glass rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-white/10">
            <th className="text-left p-4 text-gray-400">Rank</th><th className="text-left p-4 text-gray-400">Citizen</th>
            <th className="text-left p-4 text-gray-400">Score</th><th className="text-left p-4 text-gray-400">Complaints</th>
            <th className="text-left p-4 text-gray-400">Resolved</th></tr></thead>
          <tbody>{board.map((u,i)=>(
            <tr key={u.user_id} className="border-b border-white/5 hover:bg-white/5">
              <td className="p-4 font-bold">{i<3?['🥇','🥈','🥉'][i]:`#${i+1}`}</td>
              <td className="p-4 font-medium">{u.name}</td>
              <td className="p-4"><span className="bg-primary-600/20 text-primary-400 px-2 py-0.5 rounded-full text-xs">{u.reputation_score}</span></td>
              <td className="p-4">{u.total_complaints}</td>
              <td className="p-4 text-green-400">{u.resolved_complaints}</td>
            </tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}

export default function CitizenDashboard() {
  return (
    <Routes>
      <Route index element={<Overview/>}/>
      <Route path="new-complaint" element={<NewComplaint/>}/>
      <Route path="my-complaints" element={<MyComplaints/>}/>
      <Route path="complaint/:id" element={<ComplaintDetail/>}/>
      <Route path="scoreboard" element={<Scoreboard/>}/>
    </Routes>
  );
}
