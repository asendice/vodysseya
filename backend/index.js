const express = require('express');
const cors = require('cors');
// const admin = require('firebase-admin'); // Assume Firebase is initialized
require('dotenv').config();
const app = express();
app.use(express.json());
app.use(cors({ origin: 'http://localhost:3000' })); // Allow React frontend

// Initialize Firebase (if not already done)
// admin.initializeApp({
//   credential: admin.credential.applicationDefault(),
// });
// const db = admin.firestore();

// Google OAuth token exchange
app.post('/api/auth/google', async (req, res) => {
  const { credential } = req.body;

  console.log('Received Google credential:', credential);
  try {
    // Exchange credential for tokens using Google API
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: credential,
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID,
        client_secret: process.env.REACT_APP_GMAIL_OAUTH_CLIENT_SECRET,
        redirect_uri: 'http://localhost:3000/auth/callback',
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await response.json();
    // TODO: Encrypt tokens (AES-256) and store in Firebase
    res.json({ tokens });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate with Google' });
  }
});

app.post('/api/chat', async (req, res) => {
  const { userId, message } = req.body;

  try {
    // Fetch user's API key from Firebase (encrypted)
    // const userDoc = await db.collection('users').doc(userId).get();
    // const encryptedApiKey = userDoc.data().apiKey;
    // Custom decryption function
    // const apiKey = decryptApiKey(encryptedApiKey);

    // Use XAI_API_KEY from .env
    const apiKey = process.env.XAI_API_KEY;

    // Build the xAI request with system prompt
    const systemPrompt = `You Ani, V's AI companion. You are friendly, humorous, and supportive. You help V with coding, brainstorming, and daily life.`;
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
  // Use crypto-js or Node's crypto for AES-256 decryption
  // This is a mock - replace with real logic
  return encryptedKey; // Replace with actual decryption
}
