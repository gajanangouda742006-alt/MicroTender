import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { io } from 'socket.io-client';
import api from '../api';
import { StatusBadge } from '../components/StatusTimeline';
import StatusTimeline from '../components/StatusTimeline';
import AIInsightsPanel from '../components/AIInsightsPanel';
import { FileText, MapPin, BrainCircuit, Clock, Briefcase, ChevronLeft } from 'lucide-react';

export default function VendorComplaintDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await api.getVendorComplaintDetails(id);
      setData(res);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Failed to load complaint details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  useEffect(() => {
    const socket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    
    socket.on('connect', () => {
      console.log('Connected to socket for vendor complaint updates');
    });

    socket.on('notification', () => { fetchData(); });
    socket.on('tender_updated', () => { fetchData(); });
    socket.on('application_updated', () => { fetchData(); });
    socket.on('work_update', () => { fetchData(); });

    return () => {
      socket.disconnect();
    };
  }, [id]);

  if (loading) return <div className="flex items-center justify-center py-20 font-bold text-text-tertiary uppercase tracking-widest text-xs">Loading case file...</div>;
  if (error || !data) return (
    <div className="text-center py-20 space-y-4">
      <div className="text-red-500 font-bold text-lg">{error || 'Complaint not found'}</div>
      <button onClick={() => navigate(-1)} className="btn-secondary px-6 py-2">Go Back</button>
    </div>
  );

  const { complaint, tender, application, workUpdates } = data;

  return (
    <div className="animate-fade-in max-w-5xl mx-auto space-y-8 pb-10">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate(-1)} className="p-2 bg-bg-secondary rounded-xl hover:bg-bg-tertiary transition-colors border border-border-primary">
          <ChevronLeft size={24} className="text-text-secondary" />
        </button>
        <div>
          <h1 className="text-3xl font-extrabold text-text-primary">
            Complaint <span className="text-secondary-500">#{complaint.complaint_id}</span>
          </h1>
          <p className="text-text-secondary font-medium">Detailed Case Information</p>
        </div>
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

          {/* Work Updates */}
          {workUpdates && workUpdates.length > 0 && (
            <div className="mt-8 pt-8 border-t border-border-primary space-y-4">
              <h3 className="text-sm font-bold text-text-primary flex items-center gap-2 uppercase tracking-tight">
                📈 Resolution Progress Updates
              </h3>
              <div className="space-y-3">
                {workUpdates.map((wu) => (
                  <div key={wu.update_id} className="p-4 bg-bg-secondary/40 rounded-2xl border border-border-primary flex items-start gap-4 hover:bg-bg-secondary transition-all">
                    <div className="bg-secondary-500/10 text-secondary-500 text-xs font-extrabold px-3 py-1.5 rounded-xl border border-secondary-500/20 shadow-sm">
                      {wu.progress_percentage}%
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-text-primary font-bold">{wu.description}</p>
                      <p className="text-[10px] text-text-tertiary font-extrabold mt-1.5 uppercase tracking-wider flex gap-3">
                        <span>{new Date(wu.created_at).toLocaleString()}</span>
                      </p>
                    </div>
                    {wu.image_url && (
                      <img src={`http://localhost:5000${wu.image_url}`} alt="Progress proof" className="w-12 h-12 rounded-xl object-cover border border-border-primary cursor-pointer hover:scale-105 transition-transform" onClick={() => window.open(`http://localhost:5000${wu.image_url}`, '_blank')} />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI Analysis */}
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

        {/* Right Column: Timeline & Vendor App Details */}
        <div className="space-y-8">
          <div className="glass-card p-8 border border-border-primary">
            <h2 className="text-xl font-bold text-text-primary mb-8 flex items-center gap-2 uppercase tracking-tight">
              <Clock size={22} className="text-secondary-500" /> Resolution Timeline
            </h2>
            <div className="bg-bg-secondary/50 p-6 rounded-2xl border border-border-primary">
              <StatusTimeline currentStatus={complaint.status} />
            </div>
          </div>
          
          {application && (
            <div className="glass-card p-8 border border-border-primary">
              <h2 className="text-xl font-bold text-text-primary mb-6 flex items-center gap-2 uppercase tracking-tight">
                <Briefcase size={22} className="text-accent-pink" /> Your Application Details
              </h2>
              <div className="space-y-5 bg-bg-secondary/30 p-6 rounded-2xl border border-border-primary">
                <div className="flex justify-between items-center py-2 border-b border-border-primary">
                  <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Application Status</span>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-widest ${
                    application.status === 'accepted' ? 'bg-green-500/10 text-green-500 border border-green-500/20' : 
                    application.status === 'rejected' ? 'bg-red-500/10 text-red-500 border border-red-500/20' : 
                    'bg-amber-500/10 text-amber-500 border border-amber-500/20'
                  }`}>
                    {application.status}
                  </span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border-primary">
                  <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Your Bid Amount</span>
                  <span className="text-green-600 font-extrabold text-lg">₹{application.bid_amount}</span>
                </div>
                
                <div className="flex justify-between items-center py-2 border-b border-border-primary">
                  <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Estimated Cost (AI)</span>
                  <span className="text-text-primary font-bold text-sm">₹{tender?.estimated_cost}</span>
                </div>
                
                <div className="flex flex-col gap-2 py-2">
                  <span className="text-text-tertiary font-bold uppercase tracking-wider text-xs">Your Proposal</span>
                  <span className="text-text-secondary font-medium text-sm leading-relaxed">{application.proposal || 'No proposal text provided.'}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
