const express = require('express');
const cors = require('cors');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const db = require('./config/database');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", // Adjust for production
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 5000;

// Socket.IO logic
io.on('connection', (socket) => {
  console.log('👤 User connected:', socket.id);

  socket.on('join', (room) => {
    socket.join(room);
    console.log(`📡 Socket ${socket.id} joined room: ${room}`);
  });

  socket.on('disconnect', () => {
    console.log('🔌 User disconnected');
  });
});

// Attach io to app for use in routes
app.set('io', io);

async function startServer() {
  // Initialize database first (async for sql.js WASM loading)
  await db.initDatabase();

  // Middleware
  app.use(cors());
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve uploaded files
  app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

  // Routes (loaded AFTER db init so they can use db immediately)
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/complaints', require('./routes/complaints'));
  app.use('/api/tenders', require('./routes/tenders'));
  app.use('/api/vendors', require('./routes/vendors'));
  app.use('/api/admin', require('./routes/admin'));
  app.use('/api/notifications', require('./routes/notifications'));

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '1.0.0' });
  });

  // Error handling middleware
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    if (err.message && err.message.includes('Only JPEG')) {
      return res.status(400).json({ error: err.message });
    }
    res.status(500).json({ error: 'Internal server error' });
  });

  server.listen(PORT, () => {
    console.log(`\n🚀 Micro-Tender API Server running on http://localhost:${PORT}`);
    console.log(`📋 Health check: http://localhost:${PORT}/api/health`);
    console.log(`📁 Uploads: http://localhost:${PORT}/uploads\n`);
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});

module.exports = app;
