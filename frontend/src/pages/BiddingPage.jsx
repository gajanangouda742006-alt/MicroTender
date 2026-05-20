import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, Calendar, IndianRupee, Shield, FileText, Send, AlertCircle, Clock, Star } from 'lucide-react';
import MapPicker from '../components/MapPicker';
import { StatusBadge } from '../components/StatusTimeline';

export default function BiddingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
  const [estimatedDays, setEstimatedDays] = useState('');
  const [proposal, setProposal] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getTenderDetails(id)
      .then(setData)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSubmitBid = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await api.applyToTender(id, { bid_amount: bidAmount, estimated_days: estimatedDays, proposal });
      alert('Bid submitted successfully!');
      navigate('/vendor');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-20 text-center text-text-tertiary font-bold uppercase tracking-widest text-xs animate-pulse">Loading case file...</div>;
  if (!data) return <div className="p-20 text-center text-red-500 font-bold">Tender not found.</div>;

  const { tender, applications, costBreakdown } = data;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-4xl font-extrabold text-text-primary mb-1">
            Tender <span className="text-secondary-600">#{tender.tender_id}</span>
          </h1>
          <p className="text-text-tertiary font-bold uppercase tracking-widest text-xs">{tender.category.replace('_', ' ')} • Official Case Report</p>
        </div>
        <StatusBadge status={tender.status} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-8">
          {/* Issue Summary */}
          <div className="glass-card p-8 space-y-6 border border-border-primary shadow-soft">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3 uppercase tracking-tight">
              <FileText size={22} className="text-secondary-500" /> Issue Report
            </h2>
            <div className="p-5 bg-bg-secondary rounded-2xl border border-border-primary">
              <p className="text-text-primary leading-relaxed font-medium">{tender.description}</p>
            </div>

            {tender.image_url && (
              <div className="rounded-3xl overflow-hidden border-2 border-border-primary shadow-lg group">
                <img
                  src={`http://localhost:5000${tender.image_url}`}
                  alt="Evidence"
                  className="w-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
            )}
          </div>

          {/* Location Map */}
          <div className="glass-card p-8 space-y-6 border border-border-primary shadow-soft">
            <h2 className="text-xl font-bold text-text-primary flex items-center gap-3 uppercase tracking-tight">
              <MapPin size={22} className="text-red-500" /> Site Location
            </h2>
            <div className="rounded-2xl overflow-hidden border border-border-primary shadow-inner">
              <MapPicker
                lat={tender.latitude}
                lng={tender.longitude}
                readOnly={true}
                height="400px"
                markers={[{ lat: tender.latitude, lng: tender.longitude, popup: 'Issue Location' }]}
              />
            </div>
          </div>
        </div>

        {/* Sidebar / Bidding Form */}
        <div className="space-y-8">
          <div className="glass-card p-8 border border-border-primary bg-bg-secondary/50">
            <h3 className="text-lg font-bold text-text-primary mb-6 flex items-center gap-2 uppercase tracking-tight">
              <IndianRupee size={20} className="text-green-600" /> AI Cost Breakdown
            </h3>
            <div className="space-y-4">
              {costBreakdown.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between items-center pb-2 border-b border-border-primary">
                  <span className="text-text-tertiary font-bold text-xs uppercase tracking-wide">{item.item}</span>
                  <span className="font-mono font-bold text-text-primary">₹{item.amount}</span>
                </div>
              ))}
              <div className="pt-4 flex justify-between items-center">
                <span className="text-text-primary font-bold uppercase tracking-widest text-xs">Recommended Budget</span>
                <span className="text-green-600 font-extrabold text-2xl">₹{tender.estimated_cost}</span>
              </div>
            </div>
          </div>

          {tender.status === 'open' && (
            <form onSubmit={handleSubmitBid} className="glass-card p-8 space-y-6 border border-border-primary shadow-lg transform hover:-translate-y-1 transition-all duration-300">
              <h3 className="text-xl font-extrabold text-text-primary text-center">Place Your Bid</h3>
              <div className="space-y-5">
                <div>
                  <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-widest ml-1">Your Quote (₹)</label>
                  <div className="relative group">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary font-bold group-focus-within:text-secondary-600">₹</span>
                    <input
                      type="number"
                      required
                      value={bidAmount}
                      onChange={e => setBidAmount(e.target.value)}
                      className="input-futuristic w-full pl-10"
                      placeholder="Enter competitive amount..."
                    />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-widest ml-1">Estimated Days</label>
                  <input
                    type="number"
                    required
                    min="1"
                    value={estimatedDays}
                    onChange={e => setEstimatedDays(e.target.value)}
                    className="input-futuristic w-full"
                    placeholder="e.g. 3"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold text-text-tertiary mb-2 block uppercase tracking-widest ml-1">Strategy & Proposal</label>
                  <textarea
                    required
                    value={proposal}
                    onChange={e => setProposal(e.target.value)}
                    className="input-futuristic w-full min-h-[150px] leading-relaxed"
                    placeholder="Detail your execution plan and materials..."
                  />
                </div>
              </div>
              <button
                disabled={submitting}
                className="btn-primary w-full py-4 font-bold text-xl flex items-center justify-center gap-3 transition-all active:scale-95"
              >
                {submitting ? (
                  <>
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                    Processing Bid...
                  </>
                ) : (
                  <>
                    <Send size={20} /> Submit Application
                  </>
                )}
              </button>
            </form>
          )}

          <div className="glass-card p-8 space-y-6 border border-border-primary">
            <h3 className="text-lg font-bold text-text-primary flex items-center gap-3 uppercase tracking-tight">
              <Clock size={20} className="text-amber-500" /> Active Bids ({applications.length})
            </h3>
            <div className="space-y-4">
              {applications.length === 0 ? (
                <div className="text-center py-6 bg-bg-secondary rounded-2xl border border-dashed border-border-primary">
                  <p className="text-text-tertiary font-medium italic text-sm">No bids yet. Start the auction!</p>
                </div>
              ) : (
                applications.map((app, idx) => (
                  <div key={app.application_id} className="p-4 bg-bg-secondary rounded-2xl flex items-center justify-between border border-border-primary shadow-sm hover:border-secondary-500 transition-colors relative overflow-hidden">
                    {idx === 0 && (
                      <div className="absolute top-0 right-0 bg-green-500 text-white text-[9px] font-bold uppercase px-2 py-0.5 rounded-bl-lg">
                        Lowest Bid
                      </div>
                    )}
                    <div>
                      <p className="text-sm font-bold text-text-primary">{app.company_name}</p>
                      <p className="text-[10px] text-amber-600 font-extrabold uppercase tracking-widest flex items-center gap-1 mt-1">
                        <Star size={10} fill="currentColor" /> {app.rating_avg?.toFixed(1)} Specialist • {app.estimated_days} days
                      </p>
                    </div>
                    <span className="font-mono font-extrabold text-sm text-secondary-600">₹{app.bid_amount}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
