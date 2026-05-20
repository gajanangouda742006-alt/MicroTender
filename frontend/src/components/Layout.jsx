import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, FileText, MapPin, User, LogOut, Shield, AlertTriangle, Users, Briefcase, Trophy, ClipboardList, Menu, X, Bell, Sparkles, Mail, Phone, Calendar, Star, ChevronRight } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { useState, useEffect, useRef } from 'react';
import AIAssistantSidebar from './AIAssistantSidebar';
import { motion, AnimatePresence } from 'framer-motion';

const navItems = {
  citizen: [
    { to: '/citizen', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/citizen/new-complaint', icon: FileText, label: 'New Complaint' },
    { to: '/citizen/my-complaints', icon: ClipboardList, label: 'My Complaints' },
    { to: '/citizen/scoreboard', icon: Trophy, label: 'Scoreboard' },
    { to: '/citizen/notifications', icon: Bell, label: 'Notifications' },
  ],
  vendor: [
    { to: '/vendor', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/vendor/nearby', icon: MapPin, label: 'Nearby Tenders' },
    { to: '/vendor/my-jobs', icon: Briefcase, label: 'My Jobs' },
    { to: '/vendor/profile', icon: User, label: 'Profile' },
    { to: '/vendor/notifications', icon: Bell, label: 'Notifications' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/complaints', icon: FileText, label: 'Complaints' },
    { to: '/admin/vendors', icon: Users, label: 'Vendors' },
    { to: '/admin/fraud', icon: AlertTriangle, label: 'Fraud Alerts' },
    { to: '/admin/verifications', icon: Shield, label: 'Verifications' },
    { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
  ],
};

const roleLabels = { citizen: 'Citizen', vendor: 'Vendor', admin: 'Administrator' };
const rolePortalLabels = { citizen: 'USER PORTAL', vendor: 'VENDOR PORTAL', admin: 'ADMIN PORTAL' };
const roleColors = {
  citizen: 'from-accent-cyan via-secondary-600 to-accent-pink',
  vendor: 'from-secondary-500 via-accent-purple to-accent-pink',
  admin: 'from-accent-pink via-secondary-600 to-accent-cyan',
};
const roleBadgeColors = {
  citizen: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  vendor: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  admin: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
};

function ProfileDropdown({ user, role, onClose, onLogout }) {
  const navigate = useNavigate();
  const ref = useRef(null);

  useEffect(() => {
    const handleClick = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [onClose]);

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    : 'N/A';

  const profileLink = role === 'vendor' ? '/vendor/profile' : role === 'citizen' ? '/citizen' : '/admin';

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.92, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.92, y: -10 }}
      transition={{ duration: 0.18, ease: 'easeOut' }}
      className="absolute right-0 top-[calc(100%+12px)] w-80 z-50"
    >
      {/* Arrow */}
      <div className="absolute -top-2 right-5 w-4 h-4 bg-bg-secondary border-t border-l border-border-primary rotate-45 z-10" />

      <div className="glass-strong rounded-2xl border border-border-primary shadow-2xl overflow-hidden relative">
        {/* Header band */}
        <div className={`bg-gradient-to-r ${roleColors[role]} p-5 relative overflow-hidden`}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center text-2xl font-black text-white border border-white/30 shadow-lg uppercase">
              {user?.name?.[0]}
            </div>
            <div>
              <p className="text-white font-extrabold text-base leading-tight">{user?.name}</p>
              <span className={`mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/20 text-white border border-white/20`}>
                {roleLabels[role]}
              </span>
            </div>
          </div>
        </div>

        {/* Details */}
        <div className="p-4 space-y-2.5">
          {user?.email && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-tertiary/50">
              <Mail size={14} className="text-text-tertiary shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Email</p>
                <p className="text-sm font-semibold text-text-primary truncate">{user.email}</p>
              </div>
            </div>
          )}

          {user?.phone && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-tertiary/50">
              <Phone size={14} className="text-text-tertiary shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Phone</p>
                <p className="text-sm font-semibold text-text-primary">{user.phone}</p>
              </div>
            </div>
          )}

          {user?.govt_id_type && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-bg-tertiary/50">
              <Shield size={14} className="text-text-tertiary shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">{user.govt_id_type.toUpperCase()}</p>
                <p className="text-sm font-semibold text-text-primary">{user.govt_id_number}</p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-bg-tertiary/50">
              <Star size={13} className="text-amber-400 shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Reputation</p>
                <p className="text-sm font-bold text-amber-400">{user?.reputation_score ?? 100}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-bg-tertiary/50">
              <Calendar size={13} className="text-text-tertiary shrink-0" />
              <div>
                <p className="text-[10px] font-bold text-text-tertiary uppercase tracking-wider">Member</p>
                <p className="text-sm font-bold text-text-primary">{memberSince}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 pt-0 space-y-1.5 border-t border-border-primary">
          {role === 'vendor' && (
            <button
              onClick={() => { navigate('/vendor/profile'); onClose(); }}
              className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold text-text-secondary hover:bg-bg-tertiary hover:text-text-primary transition-all group"
            >
              <span className="flex items-center gap-2.5"><User size={15} /> Edit Vendor Profile</span>
              <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
            </button>
          )}
          <button
            onClick={() => { onLogout(); onClose(); }}
            className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-400 transition-all group"
          >
            <span className="flex items-center gap-2.5"><LogOut size={15} /> Sign Out</span>
            <ChevronRight size={14} className="opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>
      </div>
    </motion.div>
  );
}

export default function Layout({ role, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const items = navItems[role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex bg-bg-primary transition-colors duration-500">
      {/* Mobile Sidebar Overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="glass-strong h-full flex flex-col border-r border-border-primary">
          {/* Header */}
          <div className="p-6 border-b border-border-primary">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="flex items-center gap-3 text-2xl font-bold bg-gradient-to-r from-accent-pink to-accent-cyan bg-clip-text text-transparent animate-gradient">
                  <img src={logo} alt="MT" className="w-10 h-10 object-contain rounded-lg shadow-2xl" />
                  <span>MicroTender</span>
                </h1>
                <p className="text-sm text-text-tertiary mt-1">Civic Issue Resolution</p>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 rounded-lg text-text-tertiary hover:text-accent-cyan hover:bg-gradient-secondary/20 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* User Profile Card in Sidebar */}
          <div className="p-4 mb-2">
            <div className={`bg-gradient-to-br ${roleColors[role]} rounded-3xl p-5 text-white shadow-lg relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center font-black text-lg uppercase border border-white/30">
                  {user?.name?.[0]}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-extrabold leading-tight truncate">{user?.name}</p>
                  <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 mt-0.5">{roleLabels[role]} Portal</p>
                </div>
              </div>
              <div className="mt-4 w-full bg-white/20 rounded-full h-1 overflow-hidden">
                <div className="bg-white h-full rounded-full w-3/4 animate-pulse" />
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1.5">
            {items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group ${isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-slate-600 dark:text-white hover:bg-slate-100 dark:hover:bg-white/10 hover:text-indigo-600 dark:hover:text-white'
                  }`
                }
                onClick={() => setSidebarOpen(false)}
              >
                {({ isActive }) => (
                  <>
                    <item.icon size={20} className={`transition-transform duration-300 ${isActive ? '' : 'group-hover:scale-110'}`} />
                    <span className="tracking-tight">{item.label}</span>
                    {isActive && <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full" />}
                  </>
                )}
              </NavLink>
            ))}
          </nav>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* Logout */}
          <div className="p-4 border-t border-border-primary">
            <button onClick={handleLogout}
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary dark:text-white hover:bg-gradient-secondary/20 hover:text-accent-pink transition-all w-full group">
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen relative flex flex-col bg-bg-primary dark:bg-bg-primary transition-colors duration-500">
        {/* Floating Top Header */}
        <header className="absolute top-0 right-0 z-30 w-full px-6 py-4 flex items-center justify-between pointer-events-none">
          <div className="flex items-center gap-4 pointer-events-auto">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-gradient-secondary/20 transition-all border border-border-primary/40 bg-bg-primary/50 backdrop-blur-md"
            >
              <Menu size={20} />
            </button>
          </div>

          <div className="flex items-center gap-3 pointer-events-auto">
            {/* AI Assistant button */}
            <button
              onClick={() => setAiSidebarOpen(true)}
              className="p-2 text-text-secondary hover:text-accent-pink hover:bg-accent-pink/10 rounded-lg transition-colors border border-transparent hover:border-accent-pink/30 relative bg-bg-primary/50 backdrop-blur-md"
              title="AI Assistant"
            >
              <div className="absolute top-1 right-1 w-2 h-2 bg-accent-pink rounded-full animate-ping" />
              <div className="absolute top-1 right-1 w-2 h-2 bg-accent-pink rounded-full" />
              <Sparkles size={18} />
            </button>

            {/* Profile Avatar — clickable */}
            <div className="relative">
              <button
                onClick={() => setProfileOpen(prev => !prev)}
                className="flex items-center gap-2.5 group bg-bg-primary/50 backdrop-blur-md p-1.5 pr-4 rounded-full border border-border-primary/30 hover:border-border-primary/60 transition-all shadow-soft"
                aria-label="Open profile"
              >
                <div className="hidden sm:block text-right">
                  <p className="text-xs font-bold text-text-primary leading-none">{user?.name}</p>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full border ${roleBadgeColors[role]}`}>
                    {roleLabels[role]}
                  </span>
                </div>
                <div className={`w-9 h-9 rounded-full bg-gradient-to-br ${roleColors[role]} flex items-center justify-center text-white text-sm font-black border-2 border-white/20 shadow-md group-hover:scale-105 group-hover:shadow-lg transition-all uppercase`}>
                  {user?.name?.[0]}
                </div>
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <ProfileDropdown
                    user={user}
                    role={role}
                    onClose={() => setProfileOpen(false)}
                    onLogout={handleLogout}
                  />
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>

      {/* AI Assistant Sidebar */}
      <AIAssistantSidebar isOpen={aiSidebarOpen} onClose={() => setAiSidebarOpen(false)} />
    </div>
  );
}
