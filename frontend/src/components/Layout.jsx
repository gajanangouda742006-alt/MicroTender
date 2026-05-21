import { NavLink, useNavigate } from 'react-router-dom';
import logo from '../assets/logo.png';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, FileText, MapPin, User, LogOut, Shield, AlertTriangle, Users, Briefcase, Trophy, ClipboardList, Menu, X, Bell, Sparkles, Mail, Phone, Calendar, Star, ChevronRight, CheckCircle } from 'lucide-react';
import NotificationBell from './NotificationBell';
import ThemeToggle from './ThemeToggle';
import { useState, useEffect } from 'react';
import AIAssistantSidebar from './AIAssistantSidebar';

const navItems = {
  citizen: [
    { to: '/citizen', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/citizen/new-complaint', icon: FileText, label: 'New Complaint' },
    { to: '/citizen/my-complaints', icon: ClipboardList, label: 'My Complaints' },
    { to: '/citizen/completed-complaints', icon: CheckCircle, label: 'Completed' },
    { to: '/citizen/scoreboard', icon: Trophy, label: 'Scoreboard' },
    { to: '/citizen/notifications', icon: Bell, label: 'Notifications' },
    { to: '/citizen/profile', icon: User, label: 'Profile' },
  ],
  vendor: [
    { to: '/vendor', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/vendor/nearby', icon: MapPin, label: 'Nearby Tenders' },
    { to: '/vendor/my-jobs', icon: Briefcase, label: 'My Jobs' },
    { to: '/vendor/assigned-work', icon: ClipboardList, label: 'Assigned Work' },
    { to: '/vendor/reviews', icon: Star, label: 'Customer Reviews' },
    { to: '/vendor/notifications', icon: Bell, label: 'Notifications' },
    { to: '/vendor/profile', icon: User, label: 'Profile' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/complaints', icon: FileText, label: 'Complaints' },
    { to: '/admin/vendors', icon: Users, label: 'Vendors' },
    { to: '/admin/fraud', icon: AlertTriangle, label: 'Fraud Alerts' },
    { to: '/admin/verifications', icon: Shield, label: 'Verifications' },
    { to: '/admin/notifications', icon: Bell, label: 'Notifications' },
    { to: '/admin/profile', icon: User, label: 'Profile' },
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

export default function Layout({ role, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [aiSidebarOpen, setAiSidebarOpen] = useState(false);
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

          {/* Navigation */}
          <nav className="flex-1 px-4 space-y-1.5">
            {items.map(item => (
              <NavLink key={item.to} to={item.to} end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold transition-all duration-300 group ${isActive
                    ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white shadow-lg shadow-indigo-600/30'
                    : 'text-text-secondary dark:text-white border border-transparent hover:border-accent-purple/30 hover:text-accent-purple hover:bg-white/5 dark:hover:bg-white/10'
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
