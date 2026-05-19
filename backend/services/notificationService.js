const nodemailer = require('nodemailer');
const db = require('../config/database');

// Configure SMTP transporter
let transporter = null;

// Initialize email transport (supports SMTP settings in .env or local ethereal test account fallback)
const getTransporter = async () => {
  if (transporter) return transporter;

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Fallback: Create ethereal test account for debugging/development
    try {
      const testAccount = await nodemailer.createTestAccount();
      transporter = nodemailer.createTransport({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: testAccount.user,
          pass: testAccount.pass,
        },
      });
      console.log('✉️  Ethereal SMTP fallback initialized:', testAccount.user);
    } catch (err) {
      console.warn('⚠️  Could not initialize ethereal SMTP. Using mock email client.');
      transporter = {
        sendMail: async (opts) => {
          console.log(`[✉️  MOCK EMAIL] To: ${opts.to}\nSubject: ${opts.subject}\nBody: ${opts.text}\n`);
          return { messageId: 'mock-id' };
        }
      };
    }
  }
  return transporter;
};

/**
 * Send a notification across 4 smart channels: Database, Socket.io (Real-time), Nodemailer (Email), Mock SMS & Mock Push Alerts.
 * 
 * @param {object} app Express application instance to fetch Socket.IO ('io')
 * @param {number} userId The user_id of the recipient
 * @param {object} params Object containing { title, message, type }
 */
async function sendSmartNotification(app, userId, { title, message, type = 'info' }) {
  try {
    // 1. Database Storage
    const result = await db.run(
      'INSERT INTO notifications (user_id, title, message, type, is_read) VALUES (?, ?, ?, ?, 0)',
      [userId, title, message, type]
    );

    const notification = await db.get(
      'SELECT * FROM notifications WHERE notification_id = ?',
      [result.insertId]
    );

    // 2. Fetch User Profile for Email/Phone Info
    const user = await db.get(
      'SELECT name, email, phone FROM users WHERE user_id = ?',
      [userId]
    );

    if (!user) {
      console.warn(`⚠️ User with id ${userId} not found for smart routing.`);
      return notification;
    }

    // 3. Real-Time Updates Channel (Socket.io)
    const io = app?.get('io');
    if (io) {
      io.to(`user_${userId}`).emit('notification', notification);
      console.log(`📡 [Real-Time Alert] Emitted to user_${userId} via Socket.IO: "${title}"`);
    }

    // 4. Email Alert Channel (Nodemailer)
    if (user.email) {
      try {
        const client = await getTransporter();
        const mailOptions = {
          from: '"MicroTender Smart System" <no-reply@microtender.gov>',
          to: user.email,
          subject: `🔔 MicroTender Update: ${title}`,
          text: `Hi ${user.name},\n\n${message}\n\nThis is an automated system alert.\nBest regards,\nMicroTender Support`,
          html: `
            <div style="font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 30px; background-color: #0f111a; color: #f3f4f6; border-radius: 16px; border: 1px solid #1f2937; max-width: 600px; margin: 0 auto; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.3)">
              <div style="display: flex; align-items: center; margin-bottom: 20px; border-bottom: 1px solid #1f2937; padding-bottom: 15px;">
                <span style="font-size: 24px; margin-right: 10px;">🔔</span>
                <h2 style="color: #818cf8; margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">MicroTender Alert</h2>
              </div>
              <p style="font-size: 16px; font-weight: bold; color: #ffffff; margin-top: 0;">Hello ${user.name},</p>
              <p style="color: #9ca3af; font-size: 14px; line-height: 1.6; margin-bottom: 25px;">${message}</p>
              <div style="background-color: #1e1b4b; border-left: 4px solid #6366f1; padding: 15px; border-radius: 8px; margin-bottom: 25px;">
                <span style="color: #c7d2fe; font-size: 12px; font-weight: bold; text-transform: uppercase; tracking-wider: 0.05em; display: block; margin-bottom: 5px;">Alert Details</span>
                <span style="color: #a5b4fc; font-size: 13px; font-weight: bold;">${title}</span>
              </div>
              <hr style="border: 0; border-top: 1px solid #1f2937; margin: 30px 0 20px 0;">
              <p style="font-size: 11px; color: #4b5563; text-align: center; margin: 0;">This is a system generated notification from the Dynamic Micro-Tender Platform.</p>
            </div>
          `,
        };

        const info = await client.sendMail(mailOptions);
        if (info.testMessageUrl) {
          console.log(`✉️ [Email Alert Log] Ethereal Webmail view link: ${info.testMessageUrl}`);
        } else {
          console.log(`✉️ [Email Alert Log] Email successfully sent to ${user.email} (Id: ${info.messageId})`);
        }
      } catch (mailErr) {
        console.error('❌ [Email Alert Failed]:', mailErr.message);
      }
    }

    // 5. Firebase Push Notification Channel (Mocked SDK)
    console.log(`🔥 [Firebase Push Notification SDK] sending message payload...`);
    console.log(`   └─ TOKEN: "fcm_token_user_${userId}_mocked_hash"`);
    console.log(`   └─ TITLE: "${title}"`);
    console.log(`   └─ BODY:  "${message.substring(0, 70)}..."`);
    console.log(`   └─ STATUS: Push Dispatched Successfully`);

    // 6. SMS Alerts Channel (Mocked API)
    if (user.phone) {
      console.log(`💬 [SMS Alert Dispatched via Mock API Gateway]`);
      console.log(`   └─ TO:    "${user.phone}"`);
      console.log(`   └─ MSG:   "MicroTender Notification: ${title} - ${message.substring(0, 50)}..."`);
      console.log(`   └─ STATUS: Delivered (Carrier ID: 200)`);
    }

    return notification;
  } catch (err) {
    console.error('❌ [Smart Notification Service Error]:', err);
  }
}

module.exports = {
  sendSmartNotification,
};
