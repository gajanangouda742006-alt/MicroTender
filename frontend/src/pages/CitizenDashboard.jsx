import { useState, useEffect, useRef } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import MapPicker from '../components/MapPicker';
import StatusTimeline from '../components/StatusTimeline';
import { StatusBadge } from '../components/StatusTimeline';
import { FileText, MapPin, Camera, Send, Star, Trophy, Clock, CheckCircle, AlertTriangle, Briefcase, X } from 'lucide-react';

function Overview() {
  const { user } = useAuth();
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => { api.getComplaints().then(d => setComplaints(d.complaints)).catch(console.error).finally(() => setLoading(false)); }, []);

  const stats = {
    total: complaints.length,
    pending: complaints.filter(c => ['pending', 'under_review', 'tender_created'].includes(c.status)).length,
    active: complaints.filter(c => ['assigned', 'in_progress'].includes(c.status)).length,
    completed: complaints.filter(c => c.status === 'completed').length,
  };

  return (
    <div className="animate-fade-in space-y-8">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-text-primary">
          Welcome, {user?.name} 🚀
        </h1>
        <p className="text-text-secondary text-sm font-medium">Track your civic complaints and contributions to the community</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Total', val: stats.total, icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: 'Pending', val: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
          { label: 'Active', val: stats.active, icon: AlertTriangle, color: 'bg-purple-50 text-purple-600' },
          { label: 'Resolved', val: stats.completed, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
        ].map((s, index) => (
          <div key={s.label} className="glass-card p-6 border border-border-primary animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
            <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4`}>
              <s.icon size={24} />
            </div>
            <p className="text-3xl font-bold text-text-primary mb-1">{s.val}</p>
            <p className="text-sm text-text-tertiary font-bold uppercase tracking-wider">{s.label} Complaints</p>
          </div>
        ))}
      </div>
      <div className="flex flex-col sm:flex-row gap-4">
        <button onClick={() => navigate('/citizen/new-complaint')} className="btn-primary px-8 py-4 font-bold shadow-soft flex items-center justify-center gap-3">
          <FileText size={20} />New Complaint</button>
        <button onClick={() => navigate('/citizen/scoreboard')} className="btn-secondary px-8 py-4 font-bold flex items-center justify-center gap-3">
          <Trophy size={20} />Scoreboard</button>
      </div>
      <div className="glass-card p-6 border border-border-primary">
        <h2 className="text-xl font-bold mb-6 text-text-primary flex items-center gap-2">
          <FileText size={20} className="text-secondary-500" /> Recent Complaints
        </h2>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-secondary-500"></div>
            <span className="ml-3 text-text-tertiary font-medium">Loading activity...</span>
          </div>
        ) : complaints.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-4 opacity-20">📋</div>
            <p className="text-text-tertiary mb-6 font-medium">No complaints yet</p>
            <button onClick={() => navigate('/citizen/new-complaint')} className="btn-primary px-8 py-2.5">
              Create Your First Complaint
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {complaints.slice(0, 5).map((c, index) => (
              <div key={c.complaint_id} onClick={() => navigate(`/citizen/complaint/${c.complaint_id}`)}
                className="flex items-center justify-between p-5 bg-bg-secondary rounded-2xl hover:bg-white hover:shadow-md cursor-pointer transition-all border border-transparent hover:border-border-primary animate-fade-in group"
                style={{ animationDelay: `${index * 0.1}s` }}>
                <div className="flex items-center gap-5">
                  <div className="text-3xl grayscale group-hover:grayscale-0 transition-all">
                    {{ 'pothole': '🕳️', 'streetlight': '💡', 'water_leakage': '💧', 'garbage': '🗑️', 'road_damage': '🛣️', 'drainage': '🌊', 'electrical': '⚡' }[c.category] || '📋'}
                  </div>
                  <div>
                    <p className="text-base font-bold text-text-primary group-hover:text-secondary-600 transition-colors">{c.description?.substring(0, 80)}...</p>
                    <p className="text-xs text-text-tertiary mt-1 font-semibold uppercase tracking-wide">{c.category.replace('_', ' ')} • {new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                </div>
                <StatusBadge status={c.status} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function CameraModal({ onCapture, onClose }) {
  const videoRef = useRef(null);
  const [stream, setStream] = useState(null);

  useEffect(() => {
    async function startCamera() {
      try {
        const s = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'environment' },
          audio: false
        });
        setStream(s);
        if (videoRef.current) videoRef.current.srcObject = s;
      } catch (err) {
        console.error("Camera error:", err);
        alert("Could not access camera. Please check permissions.");
        onClose();
      }
    }
    startCamera();
    return () => { if (stream) stream.getTracks().forEach(t => t.stop()); };
  }, []);

  const capture = () => {
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      const file = new File([blob], `capture_${Date.now()}.jpg`, { type: 'image/jpeg' });
      onCapture(file);
      onClose();
    }, 'image/jpeg', 0.8);
  };

  return (
    <div className="fixed inset-0 z-[100] bg-black flex flex-col items-center justify-center animate-fade-in">
      <div className="relative w-full h-full flex flex-col">
        <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
        <div className="absolute bottom-10 left-0 right-0 flex justify-center items-center gap-10">
          <button onClick={onClose} className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white border border-white/30 hover:bg-white/40 transition-all">
            <X size={28} />
          </button>
          <button onClick={capture} className="w-20 h-20 bg-white rounded-full border-8 border-white/30 flex items-center justify-center hover:scale-110 active:scale-90 transition-all shadow-2xl">
            <div className="w-14 h-14 bg-red-500 rounded-full" />
          </button>
          <div className="w-16" /> {/* Spacer */}
        </div>
        <div className="absolute top-10 left-0 right-0 text-center">
          <p className="text-white font-bold text-lg drop-shadow-md">Capture Evidence</p>
        </div>
      </div>
    </div>
  );
}

function NewComplaint() {
  const [form, setForm] = useState({ category: 'pothole', description: '', latitude: 19.076, longitude: 72.8777 });
  const [image, setImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const navigate = useNavigate();
  const categories = ['pothole', 'streetlight', 'water_leakage', 'garbage', 'road_damage', 'drainage', 'electrical', 'other'];

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
    <div className="animate-fade-in max-w-2xl mx-auto">
      <div className="glass-card p-10 text-center border border-border-primary">
        <div className="text-7xl mb-8 animate-float">✅</div>
        <h2 className="text-3xl font-extrabold mb-4 text-text-primary">Submission Successful!</h2>
        <p className="text-text-secondary text-lg mb-8 max-w-md mx-auto font-medium">Your complaint has been registered and a micro-tender has been generated automatically.</p>
        <div className="bg-surface-tertiary rounded-2xl p-8 text-left space-y-4 mb-8 border border-border-primary">
          <div className="flex justify-between items-center pb-3 border-b border-border-primary">
            <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Complaint ID</span>
            <span className="text-secondary-600 font-mono font-bold text-lg">#{result.complaint.complaint_id}</span>
          </div>
          <div className="flex justify-between items-center pb-3 border-b border-border-primary">
            <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">AI Estimated Cost</span>
            <span className="text-green-600 font-extrabold text-xl">₹{result.tender?.estimated_cost}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Priority Level</span>
            <span className={`priority-${result.tender?.priority} px-4 py-1 rounded-full text-xs font-bold uppercase tracking-widest`}>{result.tender?.priority}</span>
          </div>
        </div>
        {result.fraudWarnings?.length > 0 && <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-5 mb-8 text-left">
          <p className="text-red-500 text-sm font-bold mb-3 flex items-center gap-2 uppercase tracking-wider">
            <AlertTriangle size={18} /> Verification Warnings:
          </p>
          {result.fraudWarnings.map((w, i) => <p key={i} className="text-xs text-red-500/80 font-medium mb-1 leading-relaxed">• {w}</p>)}</div>}
        <button onClick={() => navigate('/citizen')} className="btn-primary px-12 py-3.5 text-lg font-bold">
          Return to Dashboard
        </button>
      </div>
    </div>
  );

  return (
    <div className="animate-fade-in max-w-3xl mx-auto">
      <div className="text-center mb-10">
        <h1 className="text-3xl font-extrabold mb-3 text-text-primary">
          📝 Report an Issue
        </h1>
        <p className="text-text-secondary font-medium">Help us identify and fix civic problems in your area</p>
      </div>
      <form onSubmit={submit} className="space-y-6">
        <div className="glass-card p-8 border border-border-primary">
          <label className="text-xs font-bold text-text-tertiary mb-5 block flex items-center gap-2 uppercase tracking-wider">
            <AlertTriangle size={16} className="text-secondary-500" /> Select Issue Category
          </label>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {categories.map(c => (
              <button key={c} type="button" onClick={() => setForm({ ...form, category: c })}
                className={`py-4 px-4 rounded-2xl text-xs font-bold transition-all uppercase tracking-tighter ${form.category === c
                    ? 'bg-secondary-500 text-white shadow-soft ring-4 ring-secondary-500/20'
                    : 'bg-bg-secondary text-text-tertiary border border-border-primary hover:bg-bg-tertiary hover:border-secondary-500/50'
                  }`}>
                <span className="text-2xl block mb-2 grayscale group-hover:grayscale-0 transition-all">{{ 'pothole': '🕳️', 'streetlight': '💡', 'water_leakage': '💧', 'garbage': '🗑️', 'road_damage': '🛣️', 'drainage': '🌊', 'electrical': '⚡', 'other': '📋' }[c]}</span>
                {c.replace('_', ' ')}
              </button>))}
          </div>
        </div>
        <div className="glass-card p-8 border border-border-primary">
          <label className="text-xs font-bold text-text-tertiary mb-3 block uppercase tracking-wider">Issue Description</label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4}
            className="input-futuristic w-full text-sm leading-relaxed"
            placeholder="Please provide details about the problem (e.g. location details, severity)..." />
        </div>
        <div className="glass-card p-8 border border-border-primary">
          <label className="text-xs font-bold text-text-tertiary mb-4 block flex items-center gap-2 uppercase tracking-wider">
            <Camera size={18} className="text-accent-pink" /> Add Photo Evidence
          </label>
          <div className="space-y-4">
            <div className="relative group">
              <input type="file" accept="image/*" onChange={e => setImage(e.target.files[0])}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
              <div className="bg-bg-secondary border-2 border-dashed border-border-primary rounded-2xl p-8 text-center group-hover:border-secondary-500 group-hover:bg-bg-tertiary transition-all">
                {image ? (
                  <div className="relative inline-block group/preview">
                    <img src={URL.createObjectURL(image)} alt="Preview" className="mx-auto h-32 w-auto rounded-xl object-cover border border-border-primary shadow-sm" />
                    <div className="absolute inset-0 bg-black/40 rounded-xl opacity-0 group-hover/preview:opacity-100 transition-opacity flex items-center justify-center">
                      <span className="text-white text-xs font-bold">Replace Photo</span>
                    </div>
                  </div>
                ) : (
                  <Camera size={40} className="mx-auto text-text-tertiary mb-4 group-hover:text-secondary-500 transition-colors" />
                )}
                <p className="text-sm font-bold text-text-secondary mt-4">{image ? image.name : 'Click or tap to upload photo'}</p>
                <p className="text-xs text-text-tertiary mt-2">JPG, PNG or WEBP formats supported</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex-1 h-[1px] bg-border-primary"></div>
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">or</span>
              <div className="flex-1 h-[1px] bg-border-primary"></div>
            </div>

            <button 
              type="button"
              onClick={() => setShowCamera(true)}
              className="w-full py-4 bg-bg-secondary border border-border-primary rounded-2xl flex items-center justify-center gap-3 text-text-primary font-bold hover:bg-bg-tertiary hover:border-secondary-500 transition-all active:scale-95 group"
            >
              <Camera size={20} className="text-accent-pink group-hover:scale-110 transition-transform" />
              <span>Capture Direct Photo</span>
            </button>
          </div>
        </div>

        {showCamera && (
          <CameraModal 
            onCapture={(file) => setImage(file)} 
            onClose={() => setShowCamera(false)} 
          />
        )}
        <div className="glass-card p-8 border border-border-primary">
          <label className="text-xs font-bold text-text-tertiary mb-4 block flex items-center gap-2 uppercase tracking-wider">
            <MapPin size={18} className="text-secondary-500" /> Pinpoint Location
          </label>
          <div className="border border-border-primary rounded-2xl overflow-hidden">
            <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat, lng) => setForm({ ...form, latitude: lat, longitude: lng })} />
          </div>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full py-4 font-bold text-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:grayscale transition-all active:scale-95">
          {loading ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              Processing Report...
            </>
          ) : (
            <>
              <Send size={20} /> Submit Report
            </>
          )}
        </button>
      </form>
    </div>
  );
}

function MyComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  useEffect(() => { api.getComplaints().then(d => setComplaints(d.complaints)).catch(console.error).finally(() => setLoading(false)); }, []);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="mb-10 text-center md:text-left">
        <h1 className="text-3xl font-extrabold mb-3 text-text-primary">
          📋 My Complaints
        </h1>
        <p className="text-text-secondary font-medium">Track the real-time status of your reports</p>
      </div>
      {loading ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-secondary-500"></div>
          <span className="mt-4 text-text-tertiary font-bold uppercase tracking-widest text-xs">Syncing your data...</span>
        </div>
      ) : complaints.length === 0 ? (
        <div className="glass-card p-12 text-center border border-border-primary shadow-soft">
          <div className="text-6xl mb-6 opacity-20">📋</div>
          <p className="text-text-tertiary text-lg font-medium mb-8">No complaints found in your history</p>
          <button onClick={() => navigate('/citizen/new-complaint')} className="btn-primary px-10 py-3 text-lg font-bold">
            Submit Your First Complaint
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {complaints.map((c, index) => (
            <div key={c.complaint_id} onClick={() => navigate(`/citizen/complaint/${c.complaint_id}`)}
              className="glass-card p-6 hover:bg-bg-tertiary hover:shadow-lg cursor-pointer transition-all border border-border-primary animate-fade-in group"
              style={{ animationDelay: `${index * 0.05}s` }}>
              <div className="flex flex-col sm:flex-row items-center justify-between gap-6">
                <div className="flex items-center gap-6 text-center sm:text-left">
                  <div className="text-4xl grayscale group-hover:grayscale-0 transition-all duration-500">
                    {{ 'pothole': '🕳️', 'streetlight': '💡', 'water_leakage': '💧', 'garbage': '🗑️', 'road_damage': '🛣️', 'drainage': '🌊', 'electrical': '⚡' }[c.category] || '📋'}
                  </div>
                  <div>
                    <p className="font-bold text-text-primary text-xl leading-tight mb-2 group-hover:text-secondary-600 transition-colors">{c.description?.substring(0, 80)}...</p>
                    <p className="text-xs text-text-tertiary font-bold uppercase tracking-widest flex flex-wrap justify-center sm:justify-start gap-3 mt-1">
                      <span className="text-secondary-500">#{c.complaint_id}</span>
                      <span>{c.category.replace('_', ' ')}</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
                <div className="w-full sm:w-auto flex justify-center">
                  <StatusBadge status={c.status} />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ComplaintDetail() {
  const id = window.location.pathname.split('/').pop();
  const [data, setData] = useState(null);
  const [rating, setRating] = useState({ score: 5, feedback: '' });
  const [loading, setLoading] = useState(true);

  useEffect(() => { api.getComplaint(id).then(setData).catch(console.error).finally(() => setLoading(false)); }, [id]);

  const submitRating = async () => {
    try { await api.rateComplaint(id, rating.score, rating.feedback); alert('Rating submitted!'); window.location.reload(); }
    catch (err) { alert(err.message); }
  };

  if (loading) return <div className="flex items-center justify-center py-20 font-bold text-text-tertiary uppercase tracking-widest text-xs">Loading case file...</div>;
  if (!data) return <div className="text-center py-20 text-red-500 font-bold">Complaint not found</div>;
  const { complaint, tender, applications, rating: existingRating } = data;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-10">
      <div className="text-center">
        <h1 className="text-3xl font-extrabold mb-2 text-text-primary">
          Complaint <span className="text-secondary-500">#{complaint.complaint_id}</span>
        </h1>
        <p className="text-text-secondary font-medium">Real-time resolution tracking</p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="glass-card p-8 space-y-8 border border-border-primary">
          <h2 className="text-xl font-bold text-text-primary flex items-center gap-2 uppercase tracking-tight">
            <FileText size={22} className="text-secondary-500" /> Issue Details
          </h2>
          <div className="space-y-5">
            <div className="flex justify-between items-center py-1 border-b border-border-primary">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Category</span>
              <span className="text-text-primary font-extrabold text-sm uppercase tracking-wide">{complaint.category.replace('_', ' ')}</span>
            </div>
            <div className="flex flex-col gap-2 py-1 border-b border-border-primary">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Description</span>
              <span className="text-text-primary font-medium text-sm leading-relaxed mb-2">{complaint.description}</span>
            </div>
            <div className="flex justify-between items-center py-1 border-b border-border-primary">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Location GPS</span>
              <span className="text-secondary-500 font-mono font-bold text-xs bg-bg-secondary px-3 py-1 rounded-full border border-border-primary">
                {complaint.latitude?.toFixed(5)}, {complaint.longitude?.toFixed(5)}
              </span>
            </div>
            <div className="flex justify-between items-center py-1">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Submission Time</span>
              <span className="text-text-primary font-bold text-sm">{new Date(complaint.created_at).toLocaleString()}</span>
            </div>
          </div>
          {complaint.image_url && (
            <div className="mt-8">
              <p className="text-text-tertiary font-bold uppercase tracking-wider text-xs mb-3">Photo Evidence</p>
              <img src={complaint.image_url} alt="Evidence" className="rounded-2xl w-full max-h-80 object-cover border-2 border-border-primary shadow-soft hover:shadow-lg transition-shadow" />
            </div>
          )}
        </div>
        <div className="glass-card p-8 border border-border-primary">
          <h2 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2 uppercase tracking-tight">
            <Clock size={22} className="text-secondary-500" /> Resolution Timeline
          </h2>
          <div className="bg-bg-secondary/50 p-6 rounded-2xl border border-border-primary">
            <StatusTimeline currentStatus={complaint.status} />
          </div>
        </div>
      </div>
      {tender && (
        <div className="glass-card p-8 border border-border-primary shadow-soft">
          <h2 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2 uppercase tracking-tight">
            <Briefcase size={22} className="text-secondary-500" /> Automated Micro-Tender
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-bg-secondary rounded-2xl p-6 border border-border-primary shadow-inner">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-2">AI Cost Calculation</span>
              <p className="text-3xl font-extrabold text-green-600">₹{tender.estimated_cost}</p>
            </div>
            <div className="bg-bg-secondary rounded-2xl p-6 border border-border-primary shadow-inner">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-3">Severity Priority</span>
              <div className="flex"><span className={`priority-${tender.priority} px-5 py-1.5 rounded-full text-xs font-bold uppercase tracking-widest`}>{tender.priority}</span></div>
            </div>
            <div className="bg-bg-secondary rounded-2xl p-6 border border-border-primary shadow-inner">
              <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-2">Assigned Specialist</span>
              <p className="text-text-primary font-extrabold text-lg truncate mt-1">{tender.vendor_company || 'Analyzing Tenders...'}</p>
            </div>
          </div>
        </div>
      )}
      {complaint.status === 'completed' && !existingRating && (
        <div className="glass-card p-10 border border-border-primary shadow-lg max-w-2xl mx-auto">
          <h2 className="text-2xl font-extrabold text-text-primary mb-2 text-center">Quality Assurance</h2>
          <p className="text-text-secondary text-center mb-10 font-medium">Please rate the quality of issue resolution</p>
          <div className="flex gap-4 mb-10 justify-center">
            {[1, 2, 3, 4, 5].map(s => (
              <button key={s} onClick={() => setRating({ ...rating, score: s })}
                className={`text-5xl transition-all hover:scale-125 transform ${s <= rating.score ? 'text-amber-500 drop-shadow-sm' : 'text-text-tertiary opacity-30 grayscale'}`}>
                ⭐
              </button>
            ))}
          </div>
          <div className="space-y-6">
            <textarea value={rating.feedback} onChange={e => setRating({ ...rating, feedback: e.target.value })} rows={3} placeholder="Tell us more about the resolution quality..."
              className="input-futuristic w-full text-base leading-relaxed" />
            <button onClick={submitRating} className="btn-primary w-full py-4 text-lg font-extrabold active:scale-95 transition-all">
              Submit Quality Rating
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function Scoreboard() {
  const [board, setBoard] = useState([]);
  useEffect(() => { api.getScoreboard().then(d => setBoard(d.scoreboard)).catch(console.error); }, []);

  return (
    <div className="animate-fade-in max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold mb-3 text-text-primary">
          🏆 Citizen Impact
        </h1>
        <p className="text-text-secondary font-medium">Top contributors leading civic improvement efforts</p>
      </div>
      <div className="glass-card overflow-hidden border border-border-primary shadow-soft">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary bg-bg-secondary">
                <th className="text-left p-6 text-text-tertiary font-bold uppercase tracking-widest text-xs">Rank</th>
                <th className="text-left p-6 text-text-tertiary font-bold uppercase tracking-widest text-xs">Citizen Advocate</th>
                <th className="text-left p-6 text-text-tertiary font-bold uppercase tracking-widest text-xs">Impact Score</th>
                <th className="text-left p-6 text-text-tertiary font-bold uppercase tracking-widest text-xs">Reports</th>
                <th className="text-left p-6 text-text-tertiary font-bold uppercase tracking-widest text-xs">Resolved</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {board.map((u, i) => (
                <tr key={u.user_id} className="hover:bg-bg-secondary/50 transition-colors animate-fade-in" style={{ animationDelay: `${i * 0.05}s` }}>
                  <td className="p-6">
                    <div className="flex items-center gap-4">
                      <span className={`text-3xl ${i < 3 ? 'animate-float' : ''}`}>
                        {i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}`}
                      </span>
                      {i < 3 && <div className="w-1.5 h-10 bg-secondary-500 rounded-full"></div>}
                    </div>
                  </td>
                  <td className="p-6">
                    <div className="flex flex-col">
                      <span className="font-bold text-text-primary text-base">{u.name}</span>
                      {i < 3 && <span className="text-[10px] font-extrabold text-secondary-600 uppercase tracking-widest mt-1">Ambassador</span>}
                    </div>
                  </td>
                  <td className="p-6">
                    <span className={`px-5 py-2 rounded-xl text-sm font-extrabold shadow-sm ${i === 0 ? 'bg-secondary-500 text-white' :
                        i < 3 ? 'bg-secondary-500/10 text-secondary-500 border border-secondary-500/20' :
                          'bg-bg-secondary text-text-secondary border border-border-primary'
                      }`}>
                      {u.reputation_score}
                    </span>
                  </td>
                  <td className="p-6">
                    <span className="text-text-primary font-extrabold text-lg">{u.total_complaints}</span>
                  </td>
                  <td className="p-6">
                    <span className="text-green-600 font-extrabold text-lg">{u.resolved_complaints}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}


export default function CitizenDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="new-complaint" element={<NewComplaint />} />
      <Route path="my-complaints" element={<MyComplaints />} />
      <Route path="complaint/:id" element={<ComplaintDetail />} />
      <Route path="scoreboard" element={<Scoreboard />} />
    </Routes>
  );
}
