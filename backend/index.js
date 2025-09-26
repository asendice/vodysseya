const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();
const bodyParser = require('body-parser');

const app = express();

app.use(express.json());
app.use(
  cors({
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
); // Allow React frontend (Electron-compatible)
app.use(bodyParser.json({ limit: '20mb' })); // Increase to 20mb or higher as needed

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Transfer-Encoding', 'chunked');
  res.setHeader('Content-Length', 1024 * 1024); // 1MB buffer
  next();
});

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

// Import route files
const authRoutes = require('./routes/auth');
const chatRoutes = require('./routes/chat');
const emailRoutes = require('./routes/email');
const logsRoutes = require('./routes/logs');

app.use('/api/auth', authRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/email', emailRoutes);
app.use('/api/logs', logsRoutes);

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
