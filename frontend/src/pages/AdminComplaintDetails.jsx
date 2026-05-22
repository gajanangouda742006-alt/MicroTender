import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { getAssetUrl } from '../api';
import { useNotifications } from '../NotificationContext';
import MapPicker from '../components/MapPicker';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import StatusTimeline, { StatusBadge } from '../components/StatusTimeline';
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Navigation,
  Sparkles,
  Star,
  UserRound,
  Users2,
  XCircle,
} from 'lucide-react';

function safeParse(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try {
    return JSON.parse(value);
  } catch (error) {
    return null;
  }
}

function formatDate(value) {
  if (!value) return 'Not available';
  return new Date(value).toLocaleString();
}

function priorityClasses(priority) {
  return {
    low: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    medium: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    high: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    critical: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  }[priority] || 'bg-slate-500/15 text-slate-300 border-slate-500/30';
}

function MetricCard({ label, value, hint }) {
  return (
    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5 shadow-soft">
      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">{label}</p>
      <p className="mt-3 text-2xl font-black text-text-primary">{value}</p>
      {hint ? <p className="mt-2 text-xs text-text-secondary">{hint}</p> : null}
    </div>
  );
}

function Stars({ value = 0 }) {
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <Star
          key={star}
          size={14}
          className={star <= Math.round(value) ? 'fill-amber-400 text-amber-400' : 'text-text-tertiary/40'}
        />
      ))}
    </div>
  );
}

function GalleryStrip({ images, title }) {
  if (!images?.length) return null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-bold text-text-primary">
        <ImageIcon size={16} className="text-secondary-500" />
        <span>{title}</span>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {images.map((image, index) => (
          <a
            key={`${image}-${index}`}
            href={getAssetUrl(image)}
            target="_blank"
            rel="noreferrer"
            className="group overflow-hidden rounded-2xl border border-border-primary bg-bg-secondary"
          >
            <img
              src={getAssetUrl(image)}
              alt={`${title} ${index + 1}`}
              className="h-28 w-full object-cover transition duration-300 group-hover:scale-105"
            />
          </a>
        ))}
      </div>
    </div>
  );
}

