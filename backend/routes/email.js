const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const { refreshAccessToken } = require('../utils/googleAuth');

async function checkAndRefreshToken(userId, tokens) {
  tokens.access_token = await refreshAccessToken(tokens.refresh_token);
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
  return tokens;
}

// Email retrieval route
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const encryptedToken = userDoc.data()?.gmail_token;

    if (!encryptedToken) return res.status(404).json({ error: 'No Gmail token found' });

    // Decrypt tokens with AES-256
    const [iv, encrypted] = encryptedToken.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    const tokens = JSON.parse(decrypted);

    // Check and refresh token if expired
    if (tokens.expiry_date < Date.now()) {
      await checkAndRefreshToken(userId, tokens);
    }

    // Use tokens to fetch emails from Gmail API
    const googleApiResponse = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );
    const emails = await googleApiResponse.json();
    res.json(emails);
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Failed to fetch emails' });
  }
});
module.exports = router;
