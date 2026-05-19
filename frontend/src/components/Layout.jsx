import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, FileText, MapPin, User, LogOut, Shield, AlertTriangle, Users, Briefcase, Trophy, ClipboardList, Menu, X, Bell } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { useState } from 'react';

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
const roleColors = {
  citizen: 'from-accent-cyan via-secondary-600 to-accent-pink',
  vendor: 'from-secondary-500 via-accent-purple to-accent-pink',
  admin: 'from-accent-pink via-secondary-600 to-accent-cyan'
};

export default function Layout({ role, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}>
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
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSidebarOpen(false)}
                  className="lg:hidden p-2 rounded-lg text-text-tertiary hover:text-accent-cyan hover:bg-gradient-secondary/20 hover:neon-glow-cyan transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>
          </div>

          {/* User Profile Card */}
          <div className="p-4 mb-2">
            <div className={`bg-gradient-to-br ${roleColors[role]} rounded-3xl p-5 text-white shadow-lg relative overflow-hidden group`}>
              <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              <div className="relative z-10">
                <p className="text-sm font-bold tracking-tight">{user?.name}</p>
                <p className="text-[10px] font-extrabold uppercase tracking-widest opacity-70 mt-0.5">{roleLabels[role]} Portal</p>
                <div className="mt-4 w-full bg-white/20 rounded-full h-1.5 overflow-hidden">
                  <div className="bg-white h-full rounded-full w-3/4 animate-pulse"></div>
                </div>
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
                    {isActive && (
                      <div className="ml-auto w-1.5 h-1.5 bg-white rounded-full"></div>
                    )}
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
              className="flex items-center gap-4 px-4 py-3 rounded-xl text-sm font-medium text-text-secondary dark:text-white hover:bg-gradient-secondary/20 hover:text-accent-pink hover:neon-glow-pink transition-all w-full group">
              <LogOut size={20} className="group-hover:rotate-12 transition-transform" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 min-h-screen relative flex flex-col bg-bg-primary dark:bg-bg-primary transition-colors duration-500">
        {/* Top Menubar (Global Desktop + Mobile Integration) */}
        <header className="sticky top-0 z-30 glass-strong border-b border-border-primary w-full px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 rounded-lg text-text-secondary hover:text-accent-cyan hover:bg-gradient-secondary/20 transition-all border border-border-primary/40"
            >
              <Menu size={20} />
            </button>
            
            <div className="hidden lg:flex items-center gap-2.5">
              <span className={`w-2.5 h-2.5 rounded-full bg-gradient-to-r ${roleColors[role]} shadow-md`} />
              <span className="text-xs font-extrabold uppercase tracking-widest text-text-tertiary">{roleLabels[role]} Portal</span>
            </div>
            
            <h1 className="lg:hidden text-lg font-bold bg-gradient-to-r from-accent-pink to-accent-cyan bg-clip-text text-transparent">
              MicroTender
            </h1>
          </div>

          <div className="flex items-center gap-4">
            {/* Quick Profile Summary inside Menubar */}
            <div className="hidden md:flex items-center gap-3">
              <div className="text-right">
                <p className="text-xs font-bold text-text-primary leading-none">{user?.name}</p>
                <p className="text-[9px] font-bold text-text-tertiary uppercase tracking-wider mt-1">{roleLabels[role]}</p>
              </div>
              <div className={`w-8 h-8 rounded-full bg-gradient-to-r ${roleColors[role]} flex items-center justify-center text-white text-xs font-extrabold border border-white/10 shadow-sm uppercase`}>
                {user?.name?.[0]}
              </div>
            </div>
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-6 lg:p-8 overflow-y-auto">
          {children}
        </div>
      </main>
    </div>
  );
}

