import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api from '../api';
import { useNotifications } from '../NotificationContext';
import { MessageSquare, Star, TrendingUp, Trophy } from 'lucide-react';

function formatDate(value) {
  return value ? new Date(value).toLocaleDateString() : 'Not available';
}

function Stars({ value = 0, size = 16 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={size}
          className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-text-tertiary/35'}
        />
      ))}
    </div>
  );
}

export default function VendorReviews() {
  const { socket } = useNotifications();
  const [data, setData] = useState({ vendor: null, reviews: [] });
  const [loading, setLoading] = useState(true);

  const fetchReviews = async () => {
    try {
      const response = await api.getMyReviews();
      setData(response);
    } catch (error) {
      toast.error(error.message || 'Failed to load customer reviews.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, []);

  useEffect(() => {
    if (!socket) return undefined;

    const refresh = () => fetchReviews();
    socket.on('vendor_rating_updated', refresh);
    socket.on('citizen_review_submitted', refresh);
    socket.on('notification', refresh);

    return () => {
      socket.off('vendor_rating_updated', refresh);
      socket.off('citizen_review_submitted', refresh);
      socket.off('notification', refresh);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold uppercase tracking-[0.25em] text-text-tertiary">
        Loading customer reviews
      </div>
    );
  }

  const vendor = data.vendor;

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-tertiary">Reputation Center</p>
        <h1 className="mt-2 text-3xl font-black text-text-primary">Customer Reviews</h1>
        <p className="mt-2 text-sm text-text-secondary">Live citizen feedback, reputation movement, and service quality history.</p>
      </div>

      {vendor ? (
        <div className="grid gap-5 md:grid-cols-4">
          <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Average Rating</p>
            <p className="mt-3 text-3xl font-black text-text-primary">{Number(vendor.rating_avg || 0).toFixed(1)}</p>
            <div className="mt-3"><Stars value={vendor.rating_avg} /></div>
          </div>
          <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Total Reviews</p>
            <p className="mt-3 text-3xl font-black text-text-primary">{vendor.total_ratings || 0}</p>
          </div>
          <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Completed Jobs</p>
            <p className="mt-3 text-3xl font-black text-text-primary">{vendor.total_jobs_completed || 0}</p>
          </div>
          <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Reputation Score</p>
            <p className="mt-3 text-3xl font-black text-secondary-400">{Number(vendor.vendor_score || 0).toFixed(1)}</p>
          </div>
        </div>
      ) : null}

      {data.reviews?.length ? (
        <div className="grid gap-5 lg:grid-cols-2">
          {data.reviews.map((review, index) => (
            <motion.div
              key={review.vendor_review_id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="glass-card border border-border-primary p-6"
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-black text-text-primary">{review.citizen_name}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-text-tertiary">
                    {review.category?.replace(/_/g, ' ')} complaint
                  </p>
                </div>
                <div className="text-right">
                  <Stars value={review.rating} />
                  <p className="mt-2 text-xs text-text-secondary">{formatDate(review.created_at)}</p>
                </div>
              </div>

              <p className="mt-5 rounded-3xl border border-border-primary bg-surface-primary/70 p-5 text-sm leading-7 text-text-secondary">
                {review.review || 'No written comment was submitted for this job.'}
              </p>

              <div className="mt-5 flex flex-wrap gap-3 text-xs text-text-secondary">
                <span className="inline-flex items-center gap-2 rounded-full border border-border-primary px-3 py-1.5">
                  <MessageSquare size={13} />
                  Complaint #{review.complaint_id}
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-border-primary px-3 py-1.5">
                  <Trophy size={13} />
                  {review.rating}/5 rating
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      ) : (
        <div className="rounded-3xl border border-dashed border-border-primary p-12 text-center text-text-tertiary">
          No citizen reviews yet. Completed and approved jobs will show up here automatically.
        </div>
      )}
    </div>
  );
}
