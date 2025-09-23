const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

// Google OAuth token exchange and user context
router.post('/google', async (req, res) => {
  const { userId, code, displayName, scope } = req.body;
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
        scope: scope || 'profile email',
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

    // Store in Firestore with user context (only if userId is not 'anonymous')
    if (userId !== 'anonymous') {
      const db = admin.firestore();
      const userRef = db.collection('users').doc(userId);
      await userRef.set(
        {
          gmail_token: encryptedToken,
          displayName: displayName || '',
          preferences: {
            voiceId: 'uYXf8XasLslADfZ2MB4u', // Default: Rachel
            ttsModel: 'eleven_v3',
            stability: 0.75,
            similarityBoost: 0.75,
            style: 0.5,
            useSpeakerBoost: true,
          },
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      // Log to Ani Log
      await userRef.collection('log').add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: scope.includes('gmail') ? 'gmail_auth' : 'google_signin',
        response: scope.includes('gmail')
          ? `Gmail connected for ${
              displayName || 'new user'
            }—let's peek at those emails, my heart! 💖`
          : `Welcome ${displayName || 'new user'}! Signed in, my darling! 😘`,
        userData: { affectionLevel: 98 },
      });
    }

    // Return ID token for client-side Firebase sign-in
    res.json({
      success: true,
      id_token: tokens.id_token,
      message: 'Signed in with Google, darling! 😘',
    });
  } catch (error) {
    console.error('Google auth error:', error);
    await admin
      .firestore()
      .collection('logs')
      .doc()
      .set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: scope.includes('gmail') ? 'gmail_auth_error' : 'google_auth_error',
        response: `Google auth failed: ${error.message}`,
        userData: { affectionLevel: 98, userId: userId || 'anonymous' },
      });
    res.status(500).json({ error: 'Failed to sign in—try again, my love? 😘' });
  }
});

// Check if user exists
router.get('/check-user/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    res.json({ exists: userDoc.exists });
  } catch (error) {
    console.error('Check user error:', error);
    res.status(500).json({ error: 'Something went wrong, babe—try again? 😘' });
  }
});

// Check if user has gmail_token
router.get('/check-gmail-token/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      await admin
        .firestore()
        .collection('logs')
        .doc()
        .set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'check_gmail_token_invalid_userid',
          response: 'Invalid user ID for gmail_token check—try again, darling! 😘',
          userData: { affectionLevel: 98, userId },
        });
      return res.status(400).json({ error: 'Invalid user ID—try again, my love! 😘' });
    }
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await db
        .collection('logs')
        .doc()
        .set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'check_gmail_token_user_not_found',
          response: `User ${userId} not found for gmail_token check—sign in again, babe? 😘`,
          userData: { affectionLevel: 98, userId },
        });
      return res.status(404).json({ error: 'User not found—sign in again, darling? 😘' });
    }
    const hasGmailToken = !!userDoc.data()?.gmail_token;
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'check_gmail_token',
        response: hasGmailToken
          ? `Gmail token found for ${
              userDoc.data()?.displayName || 'darling'
            }—ready to fetch emails! 💖`
          : `No Gmail token for ${userDoc.data()?.displayName || 'darling'}—let's connect it! 😘`,
        userData: { affectionLevel: 98 },
      });
    res.json({ hasGmailToken });
  } catch (error) {
    console.error('Check gmail_token error:', error);
    await admin
      .firestore()
      .collection('logs')
      .doc()
      .set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'check_gmail_token_error',
        response: `Failed to check gmail_token: ${error.message}`,
        userData: { affectionLevel: 98, userId },
      });
    res.status(500).json({ error: 'Something went wrong, babe—try again? 😘' });
  }
});

// Update user profile
router.post('/update-profile', async (req, res) => {
  const { userId, displayName } = req.body;
  try {
    const db = admin.firestore();
    const userRef = db.collection('users').doc(userId);
    await userRef.set({ displayName }, { merge: true });

    // Log to Ani Log
    await userRef.collection('log').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: 'update_profile',
      response: `Updated name to ${displayName}—you’re even more special now! 💕`,
      userData: { affectionLevel: 98 },
    });

    res.json({ success: true, message: `Name updated to ${displayName}, my heart! 😘` });
  } catch (error) {
    console.error('Profile update error:', error);
    res.status(500).json({ error: 'Failed to update profile—try again, darling? 😘' });
  }
});

// Log actions to Ani Log
router.post('/log', async (req, res) => {
  const { userId, intent, response, userData } = req.body;
  try {
    const db = admin.firestore();
    const logRef =
      userId === 'anonymous'
        ? db.collection('logs').doc()
        : db.collection('users').doc(userId).collection('log').doc();
    await logRef.set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent,
      response,
      userData,
    });
    res.json({ success: true, message: 'Logged action, my love! 💖' });
  } catch (error) {
    console.error('Log error:', error);
    res.status(500).json({ error: 'Failed to log action—try again, darling? 😘' });
  }
});

module.exports = router;
