const express = require('express');
const db = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

/**
 * GET /api/notifications
 * Get notifications for the current user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const notifications = await db.all(`
      SELECT * FROM notifications 
      WHERE user_id = ? 
      ORDER BY created_at DESC 
      LIMIT 50
    `, [req.user.user_id]);

    res.json({ notifications });
  } catch (err) {
    console.error('Get notifications error:', err);
    res.status(500).json({ error: 'Failed to fetch notifications.' });
  }
});

/**
 * PATCH /api/notifications/read-all
 * Mark all notifications as read
 */
router.patch('/read-all', authenticate, async (req, res) => {
  try {
    await db.run(`
      UPDATE notifications SET is_read = 1 
      WHERE user_id = ?
    `, [req.user.user_id]);

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error('Update all notifications error:', err);
    res.status(500).json({ error: 'Failed to update notifications.' });
  }
});

/**
 * PATCH /api/notifications/:id/read
 * Mark a notification as read
 */
router.patch('/:id/read', authenticate, async (req, res) => {
  try {
    await db.run(`
      UPDATE notifications SET is_read = 1 
      WHERE notification_id = ? AND user_id = ?
    `, [req.params.id, req.user.user_id]);

    res.json({ message: 'Notification marked as read' });
  } catch (err) {
    console.error('Update notification error:', err);
    res.status(500).json({ error: 'Failed to update notification.' });
  }
});

/**
 * Utility function to send a notification (Internal use - async)
 */
router.sendNotification = async function (app, userId, title, message, type = 'info') {
  try {
    const result = await db.run(`
      INSERT INTO notifications (user_id, title, message, type)
      VALUES (?, ?, ?, ?)
    `, [userId, title, message, type]);

    const notification = await db.get(
      'SELECT * FROM notifications WHERE notification_id = ?',
      [result.insertId]
    );

    // Emit via Socket.IO
    const io = app.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notification', notification);
    }

    return notification;
  } catch (err) {
    console.error('Send notification utility error:', err);
  }
};

module.exports = router;
