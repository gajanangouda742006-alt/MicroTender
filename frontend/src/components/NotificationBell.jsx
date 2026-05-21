import { useState } from 'react';
import { useNotifications } from '../NotificationContext';
import { Bell, Check, Info, AlertCircle, CheckCircle } from 'lucide-react';

export default function NotificationBell() {
  const { notifications, unreadCount, openNotification, markAllAsRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getTypeIcon = (type) => {
    switch (type) {
      case 'success': return <CheckCircle className="text-green-400" size={16} />;
      case 'error': return <AlertCircle className="text-red-400" size={16} />;
      case 'warning': return <AlertCircle className="text-amber-400" size={16} />;
      default: return <Info className="text-blue-400" size={16} />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-text-secondary hover:bg-gradient-secondary/20 hover:text-accent-cyan hover:neon-glow-cyan transition-all"
      >
        <Bell size={20} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
            {unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[40]" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-80 glass rounded-2xl shadow-2xl z-[50] overflow-hidden border border-white/20 animate-fade-in">
            <div className="p-4 border-b border-[rgba(255,255,255,0.08)] flex items-center justify-between bg-[rgba(45,48,120,0.72)] backdrop-blur-[14px]">
              <h3 className="font-bold text-sm">Notifications</h3>
              {unreadCount > 0 && (
                <button 
                  onClick={markAllAsRead}
                  className="text-[10px] text-primary-400 hover:underline"
                >
                  Mark all as read
                </button>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-text-tertiary text-sm">
                  No notifications yet
                </div>
              ) : (
                notifications.map(n => (
                  <div 
                    key={n.notification_id}
                    onClick={() => openNotification(n)}
                    className={`p-4 border-b border-white/5 hover:bg-gradient-secondary/20 hover:neon-glow-purple cursor-pointer transition-colors ${!n.is_read ? 'bg-accent-pink/10' : ''}`}
                  >
                    <div className="flex gap-3">
                      <div className="mt-0.5">{getTypeIcon(n.type)}</div>
                      <div className="flex-1">
                        <p className={`text-sm ${!n.is_read ? 'font-bold text-accent-pink' : 'text-text-secondary'}`}>
                          {n.title}
                        </p>
                        <p className="text-xs text-text-tertiary mt-1">{n.message}</p>
                        <p className="text-[10px] text-text-secondary mt-2">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.is_read && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5" />}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
