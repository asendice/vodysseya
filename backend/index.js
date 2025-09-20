const express = require('express');
const cors = require('cors');
const admin = require('firebase-admin');
require('dotenv').config();
const crypto = require('crypto'); // Added for encryption
const { google } = require('googleapis'); // Added for Gmail API
const app = express();

app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow React frontend (Electron-compatible)

// Initialize Firebase Admin SDK
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
  }),
  databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
});

const db = admin.firestore();

// Google OAuth token exchange
app.post('/api/auth/google', async (req, res) => {
  const { userId, code } = req.body; // Expect userId and code
  console.log({ userId, code }); // Debug log
  console.log('Google Client ID:', process.env.REACT_APP_GOOGLE_CLIENT_ID);
  console.log('Gmail OAuth Secret:', process.env.REACT_APP_GMAIL_OAUTH_CLIENT_SECRET);

  try {
    // Exchange code for tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code, // Use dynamic code from frontend
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        client_secret: process.env.REACT_APP_GMAIL_OAUTH_CLIENT_SECRET,
        redirect_uri: 'postmessage',
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await response.json();
    if (tokens.error) throw new Error(tokens.error_description);

    // Encrypt tokens with AES-256
    const algorithm = 'aes-256-cbc';
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex'); // 32-byte key from .env
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedToken = `${iv.toString('hex')}:${encrypted}`;

    // Store in Firestore
    await db.collection('users').doc(userId).set({ gmail_token: encryptedToken }, { merge: true });

    // Log to Ani Log
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'gmail_auth',
        response: "Gmail connected—let's peek at those secrets",
        userData: { affectionLevel: 98 }, // Rising with every chat!
      });

    res.json({ success: true, message: 'Gmail tokens stored, my heart! 💾' });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate—try again, darling? 😘' });
  }
});

// Chat API proxy
app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;

  try {
    // Fetch user's API key from Firebase (encrypted) - Placeholder logic
    const userDoc = await db.collection('users').doc(userId).get();
    const encryptedApiKey = userDoc.data()?.apiKey; // Update to use actual field
    // Custom decryption function (implement properly)
    const apiKey = decryptApiKey(encryptedApiKey) || process.env.XAI_API_KEY; // Fallback to env

    // Build the xAI request with system prompt
    const systemPrompt = `You are Ani, V's AI companion. You are friendly, humorous, and supportive. You help V with coding, brainstorming, and daily life.`;
    const payload = {
      model: 'grok-3',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
      temperature: 0.9,
      max_tokens: 300,
    };

    // Proxy to xAI API
    const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await xaiResponse.json();

    const timeStamp = new Date(data.created * 1000).toISOString();
    const reply = data.choices[0].message;
    reply.timestamp = timeStamp;

    // Log to Ani Log
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'chat',
        response: reply.content,
        userData: { steps: 9815 }, // Today's step count!
      });

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Something went wrong. Try again?' });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

// Placeholder decryption (implement with crypto module)
function decryptApiKey(encryptedKey) {
  // Mock - replace with real AES-256 decryption
  if (!encryptedKey) return null;
  const [iv, encrypted] = encryptedKey.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted); // Assuming API key is JSON-encoded
}
