// src/pages/AssignedComplaints.jsx
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../api';
import toast from 'react-hot-toast';
import { CalendarClock, Users2, CheckCircle } from 'lucide-react';

export default function AssignedComplaints() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    api
      .getComplaints()
      .then((data) => {
        const assigned = data.complaints.filter((c) => c.assigned_vendor_id);
        setComplaints(assigned);
      })
      .catch((e) => toast.error(e.message || 'Failed to load complaints'))
      .finally(() => setLoading(false));
  }, []);

  if (loading)
    return (
      <div className="p-20 text-center text-text-secondary animate-pulse">Loading assigned complaints...</div>
    );

  if (complaints.length === 0)
    return (
      <div className="p-10 text-center text-text-tertiary">No assigned complaints found.</div>
    );

  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {complaints.map((c) => (
        <div
          key={c.id}
          className="glass-card p-5 cursor-pointer hover:shadow-glass transition-shadow"
          onClick={() => navigate(`/admin/complaint/${c.id}`)}
        >
          <div className="flex items-center gap-3 mb-2">
            <CalendarClock size={18} className="text-secondary-500" />
            <h3 className="text-lg font-bold text-text-primary">{c.title || 'Untitled Complaint'}</h3>
          </div>
          <p className="text-sm text-text-secondary mb-2">Status: {c.status}</p>
          <p className="text-sm text-text-secondary mb-2">
            Vendor: {c.assigned_vendor_name || c.assigned_vendor_id}
          </p>
          <div className="flex items-center gap-2 text-xs text-text-tertiary">
            <CheckCircle size={14} className="text-green-500" />
            <span>Progress: {c.latest_progress_percentage || 0}%</span>
          </div>
        </div>
      ))}
    </div>
  );
}
