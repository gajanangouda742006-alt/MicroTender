import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { getAssetUrl } from '../api';
import { useNotifications } from '../NotificationContext';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import { StatusBadge } from '../components/StatusTimeline';
import {
  CalendarClock,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Star,
  Trophy,
  UserRound,
} from 'lucide-react';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

function RatingStars({ value, onChange, onHover, hovered = 0, interactive = false }) {
  return (
    <div className="flex items-center gap-2">
      {[1, 2, 3, 4, 5].map((star) => {
        const active = star <= (hovered || value || 0);
        const classes = active
          ? 'fill-amber-400 text-amber-400 scale-110 drop-shadow-[0_0_12px_rgba(251,191,36,0.35)]'
          : 'text-text-tertiary/35';

        const icon = (
          <Star
            size={interactive ? 28 : 16}
            className={`transition duration-200 ${classes}`}
          />
        );

        if (!interactive) return <span key={star}>{icon}</span>;

        return (
          <button
            key={star}
            type="button"
            onMouseEnter={() => onHover?.(star)}
            onMouseLeave={() => onHover?.(0)}
            onClick={() => onChange?.(star)}
            className="transition hover:scale-125"
          >
            {icon}
          </button>
        );
      })}
    </div>
  );
}

export default function CitizenCompletedComplaints() {
  const { socket } = useNotifications();
  const [complaints, setComplaints] = useState([]);
  const [detailsById, setDetailsById] = useState({});
  const [expandedId, setExpandedId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submittingId, setSubmittingId] = useState(null);
  const [reviewDrafts, setReviewDrafts] = useState({});
  const [hoveredStars, setHoveredStars] = useState({});

  const fetchCompletedComplaints = async () => {
    try {
      const response = await api.getCompletedComplaints();
      setComplaints(response.complaints || []);
    } catch (error) {
      toast.error(error.message || 'Failed to load completed complaints.');
    } finally {
      setLoading(false);
    }
  };

  const fetchComplaintDetail = async (complaintId) => {
    if (detailsById[complaintId]) return;
    try {
      const detail = await api.getComplaint(complaintId);
      setDetailsById((current) => ({ ...current, [complaintId]: detail }));
    } catch (error) {
      toast.error(error.message || 'Failed to load complaint detail.');
    }
  };

  useEffect(() => {
    fetchCompletedComplaints();
  }, []);

  useEffect(() => {
    if (expandedId) {
      fetchComplaintDetail(expandedId);
    }
  }, [expandedId]);

  useEffect(() => {
    if (!socket) return undefined;

    const refresh = () => fetchCompletedComplaints();
    socket.on('completion_reviewed', refresh);
    socket.on('complaint_updated', refresh);
    socket.on('rating_updated', refresh);

    return () => {
      socket.off('completion_reviewed', refresh);
      socket.off('complaint_updated', refresh);
      socket.off('rating_updated', refresh);
    };
  }, [socket]);

  const handleToggle = async (complaintId) => {
    const nextId = expandedId === complaintId ? null : complaintId;
    setExpandedId(nextId);
    if (nextId) {
      await fetchComplaintDetail(nextId);
    }
  };

  const handleReviewChange = (complaintId, field, value) => {
    setReviewDrafts((current) => ({
      ...current,
      [complaintId]: {
        ...(current[complaintId] || { score: 0, feedback: '' }),
        [field]: value,
      },
    }));
  };

  const handleSubmitReview = async (complaint) => {
    const draft = reviewDrafts[complaint.complaint_id];
    if (!draft?.score) {
      toast.error('Please select a rating before submitting.');
      return;
    }

    try {
      setSubmittingId(complaint.complaint_id);
      await api.submitRating({
        complaint_id: complaint.complaint_id,
        rating: draft.score,
        review: draft.feedback,
      });
      toast.success('Review submitted successfully.');
      setReviewDrafts((current) => ({ ...current, [complaint.complaint_id]: { score: 0, feedback: '' } }));
      await fetchCompletedComplaints();
      await fetchComplaintDetail(complaint.complaint_id);
    } catch (error) {
      toast.error(error.message || 'Failed to submit review.');
    } finally {
      setSubmittingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center text-sm font-bold uppercase tracking-[0.25em] text-text-tertiary">
        Loading completed complaints
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-tertiary">Resolution Archive</p>
        <h1 className="mt-2 text-3xl font-black text-text-primary">Completed Complaints</h1>
        <p className="mt-2 text-sm text-text-secondary">Verified issue resolutions, before-and-after proof, and vendor review submission.</p>
      </div>

      {!complaints.length ? (
        <div className="rounded-3xl border border-dashed border-border-primary p-12 text-center text-text-tertiary">
          No verified completed complaints yet.
        </div>
      ) : (
        <div className="space-y-6">
          {complaints.map((complaint, index) => {
            const expanded = expandedId === complaint.complaint_id;
            const detail = detailsById[complaint.complaint_id];
            const draft = reviewDrafts[complaint.complaint_id] || { score: 0, feedback: '' };
            const hoverValue = hoveredStars[complaint.complaint_id] || 0;
            const approvedProof = detail?.completionProofs?.find((proof) => proof.status === 'approved') || detail?.completionProofs?.[0] || null;

            return (
              <motion.div
                key={complaint.complaint_id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="glass-card border border-border-primary p-6"
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black text-text-primary">{complaint.category?.replace(/_/g, ' ')}</h2>
                      <StatusBadge status={complaint.status} />
                    </div>
                    <p className="mt-4 max-w-3xl text-sm leading-7 text-text-secondary">{complaint.description}</p>
                    <div className="mt-5 flex flex-wrap gap-3 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-2 rounded-full border border-border-primary px-3 py-1.5">
                        <UserRound size={13} />
                        {complaint.vendor_name || 'Vendor pending'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border-primary px-3 py-1.5">
                        <Trophy size={13} />
                        {complaint.company_name || 'Company unavailable'}
                      </span>
                      <span className="inline-flex items-center gap-2 rounded-full border border-border-primary px-3 py-1.5">
                        <CalendarClock size={13} />
                        {formatDate(complaint.completion_date || complaint.completed_at)}
                      </span>
                    </div>
                  </div>

                  <div className="grid min-w-[280px] gap-3 sm:grid-cols-3 xl:grid-cols-1">
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Vendor Rating</p>
                      <div className="mt-3 flex items-center gap-3">
                        <RatingStars value={complaint.rating_avg} />
                        <span className="text-sm font-bold text-text-primary">{Number(complaint.rating_avg || 0).toFixed(1)}</span>
                      </div>
                    </div>
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Completed Jobs</p>
                      <p className="mt-3 text-2xl font-black text-text-primary">{complaint.total_jobs_completed || 0}</p>
                    </div>
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Your Review</p>
                      <p className="mt-3 text-sm font-bold text-text-primary">
                        {complaint.citizen_rating ? `${complaint.citizen_rating}/5 submitted` : 'Pending'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 md:grid-cols-2">
                  <div className="overflow-hidden rounded-3xl border border-border-primary bg-bg-secondary">
                    <img src={getAssetUrl(complaint.image_url)} alt="Original complaint" className="h-56 w-full object-cover" />
                  </div>
                  <div className="overflow-hidden rounded-3xl border border-border-primary bg-bg-secondary">
                    <img
                      src={getAssetUrl(complaint.cover_image_url || complaint.image_urls?.[0])}
                      alt="Completed work"
                      className="h-56 w-full object-cover"
                    />
                  </div>
                </div>

                <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
                  <p className="text-sm text-text-secondary">
                    {complaint.completion_note || 'No final completion note was attached by the vendor.'}
                  </p>
                  <button
                    onClick={() => handleToggle(complaint.complaint_id)}
                    className="inline-flex items-center gap-2 rounded-2xl border border-border-primary bg-surface-primary/70 px-4 py-2 text-sm font-bold text-text-primary transition hover:border-secondary-500/35"
                  >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    {expanded ? 'Hide Details' : 'View Lifecycle'}
                  </button>
                </div>

                <AnimatePresence initial={false}>
                  {expanded ? (
                    <motion.div
                      key="expanded"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-8 space-y-8 border-t border-border-primary pt-8">
                        <BeforeAfterSlider
                          beforeImage={getAssetUrl(detail?.complaint?.image_url || complaint.image_url)}
                          afterImage={approvedProof?.cover_image_url ? getAssetUrl(approvedProof.cover_image_url) : ''}
                          beforeLabel="Before"
                          afterLabel="After"
                          height="340px"
                        />

                        <div className="grid gap-8 xl:grid-cols-2">
                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <CheckCircle2 size={18} className="text-secondary-500" />
                              <h3 className="text-lg font-black text-text-primary">Work Timeline</h3>
                            </div>
                            {detail?.workUpdates?.length ? (
                              detail.workUpdates.map((update) => (
                                <div key={update.update_id} className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                                  <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                      <div className="flex flex-wrap items-center gap-3">
                                        <span className="rounded-full border border-secondary-500/25 bg-secondary-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-secondary-400">
                                          {update.progress_percentage || 0}%
                                        </span>
                                        <span className="text-xs text-text-secondary">{formatDate(update.created_at)}</span>
                                      </div>
                                      <p className="mt-3 text-sm text-text-primary">{update.description}</p>
                                      <p className="mt-2 text-xs text-text-secondary">By {update.company_name || update.vendor_name}</p>
                                    </div>
                                    {update.image_url ? (
                                      <a href={getAssetUrl(update.image_url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border-primary">
                                        <img src={getAssetUrl(update.image_url)} alt="Timeline proof" className="h-24 w-28 object-cover" />
                                      </a>
                                    ) : null}
                                  </div>
                                </div>
                              ))
                            ) : (
                              <div className="rounded-3xl border border-dashed border-border-primary p-8 text-center text-text-tertiary">
                                Timeline updates will appear here once available.
                              </div>
                            )}
                          </div>

                          <div className="space-y-4">
                            <div className="flex items-center gap-3">
                              <MessageSquare size={18} className="text-secondary-500" />
                              <h3 className="text-lg font-black text-text-primary">Citizen Rating and Review</h3>
                            </div>

                            {complaint.citizen_rating ? (
                              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6">
                                <div className="flex items-center justify-between gap-4">
                                  <RatingStars value={complaint.citizen_rating} />
                                  <span className="text-xs text-text-secondary">{formatDate(complaint.citizen_reviewed_at)}</span>
                                </div>
                                <p className="mt-4 text-sm leading-7 text-text-secondary">{complaint.citizen_review || 'No written feedback was provided.'}</p>
                              </div>
                            ) : (
                              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6">
                                <div className="space-y-5">
                                  <div>
                                    <p className="text-sm font-bold text-text-primary">Rate the resolved work</p>
                                    <p className="mt-1 text-xs text-text-secondary">Your feedback updates the vendor reputation automatically.</p>
                                  </div>

                                  <RatingStars
                                    interactive
                                    value={draft.score}
                                    hovered={hoverValue}
                                    onHover={(value) => setHoveredStars((current) => ({ ...current, [complaint.complaint_id]: value }))}
                                    onChange={(value) => handleReviewChange(complaint.complaint_id, 'score', value)}
                                  />

                                  <textarea
                                    rows={4}
                                    value={draft.feedback}
                                    onChange={(event) => handleReviewChange(complaint.complaint_id, 'feedback', event.target.value)}
                                    placeholder="Describe the repair quality, timeliness, and overall service..."
                                    className="input-futuristic w-full"
                                  />

                                  <button
                                    onClick={() => handleSubmitReview(complaint)}
                                    disabled={submittingId === complaint.complaint_id}
                                    className="w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:opacity-60"
                                  >
                                    {submittingId === complaint.complaint_id ? 'Submitting Review...' : 'Submit Vendor Review'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ) : null}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
