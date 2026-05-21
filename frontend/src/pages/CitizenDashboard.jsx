import { useState, useEffect, useRef } from 'react';
import logo from '../assets/logo.png';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import api from '../api';
import MapPicker from '../components/MapPicker';
import StatusTimeline from '../components/StatusTimeline';
import { StatusBadge } from '../components/StatusTimeline';
import { FileText, MapPin, Camera, Send, Star, Trophy, Clock, CheckCircle, AlertTriangle, Briefcase, X, BrainCircuit, Sparkles, Zap } from 'lucide-react';
import AIInsightsPanel from '../components/AIInsightsPanel';
import SkeletonLoader from '../components/SkeletonLoader';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import toast from 'react-hot-toast';
import CitizenCompletedComplaints from './CitizenCompletedComplaints';

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
        <h1 className="text-3xl font-bold text-text-primary flex items-center gap-2">
          Welcome, {user?.name} <img src={logo} alt="" className="w-8 h-8 object-contain" />
        </h1>
        <p className="text-text-secondary text-sm font-medium">Track your civic complaints and contributions to the community</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {loading ? (
          [1,2,3,4].map(i => <SkeletonLoader key={i} type="stat" />)
        ) : (
          [
            { label: 'Total', val: stats.total, icon: FileText, color: 'bg-blue-50 text-blue-600' },
            { label: 'Pending', val: stats.pending, icon: Clock, color: 'bg-amber-50 text-amber-600' },
            { label: 'Active', val: stats.active, icon: AlertTriangle, color: 'bg-purple-50 text-purple-600' },
            { label: 'Resolved', val: stats.completed, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
          ].map((s, index) => (
            <motion.div key={s.label} whileHover={{ y: -10 }} className="glass-card hover-3d p-6 border border-border-primary animate-fade-in" style={{ animationDelay: `${index * 0.1}s` }}>
              <div className={`w-12 h-12 rounded-xl ${s.color} flex items-center justify-center mb-4 shadow-inner`}>
                <s.icon size={24} />
              </div>
              <p className="text-4xl font-extrabold text-text-primary mb-1">{s.val}</p>
              <p className="text-sm text-text-tertiary font-bold uppercase tracking-wider">{s.label} Complaints</p>
            </motion.div>
          ))
        )}
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
          <div className="space-y-4">
            {[1,2,3].map(i => <SkeletonLoader key={i} type="list" />)}
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
              <motion.div key={c.complaint_id} onClick={() => navigate(`/citizen/complaint/${c.complaint_id}`)}
                whileHover={{ scale: 1.01, x: 5 }}
                className="flex items-center justify-between p-5 bg-bg-secondary rounded-2xl hover:bg-bg-tertiary hover-3d cursor-pointer transition-all border border-transparent hover:border-border-primary animate-fade-in group"
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
              </motion.div>
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
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState(null);
  const [duplicates, setDuplicates] = useState(null);
  const [result, setResult] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const navigate = useNavigate();
  const categories = ['pothole', 'streetlight', 'water_leakage', 'garbage', 'road_damage', 'drainage', 'electrical', 'other'];

  const analysisTimeoutRef = useRef(null);

  useEffect(() => {
    if (form.description.length > 10 || image) {
      if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current);
      analysisTimeoutRef.current = setTimeout(async () => {
        setIsAnalyzing(true);
        try {
          const fd = new FormData();
          fd.append('description', form.description);
          fd.append('latitude', form.latitude);
          fd.append('longitude', form.longitude);
          if (image) fd.append('image', image);

          const data = await api.analyzeComplaint(fd);
          setAiAnalysis(data.analysis);
          setDuplicates(data.duplicates);
          if (data.analysis.category) {
            setForm(prev => ({ ...prev, category: data.analysis.category }));
          }
        } catch (err) {
          console.error("Analysis error:", err);
        } finally {
          setIsAnalyzing(false);
        }
      }, 1000);
    }
    return () => { if (analysisTimeoutRef.current) clearTimeout(analysisTimeoutRef.current); };
  }, [form.description, image, form.latitude, form.longitude]);

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

        <div className="glass-card p-8 border border-border-primary relative overflow-hidden group">
          <div className="absolute top-0 right-0 p-3 opacity-10 group-focus-within:opacity-30 transition-opacity">
            <BrainCircuit size={80} />
          </div>
          <label className="text-xs font-bold text-text-tertiary mb-3 block uppercase tracking-wider flex items-center gap-2">
            <Zap size={14} className="text-secondary-500" /> Issue Description
          </label>
          <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required rows={4}
            className="input-futuristic w-full text-sm leading-relaxed relative z-10 bg-transparent"
            placeholder="Please provide details about the problem (e.g. location details, severity)..." />
        </div>

        {/* AI Insights Section */}
        <AnimatePresence>
          {(isAnalyzing || aiAnalysis) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <AIInsightsPanel analysis={aiAnalysis} duplicates={duplicates} isAnalyzing={isAnalyzing} />
            </motion.div>
          )}
        </AnimatePresence>
        <div className="glass-card p-8 border border-border-primary">
          <label className="text-xs font-bold text-text-tertiary mb-4 block flex items-center gap-2 uppercase tracking-wider">
            <MapPin size={18} className="text-secondary-500" /> Pinpoint Location
          </label>
          <div className="border border-border-primary rounded-2xl overflow-hidden">
            <MapPicker lat={form.latitude} lng={form.longitude} onLocationSelect={(lat, lng) => setForm(prev => ({ ...prev, latitude: lat, longitude: lng }))} />
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
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const fetchComplaints = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.getMyComplaints();
      console.log('MyComplaints API response:', data);
      setComplaints(data.complaints || data || []);
    } catch (err) {
      console.error('Failed to fetch my complaints:', err);
      setError(err.message || 'Failed to load complaints');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchComplaints(); }, []);

  const deleteComplaint = async (e, complaintId) => {
    e.stopPropagation();
    if (!window.confirm('Are you sure you want to delete this complaint?')) return;
    try {
      await api.deleteComplaint(complaintId);
      setComplaints(prev => prev.filter(c => c.complaint_id !== complaintId));
    } catch (err) {
      alert('Failed to delete: ' + (err.message || 'Unknown error'));
    }
  };

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
      ) : error ? (
        <div className="glass-card p-12 text-center border border-red-500/30 shadow-soft">
          <div className="text-6xl mb-6 opacity-40">⚠️</div>
          <p className="text-red-400 text-lg font-bold mb-4">{error}</p>
          <button onClick={fetchComplaints} className="btn-primary px-10 py-3 text-lg font-bold">
            Retry
          </button>
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
                      <span>{(c.category || '').replace('_', ' ')}</span>
                      <span>{new Date(c.created_at).toLocaleDateString()}</span>
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <StatusBadge status={c.status} />
                  <button
                    onClick={(e) => deleteComplaint(e, c.complaint_id)}
                    className="p-2 rounded-xl text-red-400 hover:text-red-300 hover:bg-red-500/10 transition-all opacity-0 group-hover:opacity-100"
                    title="Delete complaint"
                  >
                    <X size={18} />
                  </button>
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
  const [rating, setRating] = useState({ score: 5, feedback: '', proof: null });
  const [vendorDetails, setVendorDetails] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hoveredStar, setHoveredStar] = useState(0);

  useEffect(() => {
    api.getComplaint(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const assignedVendorId = data?.tender?.assigned_vendor_id;

  // Fetch reviews and aggregate stats when vendor is assigned
  useEffect(() => {
    if (assignedVendorId) {
      api.getVendorRatings(assignedVendorId)
        .then(setVendorDetails)
        .catch(console.error);
    }
  }, [assignedVendorId]);

  // Socket.IO Real-Time Update for rating details
  useEffect(() => {
    if (!assignedVendorId) return;

    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');

    socket.on('connect', () => {
      console.log('📡 Connected to Socket.IO for real-time rating updates');
    });

    socket.on('rating_updated', (payload) => {
      if (payload.vendor_id === assignedVendorId) {
        console.log('🔥 Real-time rating update received:', payload);
        
        // Update stats
        setVendorDetails(prev => {
          if (!prev) return null;
          return {
            ...prev,
            vendor: {
              ...prev.vendor,
              rating_avg: payload.rating_avg,
              total_ratings: payload.total_ratings
            }
          };
        });

        // Reload reviews list
        api.getVendorRatings(assignedVendorId)
          .then(setVendorDetails)
          .catch(console.error);
      }
    });

    return () => {
      socket.disconnect();
    };
  }, [assignedVendorId]);

  const submitRating = async () => {
    try {
      const res = await api.submitRating({
        complaint_id: parseInt(id),
        score: rating.score,
        feedback: rating.feedback
      });

      toast.success(res.message || 'Rating submitted successfully!');
      
      // Update local state to hide form and reflect rated status
      setData(prev => {
        if (!prev) return null;
        return {
          ...prev,
          rating: res.rating
        };
      });

      // Reload vendor data to reflect instantly
      if (assignedVendorId) {
        const details = await api.getVendorRatings(assignedVendorId);
        setVendorDetails(details);
      }
    } catch (err) {
      toast.error(err.message || 'Failed to submit rating.');
    }
  };

  if (loading) return <div className="flex items-center justify-center py-20 font-bold text-text-tertiary uppercase tracking-widest text-xs">Loading case file...</div>;
  if (!data) return <div className="text-center py-20 text-red-500 font-bold">Complaint not found</div>;
  const { complaint, tender, applications, rating: existingRating, workUpdates } = data;

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
          {/* Before and After Image Proof Verification */}
          {(() => {
            const afterUpdate = workUpdates?.find(wu => wu.image_url);
            if (complaint.image_url && afterUpdate) {
              return (
                <div className="mt-8 pt-8 border-t border-border-primary space-y-6">
                  <p className="text-sm font-bold text-text-primary uppercase tracking-tight flex items-center gap-2">
                    📸 Before & After Proof Verification
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest block text-center">Before (Citizen Report)</span>
                      <img src={`http://localhost:5000${complaint.image_url}`} alt="Before" className="rounded-2xl w-full h-48 object-cover border-2 border-border-primary shadow-soft hover:shadow-lg transition-all" />
                    </div>
                    <div className="space-y-2">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest block text-center">After (Work Completion: {afterUpdate.progress_percentage}%)</span>
                      <img src={`http://localhost:5000${afterUpdate.image_url}`} alt="After" className="rounded-2xl w-full h-48 object-cover border-2 border-border-primary shadow-soft hover:shadow-lg transition-all" />
                    </div>
                  </div>
                  <div className="p-5 bg-bg-secondary/60 rounded-2xl border border-border-primary space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest">Inspection Status</span>
                      <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-widest border ${afterUpdate.verification_status === 'suspicious'
                          ? 'bg-red-500/10 text-red-500 border-red-500/20'
                          : 'bg-green-500/10 text-green-500 border-green-500/20'
                        }`}>
                        {afterUpdate.verification_status === 'suspicious' ? '⚠ Suspicious Upload' : '✅ Verified Resolution'}
                      </span>
                    </div>
                    <p className="text-xs text-text-secondary font-semibold leading-relaxed">
                      <strong>AI Inspector Reasoning:</strong> {afterUpdate.verification_reasoning}
                    </p>
                  </div>
                </div>
              );
            } else if (complaint.image_url) {
              return (
                <div className="mt-8">
                  <p className="text-text-tertiary font-bold uppercase tracking-wider text-xs mb-3">Photo Evidence</p>
                  <img src={`http://localhost:5000${complaint.image_url}`} alt="Evidence" className="rounded-2xl w-full max-h-80 object-cover border-2 border-border-primary shadow-soft hover:shadow-lg transition-shadow" />
                </div>
              );
            }
            return null;
          })()}

          {workUpdates && workUpdates.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border-primary space-y-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 uppercase tracking-tight">
                📈 Resolution Progress Updates
              </h3>
              <div className="space-y-3">
                {workUpdates.map((wu, i) => (
                  <div key={wu.update_id} className="p-4 bg-bg-secondary/40 rounded-2xl border border-border-primary flex items-start gap-4 hover:bg-bg-secondary transition-all">
                    <div className="bg-secondary-500/10 text-secondary-500 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-secondary-500/20 shadow-sm">
                      {wu.progress_percentage}%
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-text-primary font-bold">{wu.description}</p>
                      <p className="text-[10px] text-text-tertiary font-extrabold mt-1.5 uppercase tracking-wider flex gap-3">
                        <span>{new Date(wu.created_at).toLocaleString()}</span>
                        <span>•</span>
                        <span className="text-secondary-600 font-bold">{wu.company_name || wu.vendor_name}</span>
                      </p>
                      {wu.verification_status === 'suspicious' && (
                        <span className="inline-block mt-2 text-[10px] font-extrabold text-red-500 bg-red-500/5 px-2 py-0.5 rounded-lg border border-red-500/10">
                          ⚠ Suspicious Verification Alert
                        </span>
                      )}
                    </div>
                    {wu.image_url && (
                      <img src={`http://localhost:5000${wu.image_url}`} alt="Progress proof" className="w-12 h-12 rounded-xl object-cover border border-border-primary cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(`http://localhost:5000${wu.image_url}`, '_blank')} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {complaint.ai_analysis && (
            <div className="mt-8 pt-8 border-t border-border-primary">
              <h3 className="text-sm font-bold text-text-primary mb-4 flex items-center gap-2 uppercase tracking-tight">
                <BrainCircuit size={18} className="text-secondary-500" /> AI Verification Details
              </h3>
              <div className="bg-bg-secondary/50 rounded-2xl p-6 border border-border-primary space-y-4">
                <p className="text-sm text-text-secondary italic font-medium leading-relaxed">
                  "{JSON.parse(complaint.ai_analysis).aiSummary}"
                </p>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="flex flex-col gap-1">
                    <span className="text-text-tertiary font-bold uppercase tracking-widest text-[9px]">Department</span>
                    <span className="text-text-primary font-bold">{complaint.department}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-text-tertiary font-bold uppercase tracking-widest text-[9px]">Risk Level</span>
                    <span className={`font-bold ${JSON.parse(complaint.ai_analysis).riskLevel === 'high' ? 'text-red-500' : 'text-green-500'}`}>
                      {JSON.parse(complaint.ai_analysis).riskLevel?.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
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
        <div className="glass-card p-8 border border-border-primary shadow-soft mt-8 hover:shadow-lg transition-all duration-300">
          <h2 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2 uppercase tracking-tight">
            <Briefcase size={22} className="text-secondary-500" /> Assigned Vendor Details
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-bg-secondary rounded-2xl p-6 border border-border-primary shadow-inner col-span-1 md:col-span-2 flex flex-col justify-between">
              <div>
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-2">Assigned Specialist</span>
                <p className="text-text-primary font-extrabold text-2xl truncate mt-1">{tender.vendor_company || tender.vendor_name || 'Analyzing Tenders...'}</p>
                <p className="text-sm text-text-secondary mt-1.5 font-medium">Phone: {tender.vendor_phone || '+91 9876543210'}</p>
              </div>
              <div className="mt-4 pt-4 border-t border-border-primary/50 flex flex-wrap items-center gap-4">
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Average Rating</span>
                  <div className="flex items-center gap-2 mt-1">
                    {(() => {
                      const ratingVal = vendorDetails?.vendor?.rating_avg || tender.rating_avg || 0;
                      const rounded = Math.round(ratingVal * 2) / 2;
                      const stars = [];
                      for (let i = 1; i <= 5; i++) {
                        if (i <= rounded) {
                          stars.push(<Star key={i} size={15} className="fill-amber-400 text-amber-400" />);
                        } else if (i - 0.5 === rounded) {
                          stars.push(
                            <div key={i} className="relative inline-block">
                              <Star size={15} className="text-text-tertiary opacity-30" />
                              <div className="absolute top-0 left-0 w-[50%] overflow-hidden">
                                <Star size={15} className="fill-amber-400 text-amber-400" />
                              </div>
                            </div>
                          );
                        } else {
                          stars.push(<Star key={i} size={15} className="text-text-tertiary opacity-30" />);
                        }
                      }
                      return (
                        <>
                          <div className="flex items-center gap-0.5">{stars}</div>
                          <span className="text-sm font-extrabold text-text-primary">
                            {Number(ratingVal).toFixed(1)} / 5.0
                          </span>
                        </>
                      );
                    })()}
                  </div>
                </div>
                <div className="w-[1px] h-8 bg-border-primary/50 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Total Reviews</span>
                  <span className="text-sm font-extrabold text-text-primary mt-1">
                    {vendorDetails?.vendor?.total_ratings || 0} reviews
                  </span>
                </div>
                <div className="w-[1px] h-8 bg-border-primary/50 hidden sm:block"></div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-text-tertiary font-bold uppercase tracking-wider">Jobs Completed</span>
                  <span className="text-sm font-extrabold text-green-600 mt-1">
                    {vendorDetails?.vendor?.total_jobs_completed || tender.total_jobs_completed || 0} completed
                  </span>
                </div>
              </div>
            </div>
            <div className="bg-bg-secondary rounded-2xl p-6 border border-border-primary shadow-inner flex flex-col justify-between">
              <div>
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-3">Work Status</span>
                <div className="flex"><StatusBadge status={tender.status} /></div>
              </div>
              <div className="mt-6">
                <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-1">Est. Completion</span>
                <p className="text-2xl font-extrabold text-blue-500">{tender.estimated_days || 3} Days</p>
              </div>
            </div>
          </div>

          {/* Citizen Feedback View if Already Rated */}
          {existingRating && (
            <div className="bg-bg-secondary/60 rounded-2xl p-5 border border-border-primary mt-6 animate-fade-in">
              <span className="text-xs font-bold text-text-tertiary uppercase tracking-wider block mb-2">Your Review for this Resolution</span>
              <div className="flex items-center gap-2 mb-2">
                {(() => {
                  const stars = [];
                  for (let i = 1; i <= 5; i++) {
                    stars.push(
                      <Star
                        key={i}
                        size={14}
                        className={i <= existingRating.score ? 'fill-amber-400 text-amber-400' : 'text-text-tertiary opacity-30'}
                      />
                    );
                  }
                  return <div className="flex items-center gap-0.5">{stars}</div>;
                })()}
                <span className="text-sm font-extrabold text-text-primary">({existingRating.score}/5)</span>
              </div>
              <p className="text-sm text-text-secondary italic font-medium leading-relaxed">
                "{existingRating.feedback || 'No written feedback provided.'}"
              </p>
              {existingRating.created_at && (
                <span className="text-[10px] text-text-tertiary font-bold block mt-2 uppercase tracking-wide">
                  Submitted on {new Date(existingRating.created_at).toLocaleDateString()}
                </span>
              )}
            </div>
          )}

          {/* Review History Component */}
          <div className="mt-8 pt-8 border-t border-border-primary">
            <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2 uppercase tracking-tight">
              <Trophy size={18} className="text-amber-400" /> Community Reviews ({vendorDetails?.reviews?.length || 0})
            </h3>
            {vendorDetails?.reviews && vendorDetails.reviews.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {vendorDetails.reviews.map((rev) => (
                  <div key={rev.rating_id} className="bg-bg-secondary/30 hover:bg-bg-secondary/60 p-5 rounded-2xl border border-border-primary transition-all duration-300 flex flex-col justify-between hover:shadow-soft">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="font-extrabold text-sm text-text-primary">{rev.citizen_name || 'Anonymous Citizen'}</span>
                        <div className="flex items-center gap-0.5">
                          {(() => {
                            const stars = [];
                            for (let i = 1; i <= 5; i++) {
                              stars.push(
                                <Star
                                  key={i}
                                  size={12}
                                  className={i <= rev.score ? 'fill-amber-400 text-amber-400' : 'text-text-tertiary opacity-30'}
                                />
                              );
                            }
                            return stars;
                          })()}
                        </div>
                      </div>
                      <p className="text-xs text-text-secondary italic leading-relaxed font-medium">
                        "{rev.feedback || 'No written comment.'}"
                      </p>
                    </div>
                    <div className="text-[9px] text-text-tertiary font-bold uppercase tracking-wider mt-4">
                      {new Date(rev.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-bg-secondary/20 rounded-2xl border border-dashed border-border-primary">
                <p className="text-sm text-text-tertiary font-bold uppercase tracking-wider text-xs">No previous reviews submitted for this vendor yet</p>
              </div>
            )}
          </div>
        </div>
      )}

      {complaint.status === 'completed' && !existingRating && (
        <div className="glass-card p-10 border border-border-primary shadow-lg max-w-3xl mx-auto mt-10 hover:shadow-xl transition-all duration-300">
          <h2 className="text-2xl font-extrabold text-text-primary mb-6 text-center flex items-center justify-center gap-3 uppercase tracking-tight">
            <Trophy className="text-secondary-500 animate-bounce" /> Quality Assurance & Review
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest block text-center">Before Repair Image</span>
              <img src={`http://localhost:5000${complaint.image_url}`} alt="Before" className="rounded-2xl w-full h-48 object-cover border-2 border-border-primary shadow-soft" />
            </div>
            <div className="space-y-2">
              <span className="text-[10px] font-bold text-text-tertiary uppercase tracking-widest block text-center">Completed Work Image</span>
              <img src={`http://localhost:5000${tender?.completion_image || workUpdates?.[workUpdates.length-1]?.image_url}`} alt="After" className="rounded-2xl w-full h-48 object-cover border-2 border-border-primary shadow-soft" />
            </div>
          </div>

          <div className="bg-bg-secondary p-5 rounded-2xl border border-border-primary mb-8 text-center shadow-inner">
            <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs block mb-2">Vendor Note:</span>
            <p className="text-text-primary italic font-semibold">"{tender?.completion_note || 'Work completed successfully.'}"</p>
          </div>

          <p className="text-text-secondary text-center mb-6 font-bold uppercase tracking-wide text-xs">Please rate the quality of issue resolution</p>
          
          {/* Interactive Star Picker with Animated Hover Scale and Glows */}
          <div className="flex gap-4 mb-8 justify-center">
            {[1, 2, 3, 4, 5].map(s => (
              <button
                key={s}
                type="button"
                onMouseEnter={() => setHoveredStar(s)}
                onMouseLeave={() => setHoveredStar(0)}
                onClick={() => setRating({ ...rating, score: s })}
                className={`text-5xl transition-all duration-200 transform hover:scale-125 focus:outline-none ${
                  s <= (hoveredStar || rating.score)
                    ? 'text-amber-400 drop-shadow-[0_0_10px_rgba(251,191,36,0.6)] scale-110'
                    : 'text-text-tertiary opacity-30 grayscale'
                }`}
              >
                ⭐
              </button>
            ))}
          </div>

          <div className="space-y-6">
            <textarea
              value={rating.feedback}
              onChange={e => setRating({ ...rating, feedback: e.target.value })}
              rows={3}
              placeholder="Tell us more about the resolution quality and service..."
              className="input-futuristic w-full text-base leading-relaxed"
            />

            <button
              onClick={submitRating}
              className="btn-primary w-full py-4 text-lg font-extrabold active:scale-95 hover:shadow-lg transition-all duration-300"
            >
              Submit Vendor Review
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


import NotificationsPanel from './NotificationsPanel';
import Profile from './Profile';

export default function CitizenDashboard() {
  return (
    <Routes>
      <Route index element={<Overview />} />
      <Route path="new-complaint" element={<NewComplaint />} />
      <Route path="my-complaints" element={<MyComplaints />} />
      <Route path="completed-complaints" element={<CitizenCompletedComplaints />} />
      <Route path="complaint/:id" element={<ComplaintDetail />} />
      <Route path="scoreboard" element={<Scoreboard />} />
      <Route path="notifications" element={<NotificationsPanel />} />
      <Route path="profile" element={<Profile />} />
    </Routes>
  );
}