export default function AdminComplaintDetails() {
  const { complaintId } = useParams();
  const navigate = useNavigate();
  const { socket } = useNotifications();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');

  const fetchDetails = async () => {
    try {
      const response = await api.getAdminComplaintDetails(complaintId);
      setData(response);
      setReviewNotes(response.latestCompletionProof?.review_notes || '');
    } catch (error) {
      toast.error(error.message || 'Failed to load complaint lifecycle.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    fetchDetails();
  }, [complaintId]);

  useEffect(() => {
    if (!socket || !complaintId) return undefined;

    const room = `complaint_${complaintId}`;
    const numericId = Number(complaintId);
    const refresh = (payload = {}) => {
      if (!payload.complaintId || Number(payload.complaintId) === numericId) {
        fetchDetails();
      }
    };

    socket.emit('join', room);
    ['complaint_updated', 'vendor_assignment_updated', 'work_update_created', 'completion_submitted', 'completion_reviewed', 'citizen_review_submitted']
      .forEach((eventName) => socket.on(eventName, refresh));

    return () => {
      ['complaint_updated', 'vendor_assignment_updated', 'work_update_created', 'completion_submitted', 'completion_reviewed', 'citizen_review_submitted']
        .forEach((eventName) => socket.off(eventName, refresh));
    };
  }, [socket, complaintId]);

  const complaint = data?.complaint;
  const tender = data?.tender;
  const assignedVendor = data?.assignedVendor;
  const latestCompletionProof = data?.latestCompletionProof;
  const workUpdates = data?.workUpdates || [];
  const aiAnalysis = useMemo(() => safeParse(complaint?.ai_analysis), [complaint?.ai_analysis]);

  const isAssigned = !!assignedVendor;
  const isOpen = complaint?.status === 'open';
  const showAI = !isAssigned && isOpen;
  const hasProof = !!(latestCompletionProof?.cover_image_url && latestCompletionProof?.status && latestCompletionProof?.status !== 'pending');

  const progressImages = workUpdates.filter((update) => update.image_url).map((update) => update.image_url);
  const completionImages = latestCompletionProof?.image_urls || [];
  const latestProgress = workUpdates.length > 0 ? (workUpdates[workUpdates.length - 1].progress_percentage ?? 0) : 0;

  const runAction = async (label, fn) => {
    try {
      setActionLoading(label);
      await fn();
      await fetchDetails();
    } catch (error) {
      toast.error(error.message || 'Action failed.');
    } finally {
      setActionLoading('');
    }
  };

  const handleCreateTender = () => runAction('create', async () => {
    await api.approveComplaint(complaintId);
    toast.success('Tender created for this complaint.');
  });

  const handleAutoAssign = () => {
    if (!tender?.tender_id) return;
    runAction('auto', async () => {
      const result = await api.autoAssign(tender.tender_id);
      toast.success(`Assigned to ${result.assignedVendor.vendor_name || result.assignedVendor.company_name}.`);
    });
  };

  const handleManualAssign = (vendorId) => {
    if (!tender?.tender_id) return;
    runAction(`assign-${vendorId}`, async () => {
      await api.assignVendor(tender.tender_id, vendorId, 'Manual assignment from admin complaint lifecycle page', 'manual');
      toast.success('Vendor assigned successfully.');
    });
  };

  const handleCancelTender = () => {
    if (!tender?.tender_id) return;
    runAction('cancel', async () => {
      await api.adminAction(tender.tender_id, 'cancel', reviewNotes || 'Cancelled from admin complaint lifecycle page');
      toast.success('Tender cancelled.');
    });
  };

  const handleCompletionReview = (action) => {
    if (!tender?.tender_id) return;
    runAction(`review-${action}`, async () => {
      await api.verifyCompletion(tender.tender_id, action, reviewNotes);
      toast.success(action === 'approve' ? 'Completion approved.' : action === 'reject' ? 'Completion rejected.' : 'Rework requested.');
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm font-bold uppercase tracking-[0.25em] text-text-tertiary">
        <Loader2 size={18} className="animate-spin text-secondary-500" />
        Loading complaint lifecycle
      </div>
    );
  }

  if (!complaint) {
    return (
      <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-10 text-center">
        <p className="text-lg font-bold text-text-primary">Complaint not found.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/admin/complaints')}
            className="rounded-2xl border border-border-primary bg-surface-primary/70 p-3 text-text-secondary transition hover:border-secondary-500/40 hover:text-text-primary"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-tertiary">Civic Lifecycle Console</p>
            <h1 className="mt-2 text-3xl font-black text-text-primary">Complaint #{complaint.complaint_id}</h1>
            <p className="mt-2 text-sm text-text-secondary">Dedicated admin workflow for assignment, proof review, and live progress monitoring.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <StatusBadge status={complaint.status} />
          {tender?.priority ? (
            <span className={`rounded-full border px-4 py-2 text-[11px] font-bold uppercase tracking-[0.2em] ${priorityClasses(tender.priority)}`}>
              {tender.priority} priority
            </span>
          ) : null}
        </div>
      </div>

      <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-8">
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card overflow-hidden border border-border-primary"
          >
            <div className="grid gap-0 lg:grid-cols-[1.1fr_0.9fr]">
              <div className="min-h-[340px] bg-bg-secondary">
                {complaint.image_url ? (
                  <img
                    src={getAssetUrl(complaint.image_url)}
                    alt="Complaint evidence"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full items-center justify-center text-text-tertiary">No complaint image uploaded</div>
                )}
              </div>
              <div className="space-y-6 p-7">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Complaint Details</p>
                    <h2 className="mt-2 text-2xl font-black text-text-primary">{complaint.category?.replace(/_/g, ' ')}</h2>
                  </div>
                  <div className="rounded-2xl border border-secondary-500/25 bg-secondary-500/10 px-4 py-3 text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-secondary-400">AI Estimated Cost</p>
                    <p className="mt-2 text-2xl font-black text-secondary-400">Rs {Math.round(tender?.estimated_cost || 0).toLocaleString()}</p>
                  </div>
                </div>

                <p className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5 text-sm leading-7 text-text-secondary">
                  {complaint.description}
                </p>

                <div className="grid gap-4 sm:grid-cols-2">
                  <MetricCard label="Citizen" value={complaint.citizen_name} hint={complaint.citizen_email || complaint.citizen_phone} />
                  <MetricCard label="Created" value={new Date(complaint.created_at).toLocaleDateString()} hint={formatDate(complaint.created_at)} />
                  <MetricCard label="Latest Progress" value={`${latestProgress || 0}%`} hint={data?.latestWorkUpdate?.description || latestCompletionProof?.completion_note || 'Waiting for field updates'} />
                  <MetricCard label="Tender Status" value={tender?.status?.replace(/_/g, ' ') || 'Not created'} hint={tender?.verification_status || 'No tender yet'} />
                </div>
              </div>
            </div>
          </motion.section>

          <section className="grid gap-8 lg:grid-cols-2">
            <div className="glass-card border border-border-primary p-7">
              <div className="mb-5 flex items-center gap-3">
                <MapPin size={18} className="text-secondary-500" />
                <h3 className="text-lg font-black text-text-primary">GPS and Map Location</h3>
              </div>
              <div className="overflow-hidden rounded-3xl border border-border-primary">
                <MapPicker
                  lat={complaint.latitude}
                  lng={complaint.longitude}
                  readOnly
                  height="260px"
                  markers={[
                    {
                      lat: complaint.latitude || 19.076,
                      lng: complaint.longitude || 72.8777,
                      icon: '📍',
                      popup: `Complaint #${complaint.complaint_id}`,
                    },
                  ]}
                />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-text-secondary">
                <span className="rounded-full border border-border-primary px-3 py-1.5">
                  {complaint.latitude?.toFixed?.(5) || 'NA'}, {complaint.longitude?.toFixed?.(5) || 'NA'}
                </span>
                {complaint.latitude != null && complaint.longitude != null ? (
                  <a
                    href={`https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-secondary-500/30 bg-secondary-500/10 px-4 py-1.5 font-semibold text-secondary-400"
                  >
                    <Navigation size={14} />
                    Open in Maps
                  </a>
                ) : null}
              </div>
            </div>

            <div className="glass-card border border-border-primary p-7">
              <div className="mb-5 flex items-center gap-3">
                <Clock3 size={18} className="text-secondary-500" />
                <h3 className="text-lg font-black text-text-primary">Timeline and Progress Tracker</h3>
              </div>
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6">
                <StatusTimeline currentStatus={complaint.status} />
              </div>
              <div className="mt-5 overflow-hidden rounded-full bg-bg-secondary">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${latestProgress || 0}%` }}
                  className="h-3 rounded-full bg-gradient-to-r from-secondary-500 via-cyan-400 to-emerald-400"
                />
              </div>
              <p className="mt-3 text-xs font-semibold uppercase tracking-[0.22em] text-text-tertiary">
                Completion percentage: {latestProgress || 0}%
              </p>
            </div>
          </section>

          <section className="glass-card border border-border-primary p-7">
            <div className="mb-5 flex items-center gap-3">
              <BrainCircuit size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">AI Analysis Summary</h3>
            </div>
            <div className="grid gap-5 lg:grid-cols-[1fr_280px]">
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6 text-sm leading-7 text-text-secondary">
                {aiAnalysis?.aiSummary || aiAnalysis?.summary || 'No AI summary available for this complaint yet.'}
              </div>
              <div className="space-y-4 rounded-3xl border border-border-primary bg-bg-secondary/60 p-6">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Department</p>
                  <p className="mt-2 text-lg font-black text-text-primary">{complaint.department || aiAnalysis?.department || 'Pending routing'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Risk Level</p>
                  <p className="mt-2 text-lg font-black text-text-primary">{aiAnalysis?.riskLevel || 'Unknown'}</p>
                </div>
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-text-tertiary">Confidence</p>
                  <p className="mt-2 text-lg font-black text-secondary-400">
                    {aiAnalysis?.confidenceScore ? `${Math.round(aiAnalysis.confidenceScore * 100)}%` : 'Not provided'}
                  </p>
                </div>
              </div>
            </div>
          </section>

          <section className="glass-card border border-border-primary p-7">
            <div className="mb-5 flex items-center gap-3">
              <ImageIcon size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">Before and After Work Images</h3>
            </div>
                        {hasProof ? (
              <BeforeAfterSlider
                beforeImage={getAssetUrl(complaint.image_url)}
                afterImage={getAssetUrl(latestCompletionProof.cover_image_url)}
                beforeLabel="Reported Issue"
                afterLabel="Completed Work"
                height="360px"
              />
            ) : (
              <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
                Final completion images will appear here after the vendor uploads proof and admin verification.
              </div>
            )}
            <div className="mt-6 grid gap-6 lg:grid-cols-2">
              <GalleryStrip images={progressImages} title="Progress Evidence" />
              <GalleryStrip images={completionImages} title="Completion Proofs" />
            </div>
          </section>

          <section className="glass-card border border-border-primary p-7">
            <div className="mb-6 flex items-center gap-3">
              <Sparkles size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">Admin Work Monitoring</h3>
            </div>

            {workUpdates.length === 0 ? (
              <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
                No vendor progress updates yet.
              </div>
            ) : (
              <div className="space-y-4">
                {workUpdates.map((update) => (
                  <div key={update.update_id} className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full border border-secondary-500/25 bg-secondary-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-secondary-400">
                            {update.update_type || 'progress'}
                          </span>
                          <span className="rounded-full border border-border-primary px-3 py-1 text-xs font-semibold text-text-secondary">
                            {update.progress_percentage || 0}% completed
                          </span>
                        </div>
                        <p className="text-base font-bold text-text-primary">{update.description}</p>
                        <p className="text-xs text-text-secondary">
                          Vendor note by {update.company_name || update.vendor_name} on {formatDate(update.created_at)}
                        </p>
                      </div>
                      {update.image_url ? (
                        <a href={getAssetUrl(update.image_url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border-primary">
                          <img src={getAssetUrl(update.image_url)} alt="Work update" className="h-24 w-28 object-cover" />
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

                      {showAI && (
            <section id="recommended-vendors" className="glass-card border border-border-primary p-7">
              <div className="mb-6 flex items-center gap-3">
                <Users2 size={18} className="text-secondary-500" />
                <h3 className="text-lg font-black text-text-primary">AI Recommended Vendors</h3>
              </div>

              {data?.recommendedVendors?.length ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {data.recommendedVendors.map((vendor, index) => {
                    const isAssigned = tender?.assigned_vendor_id === vendor.vendor_id;
                    return (
                      <motion.div
                        key={vendor.vendor_id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.06 }}
                        className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-lg font-black text-text-primary">{vendor.company_name || vendor.vendor_name}</p>
                            <p className="mt-1 text-sm text-text-secondary">{vendor.contact_name || vendor.vendor_name}</p>
                          </div>
                          <span className="rounded-full border border-secondary-500/25 bg-secondary-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-secondary-400">
                            AI score {vendor.ai_score}
                          </span>
                        </div>

                        <div className="mt-4 flex items-center gap-3">
                          <Stars value={vendor.rating_avg} />
                          <span className="text-sm font-semibold text-text-secondary">{Number(vendor.rating_avg || 0).toFixed(1)} rating</span>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-3 text-sm text-text-secondary">
                          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">Experience</p>
                            <p className="mt-2 font-bold text-text-primary">{vendor.experience_years || 0} years</p>
                          </div>
                          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">Distance</p>
                            <p className="mt-2 font-bold text-text-primary">{vendor.distance_km == null ? 'Unknown' : `${vendor.distance_km} km`}</p>
                          </div>
                          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">Completed Works</p>
                            <p className="mt-2 font-bold text-text-primary">{vendor.total_jobs_completed || 0}</p>
                          </div>
                          <div className="rounded-2xl border border-border-primary bg-bg-secondary/60 p-3">
                            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-text-tertiary">Bid Amount</p>
                            <p className="mt-2 font-bold text-text-primary">Rs {Math.round(vendor.bid_amount || 0).toLocaleString()}</p>
                          </div>
                        </div>

                        <p className="mt-4 text-sm text-text-secondary">{vendor.recommendation_reason}</p>

                        <div className="mt-5 flex items-center justify-between gap-3">
                          <span className="text-xs text-text-tertiary">
                            Bid success rate: {Math.round(Number(vendor.bid_success_rate || 0) * 100)}%
                          </span>
                          <button
                            onClick={() => handleManualAssign(vendor.vendor_id)}
                            disabled={!tender?.tender_id || actionLoading === `assign-${vendor.vendor_id}` || isAssigned}
                            className="rounded-2xl bg-secondary-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isAssigned ? 'Assigned' : actionLoading === `assign-${vendor.vendor_id}` ? 'Assigning...' : 'Assign Vendor'}
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
                  No recommended vendors yet. Create the tender first or wait for applications.
                </div>
              )}
            </section>
            )}

          {data?.rating ? (
            <section className="glass-card border border-border-primary p-7">
              <div className="mb-5 flex items-center gap-3">
                <Star size={18} className="text-amber-400" />
                <h3 className="text-lg font-black text-text-primary">Citizen Review</h3>
              </div>
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-bold text-text-primary">{data.rating.citizen_name}</p>
                    <p className="mt-1 text-xs text-text-secondary">{formatDate(data.rating.created_at)}</p>
                  </div>
                  <Stars value={data.rating.score} />
                </div>
                <p className="mt-4 text-sm leading-7 text-text-secondary">{data.rating.feedback || 'No written review provided.'}</p>
              </div>
            </section>
          ) : null}
        </div>

        <aside className="space-y-6 xl:sticky xl:top-6 xl:h-fit">
          <div className="glass-card border border-border-primary p-6">
            <div className="mb-5 flex items-center gap-3">
              <Bot size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">Tender Management</h3>
            </div>

            <div className="space-y-3">
                           {!tender ? (
                  <button
                    onClick={handleCreateTender}
                    disabled={actionLoading === 'create'}
                    className="w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:opacity-60"
                  >
                    {actionLoading === 'create' ? 'Creating...' : 'Create Tender'}
                  </button>
                ) : (
                  <>
                    {isAssigned ? null : (
                      <>
                        <button
                          onClick={handleAutoAssign}
                          disabled={actionLoading === 'auto'}
                          className="w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:opacity-60"
                        >
                          {actionLoading === 'auto' ? 'Auto assigning...' : 'Auto Assign'}
                        </button>
                        <button
                          onClick={() => document.getElementById('recommended-vendors')?.scrollIntoView({ behavior: 'smooth' })}
                          className="w-full rounded-2xl border border-border-primary bg-surface-primary/70 px-4 py-3 text-sm font-bold text-text-primary transition hover:border-secondary-500/35"
                        >
                          Manual Assign
                        </button>
                        <button
                          onClick={handleCancelTender}
                          disabled={actionLoading === 'cancel'}
                          className="w-full rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/15 disabled:opacity-60"
                        >
                          {actionLoading === 'cancel' ? 'Cancelling...' : 'Cancel Tender'}
                        </button>
                      </>
                    )}
                  </>
                )}
            </div>

            {assignedVendor ? (
              <div className="mt-6 rounded-3xl border border-border-primary bg-bg-secondary/60 p-5">
                <div className="flex items-center gap-3">
                  <UserRound size={16} className="text-secondary-500" />
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Assigned Vendor</p>
                    <p className="mt-1 text-base font-black text-text-primary">{assignedVendor.company_name || assignedVendor.vendor_name}</p>
                  </div>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <Stars value={assignedVendor.rating_avg} />
                  <span className="text-sm text-text-secondary">{Number(assignedVendor.rating_avg || 0).toFixed(1)} avg rating</span>
                </div>
                <p className="mt-4 text-xs text-text-secondary">{assignedVendor.total_jobs_completed || 0} completed jobs</p>
              </div>
            ) : null}
          </div>

          <div className="glass-card border border-border-primary p-6">
            <div className="mb-5 flex items-center gap-3">
              <CheckCircle2 size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">Completion Verification</h3>
            </div>

            {latestCompletionProof ? (
              <div className="space-y-4">
                <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Latest submission</p>
                  <p className="mt-2 text-sm font-bold text-text-primary">{formatDate(latestCompletionProof.submitted_at)}</p>
                  <p className="mt-3 text-sm text-text-secondary">{latestCompletionProof.completion_note || 'No vendor notes attached.'}</p>
                  <p className="mt-3 text-xs text-text-secondary">AI review: {latestCompletionProof.ai_summary || latestCompletionProof.ai_verdict || 'Pending'}</p>
                </div>

                <textarea
                  value={reviewNotes}
                  onChange={(event) => setReviewNotes(event.target.value)}
                  rows={4}
                  placeholder="Add approval note, rejection reason, or rework instructions..."
                  className="input-futuristic w-full"
                />

                <div className="grid gap-3">
                  <button
                    onClick={() => handleCompletionReview('approve')}
                    disabled={actionLoading === 'review-approve'}
                    className="rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {actionLoading === 'review-approve' ? 'Approving...' : 'Approve Completion'}
                  </button>
                  <button
                    onClick={() => handleCompletionReview('reject')}
                    disabled={actionLoading === 'review-reject'}
                    className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm font-bold text-rose-400 transition hover:bg-rose-500/15 disabled:opacity-60"
                  >
                    {actionLoading === 'review-reject' ? 'Rejecting...' : 'Reject Completion'}
                  </button>
                  <button
                    onClick={() => handleCompletionReview('request_rework')}
                    disabled={actionLoading === 'review-request_rework'}
                    className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-bold text-amber-400 transition hover:bg-amber-500/15 disabled:opacity-60"
                  >
                    {actionLoading === 'review-request_rework' ? 'Sending...' : 'Request Rework'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="rounded-3xl border border-dashed border-border-primary p-8 text-center text-sm text-text-tertiary">
                Vendor completion proof has not been submitted yet.
              </div>
            )}
          </div>

          <div className="glass-card border border-border-primary p-6">
            <div className="mb-5 flex items-center gap-3">
              <AlertTriangle size={18} className="text-secondary-500" />
              <h3 className="text-lg font-black text-text-primary">Live Monitoring Snapshot</h3>
            </div>
            <div className="space-y-4">
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Latest progress</p>
                <p className="mt-2 text-3xl font-black text-text-primary">{latestProgress || 0}%</p>
                <p className="mt-2 text-sm text-text-secondary">{data?.latestWorkUpdate?.description || 'Waiting for vendor update'}</p>
              </div>
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Latest timestamp</p>
                <p className="mt-2 text-sm font-bold text-text-primary">
                  {formatDate(data?.latestWorkUpdate?.created_at || latestCompletionProof?.submitted_at)}
                </p>
              </div>
              <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">Final proof status</p>
                <p className="mt-2 text-sm font-bold text-text-primary">{latestCompletionProof?.status || 'Pending submission'}</p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
