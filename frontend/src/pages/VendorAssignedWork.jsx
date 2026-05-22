import { useEffect, useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import api, { getAssetUrl } from '../api';
import { useNotifications } from '../NotificationContext';
import BeforeAfterSlider from '../components/BeforeAfterSlider';
import StatusTimeline, { StatusBadge } from '../components/StatusTimeline';
import {
  Briefcase,
  Camera,
  CheckCircle2,
  Clock3,
  Loader2,
  MapPin,
  MessageSquare,
  Send,
  UploadCloud,
} from 'lucide-react';

function formatDate(value) {
  return value ? new Date(value).toLocaleString() : 'Not available';
}

export default function VendorAssignedWork() {
  const { socket } = useNotifications();
  const [jobs, setJobs] = useState([]);
  const [selectedComplaintId, setSelectedComplaintId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState('');
  const [progressForm, setProgressForm] = useState({
    progress: 50,
    description: '',
    image: null,
  });
  const [completionNote, setCompletionNote] = useState('');
  const [completionFiles, setCompletionFiles] = useState([]);

  const fetchJobs = async () => {
    try {
      const response = await api.getAssignedWork();
      const nextJobs = response.jobs || [];
      setJobs(nextJobs);
      setSelectedComplaintId((current) => {
        if (current && nextJobs.some((job) => job.complaint_id === current)) return current;
        return nextJobs[0]?.complaint_id || null;
      });
    } catch (error) {
      toast.error(error.message || 'Failed to load assigned work.');
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (complaintId) => {
    if (!complaintId) {
      setDetail(null);
      return;
    }

    try {
      const response = await api.getVendorComplaintDetails(complaintId);
      setDetail(response);
    } catch (error) {
      toast.error(error.message || 'Failed to load complaint detail.');
    }
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  useEffect(() => {
    fetchDetail(selectedComplaintId);
  }, [selectedComplaintId]);

  useEffect(() => {
    if (!socket) return undefined;

    const refresh = (payload = {}) => {
      fetchJobs();
      if (!payload.complaintId || Number(payload.complaintId) === Number(selectedComplaintId)) {
        fetchDetail(selectedComplaintId);
      }
    };

    if (selectedComplaintId) {
      socket.emit('join', `complaint_${selectedComplaintId}`);
    }

    ['complaint_updated', 'vendor_assignment_updated', 'work_update_created', 'completion_submitted', 'completion_reviewed', 'citizen_review_submitted']
      .forEach((eventName) => socket.on(eventName, refresh));

    return () => {
      ['complaint_updated', 'vendor_assignment_updated', 'work_update_created', 'completion_submitted', 'completion_reviewed', 'citizen_review_submitted']
        .forEach((eventName) => socket.off(eventName, refresh));
    };
  }, [socket, selectedComplaintId]);

  const selectedJob = useMemo(
    () => jobs.find((job) => job.complaint_id === selectedComplaintId) || null,
    [jobs, selectedComplaintId]
  );

  const latestCompletionProof = detail?.completionProofs?.[0] || null;
  const latestProgress = detail?.workUpdates?.[0]?.progress_percentage
    ?? latestCompletionProof?.progress_snapshot
    ?? selectedJob?.latest_progress
    ?? 0;

  const runAction = async (label, fn) => {
    try {
      setSubmitting(label);
      await fn();
      await fetchJobs();
      await fetchDetail(selectedComplaintId);
    } catch (error) {
      toast.error(error.message || 'Action failed.');
    } finally {
      setSubmitting('');
    }
  };

  const handleStartWork = () => {
    if (!selectedJob?.tender_id) return;
    runAction('start', async () => {
      await api.updateTenderStatus(selectedJob.tender_id, 'in_progress');
      toast.success('Work started.');
    });
  };

  const handleSubmitProgress = (event) => {
    event.preventDefault();
    if (!detail?.tender?.tender_id || !progressForm.description.trim()) return;

    runAction('progress', async () => {
      const formData = new FormData();
      formData.append('tender_id', detail.tender.tender_id);
      formData.append('description', progressForm.description);
      formData.append('progress_percentage', progressForm.progress);
      if (progressForm.image) {
        formData.append('image', progressForm.image);
      }

      await api.submitWorkUpdate(formData);
      setProgressForm({ progress: Math.min(100, Number(progressForm.progress) + 10), description: '', image: null });
      toast.success('Progress update submitted.');
    });
  };

  const handleSubmitCompletion = (event) => {
    event.preventDefault();
    if (!detail?.tender?.tender_id || completionFiles.length === 0) return;

    runAction('complete', async () => {
      const formData = new FormData();
      formData.append('completion_note', completionNote);
      completionFiles.forEach((file) => formData.append('completion_images', file));
      await api.submitCompletionProof(detail.tender.tender_id, formData);
      setCompletionFiles([]);
      setCompletionNote('');
      toast.success('Completion proof submitted. Waiting for admin verification.');
    });
  };

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-3 text-sm font-bold uppercase tracking-[0.25em] text-text-tertiary">
        <Loader2 size={18} className="animate-spin text-secondary-500" />
        Loading assigned work
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header Section */}
      <div className="space-y-2">
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-tertiary">Vendor Execution Console</p>
        <h1 className="text-4xl font-black text-text-primary">Assigned Work</h1>
        <p className="text-sm text-text-secondary max-w-2xl">Execute assigned tasks with precision. Track progress, submit updates, and upload completion proof in real time.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        {/* Sidebar - Active Jobs List */}
        <aside className="space-y-4">
          <div className="rounded-2xl bg-surface-secondary/50 border border-border-primary p-4">
            <p className="text-xs font-bold uppercase tracking-wider text-text-tertiary mb-3">Active Assignments</p>
            {jobs.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border-primary p-8 text-center text-text-tertiary">
                <p className="text-sm font-medium">No assigned complaints</p>
              </div>
            ) : (
              <div className="space-y-3">
                {jobs.map((job) => (
                  <button
                    key={job.tender_id}
                    onClick={() => setSelectedComplaintId(job.complaint_id)}
                    className={`w-full rounded-2xl border p-4 text-left transition-all ${
                      selectedComplaintId === job.complaint_id
                        ? 'border-secondary-500 bg-secondary-500/15 shadow-lg scale-105'
                        : 'border-border-primary bg-surface-primary/70 hover:border-secondary-500/40 hover:bg-surface-tertiary'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className="font-bold text-text-primary text-sm">{job.category?.replace(/_/g, ' ')}</p>
                      <StatusBadge status={job.status} />
                    </div>
                    <p className="text-xs text-text-secondary line-clamp-2 mb-3">{job.description?.slice(0, 60)}</p>
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="text-text-tertiary">{job.citizen_name}</span>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary-500/20 text-secondary-400 font-bold">
                        {job.latest_progress || 0}%
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </aside>

        {/* Main Content Area */}
        {selectedJob && detail ? (
          <div className="space-y-8">
            {/* Primary Info Card - Complaint Overview */}
            <section className="glass-card overflow-hidden border border-border-primary">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                {/* Image Section */}
                <div className="min-h-[340px] bg-bg-secondary">
                  {detail.complaint?.image_url ? (
                    <img src={getAssetUrl(detail.complaint.image_url)} alt="Complaint evidence" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-tertiary">
                      <div className="text-center">
                        <div className="text-4xl mb-2">📸</div>
                        <p>No image available</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Info Section */}
                <div className="space-y-6 p-7 bg-surface-secondary/30">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border-primary pb-4">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Active Assignment</p>
                      <h2 className="mt-3 text-3xl font-black text-text-primary">{detail.complaint.category?.replace(/_/g, ' ')}</h2>
                    </div>
                    <StatusBadge status={detail.tender?.status} />
                  </div>

                  <p className="text-sm leading-relaxed text-text-secondary">{detail.complaint.description}</p>

                  {/* Key Metrics - More Prominent */}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl bg-gradient-to-br from-secondary-500/20 to-secondary-600/10 border border-secondary-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-secondary-400 mb-2">Progress</p>
                      <p className="text-3xl font-black text-secondary-400">{latestProgress || 0}%</p>
                      <div className="mt-3 h-2 rounded-full bg-bg-secondary overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${latestProgress || 0}%` }}
                          className="h-full bg-gradient-to-r from-secondary-500 to-secondary-400"
                        />
                      </div>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 border border-emerald-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-emerald-400 mb-2">Status</p>
                      <p className="text-lg font-black text-emerald-400 capitalize">{detail.tender?.status || 'pending'}</p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-cyan-400 mb-2">Citizen</p>
                      <p className="text-lg font-black text-cyan-400">{detail.complaint.citizen_name}</p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-amber-400 mb-2">Est. Cost</p>
                      <p className="text-lg font-black text-amber-400">₹{detail.tender?.estimated_cost || 'N/A'}</p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-violet-500/20 to-violet-600/10 border border-violet-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-violet-400 mb-2">Priority</p>
                      <p className={`text-lg font-black capitalize`}>
                        <span className={`priority-${detail.tender?.priority}`}>
                          {detail.tender?.priority || 'Normal'}
                        </span>
                      </p>
                    </div>

                    <div className="rounded-2xl bg-gradient-to-br from-pink-500/20 to-pink-600/10 border border-pink-500/30 p-4">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-pink-400 mb-2">Location</p>
                      <p className="text-xs font-bold text-pink-400">
                        {detail.complaint.latitude?.toFixed?.(3)}, {detail.complaint.longitude?.toFixed?.(3)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            {/* Work Status & Timeline Section */}
            <section className="grid gap-8 lg:grid-cols-2">
              <div className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Briefcase size={20} className="text-secondary-500" />
                  <h3 className="text-lg font-bold text-text-primary">Work Timeline</h3>
                </div>
                <div className="rounded-2xl border border-border-primary bg-surface-primary/70 p-5">
                  <StatusTimeline currentStatus={detail.complaint.status} />
                </div>
              </div>

              <div className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <MapPin size={20} className="text-secondary-500" />
                  <h3 className="text-lg font-bold text-text-primary">Latest Updates</h3>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-border-primary bg-surface-primary/70 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Last Progress</p>
                    <p className="text-sm font-medium text-text-primary">{detail.workUpdates?.[0]?.description || 'No updates yet'}</p>
                    <p className="text-xs text-text-tertiary mt-2">{formatDate(detail.workUpdates?.[0]?.created_at)}</p>
                  </div>
                  <div className="rounded-2xl border border-border-primary bg-surface-primary/70 p-4">
                    <p className="text-[9px] font-bold uppercase tracking-wider text-text-tertiary mb-2">Verification</p>
                    <p className="text-sm font-medium text-text-primary">{latestCompletionProof?.status || 'In progress'}</p>
                  </div>
                </div>
              </div>
            </section>

            {/* Before/After Comparison */}
            <section className="glass-card border border-border-primary p-7">
              <div className="mb-5 flex items-center gap-3">
                <Camera size={20} className="text-secondary-500" />
                <h3 className="text-lg font-bold text-text-primary">Work Evidence</h3>
              </div>
              {latestCompletionProof?.cover_image_url ? (
                <BeforeAfterSlider
                  beforeImage={getAssetUrl(detail.complaint.image_url)}
                  afterImage={getAssetUrl(latestCompletionProof.cover_image_url)}
                  beforeLabel="Before"
                  afterLabel="After"
                  height="340px"
                />
              ) : (
                <div className="rounded-2xl border-2 border-dashed border-border-primary p-12 text-center text-text-tertiary">
                  <p className="text-3xl mb-3">📷</p>
                  <p className="text-sm">Submit progress updates and completion proof to see before/after comparison</p>
                </div>
              )}
            </section>

            {/* Action Forms - Side by Side */}
            <section className="grid gap-8 lg:grid-cols-2">
              {/* Progress Update Form */}
              <form onSubmit={handleSubmitProgress} className="glass-card border border-secondary-500/30 p-7 bg-gradient-to-br from-secondary-500/5 to-transparent">
                <div className="mb-6 flex items-center gap-3">
                  <Send size={20} className="text-secondary-500" />
                  <h3 className="text-lg font-bold text-text-primary">Update Progress</h3>
                </div>

                {detail.tender?.status === 'assigned' && (
                  <button
                    type="button"
                    onClick={handleStartWork}
                    disabled={submitting === 'start'}
                    className="mb-6 w-full rounded-2xl bg-gradient-to-r from-secondary-600 to-secondary-500 px-4 py-4 text-sm font-bold text-white transition hover:shadow-lg hover:shadow-secondary-500/30 disabled:opacity-60 active:scale-95"
                  >
                    {submitting === 'start' ? 'Starting...' : '🚀 Start Work Now'}
                  </button>
                )}

                <div className="space-y-5">
                  <div>
                    <label className="mb-3 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Progress Percentage</span>
                      <span className="text-lg font-black text-secondary-500">{progressForm.progress}%</span>
                    </label>
                    <input
                      type="range"
                      min="10"
                      max="100"
                      step="10"
                      value={progressForm.progress}
                      onChange={(event) => setProgressForm((current) => ({ ...current, progress: Number(event.target.value) }))}
                      className="w-full accent-secondary-500"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Progress Notes <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      rows={4}
                      value={progressForm.description}
                      onChange={(event) => setProgressForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="What work has been completed? Any challenges?"
                      className="input-futuristic w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Progress Photo
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setProgressForm((current) => ({ ...current, image: event.target.files?.[0] || null }))}
                      className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-secondary-500/20 file:px-3 file:py-2 file:font-bold file:text-secondary-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting === 'progress' || !progressForm.description.trim()}
                    className="w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 hover:shadow-lg hover:shadow-secondary-500/30 disabled:opacity-60 active:scale-95"
                  >
                    {submitting === 'progress' ? '⏳ Submitting...' : '📤 Submit Progress'}
                  </button>
                </div>
              </form>

              {/* Completion Form */}
              <form onSubmit={handleSubmitCompletion} className="glass-card border border-emerald-500/30 p-7 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <div className="mb-6 flex items-center gap-3">
                  <CheckCircle2 size={20} className="text-emerald-500" />
                  <h3 className="text-lg font-bold text-text-primary">Mark as Completed</h3>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
                    <p className="font-medium">✓ Upload final work photos and completion notes before marking complete</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-xs font-bold uppercase tracking-wider text-text-tertiary">
                      Completion Notes
                    </label>
                    <textarea
                      rows={4}
                      value={completionNote}
                      onChange={(event) => setCompletionNote(event.target.value)}
                      placeholder="Describe completed work, materials used, quality assurance..."
                      className="input-futuristic w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-wider text-text-tertiary">Completion Photos</span>
                      {completionFiles.length > 0 && (
                        <span className="text-xs font-bold text-emerald-400 bg-emerald-500/20 px-2 py-1 rounded-full">
                          {completionFiles.length} selected
                        </span>
                      )}
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setCompletionFiles(Array.from(event.target.files || []))}
                      className="block w-full text-xs text-text-secondary file:mr-3 file:rounded-full file:border-0 file:bg-emerald-500/20 file:px-3 file:py-2 file:font-bold file:text-emerald-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting === 'complete' || completionFiles.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 hover:shadow-lg hover:shadow-emerald-500/30 disabled:opacity-60 active:scale-95"
                  >
                    {submitting === 'complete' ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <UploadCloud size={16} />
                        Complete & Verify
                      </>
                    )}
                  </button>
                </div>
              </form>
            </section>

            {/* Work Updates Timeline */}
            <section className="glass-card border border-border-primary p-7">
              <div className="mb-6 flex items-center gap-3">
                <MessageSquare size={20} className="text-secondary-500" />
                <h3 className="text-lg font-bold text-text-primary">Work History</h3>
              </div>

              {detail.workUpdates?.length ? (
                <div className="space-y-4">
                  {detail.workUpdates.map((update) => (
                    <div key={update.update_id} className="rounded-2xl border border-border-primary bg-surface-primary/70 p-5 hover:border-secondary-500/50 transition">
                      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="rounded-full border border-secondary-500/25 bg-secondary-500/10 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.22em] text-secondary-400">
                              {update.update_type || 'progress'}
                            </span>
                            <span className="rounded-full border border-border-primary px-3 py-1 text-xs font-semibold text-text-secondary">
                              {update.progress_percentage || 0}%
                            </span>
                          </div>
                          <p className="mt-3 text-sm font-bold text-text-primary">{update.description}</p>
                          <p className="mt-2 text-xs text-text-secondary">{formatDate(update.created_at)}</p>
                        </div>
                        {update.image_url ? (
                          <a href={getAssetUrl(update.image_url)} target="_blank" rel="noreferrer" className="overflow-hidden rounded-2xl border border-border-primary">
                            <img src={getAssetUrl(update.image_url)} alt="Timeline proof" className="h-24 w-28 object-cover" />
                          </a>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
                  No work updates yet. Submit the first progress update from the panel above.
                </div>
              )}
            </section>
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
            Select an assigned complaint to begin work.
          </div>
        )}
      </div>
    </div>
  );
}
