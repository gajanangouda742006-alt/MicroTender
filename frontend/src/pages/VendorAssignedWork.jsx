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
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-text-tertiary">Vendor Execution Console</p>
        <h1 className="mt-2 text-3xl font-black text-text-primary">Assigned Work</h1>
        <p className="mt-2 text-sm text-text-secondary">Start work, push progress updates, upload proof, and track admin verification in real time.</p>
      </div>

      <div className="grid gap-8 xl:grid-cols-[340px_minmax(0,1fr)]">
        <aside className="space-y-4">
          {jobs.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
              No assigned complaints right now.
            </div>
          ) : jobs.map((job) => (
            <button
              key={job.tender_id}
              onClick={() => setSelectedComplaintId(job.complaint_id)}
              className={`w-full rounded-3xl border p-5 text-left transition ${
                selectedComplaintId === job.complaint_id
                  ? 'border-secondary-500/40 bg-secondary-500/10 shadow-soft'
                  : 'border-border-primary bg-surface-primary/70 hover:border-secondary-500/25'
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-black text-text-primary">{job.category?.replace(/_/g, ' ')}</p>
                  <p className="mt-2 text-sm text-text-secondary">{job.description?.slice(0, 80)}{job.description?.length > 80 ? '...' : ''}</p>
                </div>
                <StatusBadge status={job.status} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-text-tertiary">
                <span className="rounded-full border border-border-primary px-3 py-1">Citizen: {job.citizen_name}</span>
                <span className="rounded-full border border-border-primary px-3 py-1">{job.latest_progress || 0}% progress</span>
              </div>
            </button>
          ))}
        </aside>

        {selectedJob && detail ? (
          <div className="space-y-8">
            <section className="glass-card overflow-hidden border border-border-primary">
              <div className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
                <div className="min-h-[320px] bg-bg-secondary">
                  {detail.complaint?.image_url ? (
                    <img src={getAssetUrl(detail.complaint.image_url)} alt="Complaint evidence" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-text-tertiary">No complaint image</div>
                  )}
                </div>
                <div className="space-y-6 p-7">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Active Assignment</p>
                      <h2 className="mt-2 text-2xl font-black text-text-primary">{detail.complaint.category?.replace(/_/g, ' ')}</h2>
                    </div>
                    <StatusBadge status={detail.tender?.status} />
                  </div>

                  <p className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5 text-sm leading-7 text-text-secondary">
                    {detail.complaint.description}
                  </p>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Latest Progress</p>
                      <p className="mt-3 text-3xl font-black text-text-primary">{latestProgress || 0}%</p>
                    </div>
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Citizen</p>
                      <p className="mt-3 text-lg font-black text-text-primary">{detail.complaint.citizen_name}</p>
                    </div>
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Location</p>
                      <p className="mt-3 text-sm font-bold text-text-primary">
                        {detail.complaint.latitude?.toFixed?.(5) || 'NA'}, {detail.complaint.longitude?.toFixed?.(5) || 'NA'}
                      </p>
                    </div>
                    <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                      <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Verification Status</p>
                      <p className="mt-3 text-sm font-bold text-text-primary">{latestCompletionProof?.status || detail.tender?.verification_status || 'In progress'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section className="grid gap-8 lg:grid-cols-2">
              <div className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Briefcase size={18} className="text-secondary-500" />
                  <h3 className="text-lg font-black text-text-primary">Work Timeline</h3>
                </div>
                <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-6">
                  <StatusTimeline currentStatus={detail.complaint.status} />
                </div>
                <div className="mt-5 overflow-hidden rounded-full bg-bg-secondary">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${latestProgress || 0}%` }}
                    className="h-3 rounded-full bg-gradient-to-r from-secondary-500 via-cyan-400 to-emerald-400"
                  />
                </div>
              </div>

              <div className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <MapPin size={18} className="text-secondary-500" />
                  <h3 className="text-lg font-black text-text-primary">Execution Snapshot</h3>
                </div>
                <div className="space-y-4">
                  <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Last update</p>
                    <p className="mt-3 text-sm font-bold text-text-primary">{detail.workUpdates?.[0]?.description || 'No updates submitted yet.'}</p>
                    <p className="mt-2 text-xs text-text-secondary">{formatDate(detail.workUpdates?.[0]?.created_at)}</p>
                  </div>
                  <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
                    <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-text-tertiary">Admin review notes</p>
                    <p className="mt-3 text-sm text-text-secondary">{latestCompletionProof?.review_notes || selectedJob.completion_review_notes || 'No review notes yet.'}</p>
                  </div>
                </div>
              </div>
            </section>

            <section className="glass-card border border-border-primary p-7">
              <div className="mb-5 flex items-center gap-3">
                <Camera size={18} className="text-secondary-500" />
                <h3 className="text-lg font-black text-text-primary">Before and After Proof</h3>
              </div>
              {latestCompletionProof?.cover_image_url ? (
                <BeforeAfterSlider
                  beforeImage={getAssetUrl(detail.complaint.image_url)}
                  afterImage={getAssetUrl(latestCompletionProof.cover_image_url)}
                  beforeLabel="Before"
                  afterLabel="Latest After"
                  height="340px"
                />
              ) : (
                <div className="rounded-3xl border border-dashed border-border-primary p-10 text-center text-text-tertiary">
                  Upload progress or completion proof to populate the after-work comparison view.
                </div>
              )}
            </section>

            <section className="grid gap-8 lg:grid-cols-2">
              <form onSubmit={handleSubmitProgress} className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <Send size={18} className="text-secondary-500" />
                  <h3 className="text-lg font-black text-text-primary">Update Progress</h3>
                </div>

                {detail.tender?.status === 'assigned' ? (
                  <button
                    type="button"
                    onClick={handleStartWork}
                    disabled={submitting === 'start'}
                    className="mb-5 w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:opacity-60"
                  >
                    {submitting === 'start' ? 'Starting...' : 'Start Work'}
                  </button>
                ) : null}

                <div className="space-y-5">
                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      Progress Percentage
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
                    <p className="mt-2 text-sm font-bold text-text-primary">{progressForm.progress}%</p>
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      Progress Notes
                    </label>
                    <textarea
                      rows={4}
                      value={progressForm.description}
                      onChange={(event) => setProgressForm((current) => ({ ...current, description: event.target.value }))}
                      placeholder="Describe what has been completed on site..."
                      className="input-futuristic w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      Progress Image
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(event) => setProgressForm((current) => ({ ...current, image: event.target.files?.[0] || null }))}
                      className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-secondary-500/15 file:px-4 file:py-2 file:font-bold file:text-secondary-400"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={submitting === 'progress' || !progressForm.description.trim()}
                    className="w-full rounded-2xl bg-secondary-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-secondary-500 disabled:opacity-60"
                  >
                    {submitting === 'progress' ? 'Submitting...' : 'Submit Progress Update'}
                  </button>
                </div>
              </form>

              <form onSubmit={handleSubmitCompletion} className="glass-card border border-border-primary p-7">
                <div className="mb-5 flex items-center gap-3">
                  <CheckCircle2 size={18} className="text-secondary-500" />
                  <h3 className="text-lg font-black text-text-primary">Completion Proof</h3>
                </div>

                <div className="space-y-5">
                  <div className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5 text-sm text-text-secondary">
                    Upload completed work photos, before/after evidence, and final notes. Then use the final action below to mark the work completed.
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      Completion Notes
                    </label>
                    <textarea
                      rows={4}
                      value={completionNote}
                      onChange={(event) => setCompletionNote(event.target.value)}
                      placeholder="Summarize the final work, materials used, and completion condition..."
                      className="input-futuristic w-full"
                    />
                  </div>

                  <div>
                    <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.22em] text-text-tertiary">
                      Completion Photos
                    </label>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(event) => setCompletionFiles(Array.from(event.target.files || []))}
                      className="block w-full text-sm text-text-secondary file:mr-4 file:rounded-full file:border-0 file:bg-emerald-500/15 file:px-4 file:py-2 file:font-bold file:text-emerald-400"
                    />
                    {completionFiles.length ? (
                      <p className="mt-2 text-xs text-text-secondary">{completionFiles.length} file(s) selected</p>
                    ) : null}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting === 'complete' || completionFiles.length === 0}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white transition hover:bg-emerald-500 disabled:opacity-60"
                  >
                    {submitting === 'complete' ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                    Mark Work Completed
                  </button>
                </div>
              </form>
            </section>

            <section className="glass-card border border-border-primary p-7">
              <div className="mb-6 flex items-center gap-3">
                <MessageSquare size={18} className="text-secondary-500" />
                <h3 className="text-lg font-black text-text-primary">Work Updates Timeline</h3>
              </div>

              {detail.workUpdates?.length ? (
                <div className="space-y-4">
                  {detail.workUpdates.map((update) => (
                    <div key={update.update_id} className="rounded-3xl border border-border-primary bg-surface-primary/70 p-5">
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
