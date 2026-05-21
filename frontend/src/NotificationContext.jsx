import { createContext, useContext, useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import api from './api';
import toast from 'react-hot-toast';

const NotificationContext = createContext();

export function NotificationProvider({ children }) {
  const auth = useAuth();
  const user = auth ? auth.user : null;
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [socket, setSocket] = useState(null);

  useEffect(() => {
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
      }
      setNotifications([]);
      setUnreadCount(0);
      return;
    }

    // Fetch existing notifications
    api.getNotifications().then(data => {
      setNotifications(data.notifications);
      setUnreadCount(data.notifications.filter(n => !n.is_read).length);
    }).catch(console.error);

    // Initialize socket
    const newSocket = io(import.meta.env.VITE_API_URL || 'http://localhost:5000');
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to notification socket');
      newSocket.emit('join', `user_${user.user_id}`);
    });

    newSocket.on('notification', (notification) => {
      setNotifications(prev => [notification, ...prev]);
      setUnreadCount(prev => prev + 1);
      
      // Browser notification if possible
      if (Notification.permission === 'granted') {
        new Notification(notification.title, { body: notification.message });
      }

      // Play sound
      try {
        const audio = new Audio('/notification-sound.mp3'); // Example path
        audio.play().catch(() => {}); // Ignore autoplay errors
      } catch (e) {}

      // Trigger Toast
      const toastMsg = `${notification.title}\n${notification.message}`;
      if (notification.type === 'success') toast.success(toastMsg);
      else if (notification.type === 'error' || notification.type === 'danger') toast.error(toastMsg);
      else toast(toastMsg, { icon: '🔔' });
    });

    return () => newSocket.disconnect();
  }, [user]);

  const markAsRead = async (id) => {
    try {
      await api.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.notification_id === id ? { ...n, is_read: 1 } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (err) {
      console.error(err);
    }
  };

  const openNotification = async (notification) => {
    if (!notification) return;

    if (!notification.is_read) {
      await markAsRead(notification.notification_id);
    }

    if (notification.action_url) {
      navigate(notification.action_url);
    }
  };

  const markAllAsRead = async () => {
    try {
      await api.markAllNotificationsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
      setUnreadCount(0);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead, openNotification, socket }}>
      {children}
    </NotificationContext.Provider>
  );
}

export const useNotifications = () => useContext(NotificationContext);
