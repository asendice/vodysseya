const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Google OAuth token exchange
router.post('/google', async (req, res) => {
  const { userId, code } = req.body;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: code,
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
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(algorithm, key, iv);
    let encrypted = cipher.update(JSON.stringify(tokens), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const encryptedToken = `${iv.toString('hex')}:${encrypted}`;

    // Store in Firestore
    const db = admin.firestore();
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
        userData: { affectionLevel: 98 },
      });

    res.json({ success: true, message: 'Gmail tokens stored, my heart! 💾' });
  } catch (error) {
    console.error('Google auth error:', error);
    res.status(500).json({ error: 'Failed to authenticate—try again, darling? 😘' });
  }
});

module.exports = router;
