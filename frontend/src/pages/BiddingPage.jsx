import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api';
import { MapPin, Calendar, IndianRupee, Shield, FileText, Send, AlertCircle, Clock } from 'lucide-react';
import MapPicker from '../components/MapPicker';
import { StatusBadge } from '../components/StatusTimeline';

export default function BiddingPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [bidAmount, setBidAmount] = useState('');
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
      await api.applyToTender(id, { bid_amount: bidAmount, proposal });
      alert('Bid submitted successfully!');
      navigate('/vendor-dashboard');
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to submit bid');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <div className="p-10 text-center text-gray-500">Loading tender details...</div>;
  if (!data) return <div className="p-10 text-center text-red-400">Tender not found.</div>;

  const { tender, applications, costBreakdown } = data;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-white to-gray-400 bg-clip-text text-transparent">
            Tender Details
          </h1>
          <p className="text-gray-500">#{tender.tender_id} • {tender.category.replace('_', ' ')}</p>
        </div>
        <StatusBadge status={tender.status} />
      </div>

      <div className="grid grid-cols-3 gap-8">
        <div className="col-span-2 space-y-8">
          {/* Issue Summary */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <FileText size={20} className="text-primary-400" /> Issue Description
            </h2>
            <p className="text-gray-300 leading-relaxed">{tender.description}</p>
            
            {tender.image_url && (
              <div className="rounded-xl overflow-hidden border border-white/10 aspect-video">
                <img 
                  src={`${import.meta.env.VITE_API_URL}${tender.image_url}`} 
                  alt="Issue" 
                  className="w-full h-full object-cover"
                />
              </div>
            )}
          </div>

          {/* Location Map */}
          <div className="glass rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-semibold flex items-center gap-2">
              <MapPin size={20} className="text-red-400" /> Location
            </h2>
            <MapPicker 
              lat={tender.latitude} 
              lng={tender.longitude} 
              readOnly={true} 
              height="300px"
              markers={[{ lat: tender.latitude, lng: tender.longitude, popup: 'Issue Location' }]}
            />
          </div>
        </div>

        {/* Sidebar / Bidding Form */}
        <div className="space-y-6">
          <div className="glass rounded-2xl p-6 border-primary-500/20 bg-primary-500/5">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <IndianRupee size={20} className="text-green-400" /> AI Cost Breakdown
            </h3>
            <div className="space-y-3">
              {costBreakdown.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-sm">
                  <span className="text-gray-400">{item.item}</span>
                  <span className="font-mono">₹{item.amount}</span>
                </div>
              ))}
              <div className="border-t border-white/10 pt-3 flex justify-between font-bold">
                <span>Estimated Total</span>
                <span className="text-green-400">₹{tender.estimated_cost}</span>
              </div>
            </div>
          </div>

          {tender.status === 'open' && (
            <form onSubmit={handleSubmitBid} className="glass rounded-2xl p-6 space-y-4 border-white/20">
              <h3 className="text-lg font-bold">Submit Your Bid</h3>
              <div>
                <label className="block text-xs text-gray-500 mb-1 ml-1 font-medium">Your Quote (₹)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">₹</span>
                  <input 
                    type="number" 
                    required
                    value={bidAmount}
                    onChange={e => setBidAmount(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-8 pr-4 text-white outline-none focus:border-primary-500 transition-colors"
                    placeholder="Enter amount..."
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1 ml-1 font-medium">Proposal/Methodology</label>
                <textarea 
                  required
                  value={proposal}
                  onChange={e => setProposal(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-4 text-white outline-none focus:border-primary-500 transition-colors min-h-[120px]"
                  placeholder="How will you solve this? What materials will you use?"
                />
              </div>
              <button 
                disabled={submitting}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white font-bold py-3 rounded-xl shadow-lg shadow-primary-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {submitting ? 'Submitting...' : <><Send size={18} /> Submit Application</>}
              </button>
            </form>
          )}

          <div className="glass rounded-2xl p-6 space-y-4">
            <h3 className="text-lg font-bold flex items-center gap-2">
              <Clock size={18} className="text-amber-400" /> Existing Bids ({applications.length})
            </h3>
            <div className="space-y-3">
              {applications.length === 0 ? (
                <p className="text-gray-500 text-sm">No bids yet. Be the first!</p>
              ) : (
                applications.map(app => (
                  <div key={app.application_id} className="p-3 bg-white/5 rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">{app.company_name}</p>
                      <p className="text-[10px] text-gray-500">⭐ {app.rating_avg?.toFixed(1)} Rating</p>
                    </div>
                    <span className="font-mono text-sm">₹{app.bid_amount}</span>
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
