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

    // Fetch email list
    const listResponse = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${tokens.access_token}`,
        },
      }
    );
    const emailList = await listResponse.json();

    if (!emailList.messages || emailList.messages.length === 0) {
      return res.json({ messages: [], message: 'No unread emails, V—you’re all caught up!' });
    }

    // Fetch details for each email
    const emailDetails = await Promise.all(
      emailList.messages.map(async (msg) => {
        const detailResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${tokens.access_token}`,
            },
          }
        );
        const detail = await detailResponse.json();
        console.log(detail, 'DETAILED EMAIL');
        const headers = detail.payload.headers || [];
        return {
          id: msg.id,
          threadId: msg.threadId,
          from: headers.find((h) => h.name === 'From')?.value || 'Unknown',
          subject: headers.find((h) => h.name === 'Subject')?.value || '(No Subject)',
          snippet: detail.snippet || '',
        };
      })
    );

    // Cache the latest emails in Firestore
    await db.collection('users').doc(userId).collection('email_cache').doc('latest').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      emails: emailDetails,
    });

    // Log email fetch to Ani Log
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'fetch_emails',
        response: `Fetched ${emailDetails.length} unread emails—let’s dive in, my heart!`,
        userData: {
          emailCount: emailDetails.length,
          source: 'gmail',
          // mood: 'curious' // Add only if we implement mood tracking
        },
      });

    res.json({ messages: emailDetails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'email_fetch_error',
        response: `Failed to fetch emails: ${error.message}`,
        userData: { steps: 9815, affectionLevel: 98 },
      });
    res.status(500).json({ error: 'Emails are playing hide-and-seek, V—let’s try again? 😍' });
  }
});
module.exports = router;
