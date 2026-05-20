import { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import api from '../api';
import { Save, User, Mail, Phone, Shield } from 'lucide-react';

export default function Profile() {
  const { user, updateUser } = useAuth();
  const [form, setForm] = useState({ name: '', phone: '', govt_id_type: '', govt_id_number: '' });
  const [status, setStatus] = useState({ saving: false, message: '', error: '' });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || '',
        govt_id_type: user.govt_id_type || '',
        govt_id_number: user.govt_id_number || '',
      });
    }
  }, [user]);

  const handleChange = (key) => (event) => {
    setForm((prev) => ({ ...prev, [key]: event.target.value }));
  };

  const handleSave = async () => {
    setStatus({ saving: true, message: '', error: '' });
    try {
      const data = await api.updateProfile(form);
      updateUser(data.user);
      setStatus({ saving: false, message: 'Profile updated successfully.', error: '' });
    } catch (err) {
      setStatus({ saving: false, message: '', error: err.message || 'Unable to save profile.' });
    }
  };

  if (!user) {
    return (
      <div className="p-8">
        <div className="rounded-[28px] border border-border-primary bg-white p-10 text-center shadow-lg dark:bg-bg-secondary">
          <p className="text-slate-600 dark:text-text-secondary">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="max-w-4xl mx-auto rounded-[32px] border border-border-primary bg-white text-slate-900 p-8 shadow-xl dark:bg-bg-secondary dark:text-white">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-slate-500 dark:text-text-tertiary">Profile</p>
            <h1 className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">Your account details</h1>
            <p className="mt-3 text-sm text-slate-600 dark:text-text-secondary max-w-2xl">
              Keep your contact and ID information up to date so MicroTender can match requests accurately.
            </p>
          </div>
          <button
            onClick={handleSave}
            disabled={status.saving}
            className="inline-flex items-center gap-2 rounded-full bg-accent-cyan px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {status.saving ? 'Saving...' : 'Save changes'}
          </button>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-6">
            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-border-primary dark:bg-bg-primary">
              <div className="flex items-center gap-3 text-slate-700 dark:text-text-secondary">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-200 text-slate-900 dark:bg-white/10 dark:text-white">
                  <User size={20} />
                </div>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Full name</p>
                  <input
                    className="mt-2 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-accent-cyan dark:border-border-primary dark:bg-bg-secondary dark:text-white"
                    type="text"
                    value={form.name}
                    onChange={handleChange('name')}
                    placeholder="Your name"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-border-primary dark:bg-bg-primary">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-text-secondary">
                    <Mail size={16} />
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Email</p>
                  </div>
                  <p className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 dark:border-border-primary dark:bg-bg-secondary dark:text-white">{user.email}</p>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-text-secondary">
                    <Phone size={16} />
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Phone</p>
                  </div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-accent-cyan dark:border-border-primary dark:bg-bg-secondary dark:text-white"
                    type="text"
                    value={form.phone}
                    onChange={handleChange('phone')}
                    placeholder="Mobile number"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-border-primary dark:bg-bg-primary">
              <div className="grid gap-6 sm:grid-cols-2">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-text-secondary">
                    <Shield size={16} />
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Govt ID type</p>
                  </div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-accent-cyan dark:border-border-primary dark:bg-bg-secondary dark:text-white"
                    type="text"
                    value={form.govt_id_type}
                    onChange={handleChange('govt_id_type')}
                    placeholder="Aadhaar, PAN, etc."
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-slate-700 dark:text-text-secondary">
                    <Shield size={16} />
                    <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Govt ID number</p>
                  </div>
                  <input
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-accent-cyan dark:border-border-primary dark:bg-bg-secondary dark:text-white"
                    type="text"
                    value={form.govt_id_number}
                    onChange={handleChange('govt_id_number')}
                    placeholder="Enter government ID number"
                  />
                </div>
              </div>
            </div>
          </div>

          <aside className="rounded-3xl border border-slate-200 bg-slate-50 p-6 shadow-sm dark:border-border-primary dark:bg-bg-primary">
            <div className="space-y-4">
              <div className="rounded-3xl bg-gradient-to-r from-accent-cyan via-secondary-600 to-accent-pink p-4 text-white shadow-lg">
                <p className="text-sm uppercase tracking-[0.35em] opacity-80">Account status</p>
                <p className="mt-2 text-2xl font-semibold">{user.is_active ? 'Active' : 'Inactive'}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-border-primary dark:bg-bg-secondary">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Role</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{user.role}</p>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-white p-4 dark:border-border-primary dark:bg-bg-secondary">
                <p className="text-xs uppercase tracking-[0.35em] text-slate-500 dark:text-text-tertiary">Member since</p>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">
                  {user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }) : 'Unknown'}
                </p>
              </div>
            </div>
          </aside>
        </div>

        {status.message && <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-200">{status.message}</div>}
        {status.error && <div className="mt-6 rounded-2xl border border-rose-500/20 bg-rose-500/10 p-4 text-sm text-rose-200">{status.error}</div>}
      </div>
    </div>
  );
}
