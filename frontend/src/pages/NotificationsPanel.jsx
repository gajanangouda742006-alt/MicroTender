import { useState, useEffect } from 'react';
import { useNotifications } from '../NotificationContext';
import { Bell, BellOff, AlertTriangle, Shield, Check, Info, CheckCircle, AlertCircle, Volume2, VolumeX, Zap, Mail } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function NotificationsPanel() {
  const { notifications, unreadCount, markAsRead, openNotification } = useNotifications();
  const [activeTab, setActiveTab] = useState('All');
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('mt_sound_enabled') !== 'false';
  });

  // Keep sound toggle state persistent
  useEffect(() => {
    localStorage.setItem('mt_sound_enabled', soundEnabled ? 'true' : 'false');
  }, [soundEnabled]);

  // Synthesize a beautiful digital chime on notification arrival or manual click test
  const playSynthesizedChime = () => {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      // Dynamic bell-like synthesis
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(1174.66, ctx.currentTime); // D6
      osc2.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.15);
      
      gainNode.gain.setValueAtTime(0.12, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.8);
      
      osc1.start();
      osc2.start();
      osc1.stop(ctx.currentTime + 0.8);
      osc2.stop(ctx.currentTime + 0.8);
    } catch (e) {
      console.warn('Audio autoplay restrictions prevented sound playing.');
    }
  };

  // Play sound test if enabled
  const toggleSound = () => {
    const nextVal = !soundEnabled;
    setSoundEnabled(nextVal);
    if (nextVal) {
      playSynthesizedChime();
    }
  };

  // Dynamic statistics
  const stats = {
    total: notifications.length,
    unread: unreadCount,
    alerts: notifications.filter(n => n.type === 'warning' || n.type === 'error').length,
    fraud: notifications.filter(n => n.type === 'fraud' || n.type === 'suspicious' || n.type === 'anti_fraud').length,
  };

  // Helper for premium filter navigation icons
  const getFilterIcon = (label, isActive) => {
    const colorClass = isActive ? 'text-white' : 'text-slate-400 group-hover:text-white transition-colors';
    switch (label) {
      case 'Unread':
        return <BellOff size={14} className={colorClass} />;
      case 'Success':
        return <CheckCircle size={14} className={colorClass} />;
      case 'Alerts':
        return <AlertTriangle size={14} className={colorClass} />;
      case 'Fraud':
        return <Shield size={14} className={colorClass} />;
      case 'Info':
        return <Info size={14} className={colorClass} />;
      default:
        return <Mail size={14} className={colorClass} />;
    }
  };

  // Category tags mapping
  const filterNotifications = () => {
    switch (activeTab) {
      case 'Unread':
        return notifications.filter(n => !n.is_read);
      case 'Success':
        return notifications.filter(n => n.type === 'success');
      case 'Alerts':
        return notifications.filter(n => n.type === 'warning' || n.type === 'error');
      case 'Fraud':
        return notifications.filter(n => n.type === 'fraud' || n.type === 'suspicious' || n.type === 'anti_fraud');
      case 'Info':
        return notifications.filter(n => n.type === 'info' || !n.type);
      default:
        return notifications;
    }
  };

  const filteredList = filterNotifications();

  // Play audio synthesizers when new notifications are received (via Socket context)
  useEffect(() => {
    if (soundEnabled && notifications.length > 0) {
      const latest = notifications[0];
      const ageMs = Date.now() - new Date(latest.created_at).getTime();
      if (ageMs < 2000) {
        playSynthesizedChime();
      }
    }
  }, [notifications.length]);

  return (
    <div className="animate-fade-in space-y-8 max-w-5xl mx-auto px-4 sm:px-6">
      
      {/* 1. Header Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.4)] animate-pulse">
              <Bell size={32} fill="currentColor" />
            </span>
            <span className="bg-gradient-to-r from-cyan-400 via-indigo-400 to-pink-400 bg-clip-text text-transparent">
              Notifications
            </span>
          </h1>
          <p className="text-slate-400 text-sm font-medium">
            {unreadCount === 0 ? "You're all caught up!" : `You have ${unreadCount} unread system notifications`}
          </p>
        </div>
        
        {/* Premium Sound Toggle Button */}
        <button
          onClick={toggleSound}
          className="self-start sm:self-center px-4 py-2 bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 rounded-full text-xs font-bold text-slate-300 hover:text-white flex items-center gap-2 transition-all shadow-md active:scale-95"
        >
          {soundEnabled ? (
            <>
              <Volume2 size={14} className="text-cyan-400" />
              <span>Sound On</span>
            </>
          ) : (
            <>
              <VolumeX size={14} className="text-slate-500" />
              <span>Sound Off</span>
            </>
          )}
        </button>
      </div>

      {/* 2. Stats Grid (4 beautiful glassmorphic stat cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total */}
        <div className="glass border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-400 flex items-center justify-center shadow-inner">
            <Bell size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white leading-none">{stats.total}</p>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1.5">Total</p>
          </div>
        </div>

        {/* Card 2: Unread */}
        <div className="glass border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400 flex items-center justify-center shadow-inner">
            <BellOff size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white leading-none">{stats.unread}</p>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1.5">Unread</p>
          </div>
        </div>

        {/* Card 3: Alerts */}
        <div className="glass border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 flex items-center justify-center shadow-inner">
            <AlertTriangle size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white leading-none">{stats.alerts}</p>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1.5">Alerts</p>
          </div>
        </div>

        {/* Card 4: Fraud */}
        <div className="glass border border-slate-800/60 rounded-2xl p-5 flex items-center gap-4 hover:border-slate-700/80 transition-all shadow-lg">
          <div className="w-12 h-12 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 flex items-center justify-center shadow-inner">
            <Shield size={20} />
          </div>
          <div>
            <p className="text-2xl font-extrabold text-white leading-none">{stats.fraud}</p>
            <p className="text-[10px] font-extrabold text-slate-500 uppercase tracking-widest mt-1.5">Fraud</p>
          </div>
        </div>
      </div>

      {/* 3. Filter Navigation Bar */}
      <div className="glass border border-slate-800/60 rounded-2xl p-1.5 flex flex-wrap gap-1 shadow-md">
        {['All', 'Unread', 'Success', 'Alerts', 'Fraud', 'Info'].map(tabLabel => {
          const isActive = activeTab === tabLabel;
          return (
            <button
              key={tabLabel}
              onClick={() => setActiveTab(tabLabel)}
              className={`group px-4 py-2 text-xs font-bold rounded-xl transition-all duration-300 flex items-center gap-2 ${
                isActive
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/35 border border-indigo-500/30'
                  : 'text-slate-400 hover:text-white hover:bg-white/5'
              }`}
            >
              {getFilterIcon(tabLabel, isActive)}
              <span>{tabLabel}</span>
            </button>
          );
        })}
      </div>

      {/* 4. Active List / Empty State Container */}
      <div className="glass border border-slate-800/60 rounded-3xl p-6 shadow-2xl relative min-h-[350px] flex flex-col justify-center">
        <AnimatePresence mode="wait">
          {filteredList.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="text-center py-12 flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 flex items-center justify-center mb-6 shadow-lg shadow-indigo-500/5 animate-float">
                <Zap size={28} />
              </div>
              <h2 className="text-xl font-bold text-white tracking-tight">No notifications here</h2>
              <p className="text-slate-400 text-sm mt-2 max-w-sm">
                You're all caught up! New notifications will appear here in real-time.
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="list"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              {filteredList.map((n) => (
                <div
                  key={n.notification_id}
                  onClick={() => handleNotificationClick(n)}
                  className={`group rounded-2xl p-4 border transition-all duration-300 relative flex items-start gap-4 cursor-pointer ${
                    !n.is_read
                      ? 'border-cyan-500/40 bg-cyan-500/5 hover:border-cyan-500/60'
                      : 'border-slate-800 bg-slate-900/10 hover:border-slate-700'
                  }`}
                >
                  <div className={`p-2.5 rounded-xl border flex-shrink-0 ${
                    n.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' :
                    n.type === 'error' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    n.type === 'warning' ? 'bg-amber-500/10 border-amber-500/20 text-amber-400' :
                    n.type === 'fraud' || n.type === 'suspicious' ? 'bg-rose-500/10 border-rose-500/20 text-rose-400' :
                    'bg-indigo-500/10 border-indigo-500/20 text-indigo-400'
                  }`}>
                    {n.type === 'success' ? <CheckCircle size={18} /> :
                     n.type === 'error' ? <AlertCircle size={18} /> :
                     n.type === 'warning' ? <AlertTriangle size={18} /> :
                     n.type === 'fraud' || n.type === 'suspicious' ? <Shield size={18} /> :
                     <Info size={18} />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-2">
                        <h4 className={`text-sm font-bold truncate ${!n.is_read ? 'text-cyan-400' : 'text-white'}`}>
                          {n.title}
                        </h4>
                        {!n.is_read && (
                          <span className="bg-cyan-500 text-slate-950 text-[8px] font-extrabold uppercase px-1.5 py-0.5 rounded tracking-wider">
                            New
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">
                        {new Date(n.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-1 leading-relaxed">{n.message}</p>
                  </div>

                  {/* Mark as read tick indicator */}
                  {!n.is_read && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(n.notification_id);
                      }}
                      className="p-1.5 rounded-lg border border-cyan-500/20 text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20 hover:text-white transition-all flex items-center justify-center self-center"
                      title="Mark as read"
                    >
                      <Check size={12} />
                    </button>
                  )}
                </div>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

    </div>
  );
}
  const handleNotificationClick = async (notification) => {
    await openNotification(notification);
  };
