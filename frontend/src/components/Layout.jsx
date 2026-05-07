import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import { LayoutDashboard, FileText, MapPin, User, LogOut, Shield, AlertTriangle, Users, Briefcase, Trophy, ClipboardList } from 'lucide-react';
import NotificationBell from './NotificationBell';

const navItems = {
  citizen: [
    { to: '/citizen', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/citizen/new-complaint', icon: FileText, label: 'New Complaint' },
    { to: '/citizen/my-complaints', icon: ClipboardList, label: 'My Complaints' },
    { to: '/citizen/scoreboard', icon: Trophy, label: 'Scoreboard' },
  ],
  vendor: [
    { to: '/vendor', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/vendor/nearby', icon: MapPin, label: 'Nearby Tenders' },
    { to: '/vendor/my-jobs', icon: Briefcase, label: 'My Jobs' },
    { to: '/vendor/profile', icon: User, label: 'Profile' },
  ],
  admin: [
    { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
    { to: '/admin/complaints', icon: FileText, label: 'Complaints' },
    { to: '/admin/vendors', icon: Users, label: 'Vendors' },
    { to: '/admin/fraud', icon: AlertTriangle, label: 'Fraud Alerts' },
  ],
};

const roleLabels = { citizen: 'Citizen', vendor: 'Vendor', admin: 'Administrator' };
const roleColors = { citizen: 'from-blue-500 to-cyan-500', vendor: 'from-purple-500 to-pink-500', admin: 'from-amber-500 to-red-500' };

export default function Layout({ role, children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const items = navItems[role] || [];

  const handleLogout = () => { logout(); navigate('/login'); };

  return (
    <div className="min-h-screen flex bg-dark-950">
      {/* Sidebar */}
      <aside className="w-64 bg-dark-950 border-r border-white/10 flex flex-col fixed h-full z-10">
        <div className="p-5 border-b border-white/10 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold bg-gradient-to-r from-primary-400 to-accent-400 bg-clip-text text-transparent">
              🏛️ MicroTender
            </h1>
            <p className="text-xs text-gray-500 mt-1">Civic Issue Resolution</p>
          </div>
          <NotificationBell />
        </div>

        <div className="p-4">
          <div className={`bg-gradient-to-r ${roleColors[role]} rounded-xl p-3 text-white`}>
            <p className="text-sm font-semibold">{user?.name}</p>
            <p className="text-xs opacity-80">{roleLabels[role]} Portal</p>
          </div>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {items.map(item => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-all duration-200 ${
                  isActive ? 'bg-primary-600/20 text-primary-400 font-medium' : 'text-gray-400 hover:bg-white/5 hover:text-white'
                }`
              }>
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="p-4 border-t border-white/10">
          <button onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-gray-400 hover:bg-red-500/10 hover:text-red-400 transition-all w-full">
            <LogOut size={18} /> Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-6 min-h-screen">
        {children}
      </main>
    </div>
  );
}
