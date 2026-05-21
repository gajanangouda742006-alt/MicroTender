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

    res.json({
      notifications: notifications.map((notification) => ({
        ...notification,
        metadata: notification.metadata ? (() => {
          try {
            return JSON.parse(notification.metadata);
          } catch (error) {
            return null;
          }
        })() : null,
      })),
    });
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

const { sendSmartNotification } = require('../services/notificationService');

/**
 * Utility function to send a notification (Delegates to multi-channel smart service)
 */
router.sendNotification = async function (app, userId, titleOrPayload, message, type = 'info') {
  if (typeof titleOrPayload === 'object' && titleOrPayload !== null) {
    return await sendSmartNotification(app, userId, titleOrPayload);
  }

  return await sendSmartNotification(app, userId, {
    title: titleOrPayload,
    message,
    type,
  });
};

module.exports = router;
