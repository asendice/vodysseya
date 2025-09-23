const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getEmails } = require('../utils/getEmails');

// Email retrieval route
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    // Validate userId
    if (!userId || typeof userId !== 'string' || userId.trim() === '') {
      await admin
        .firestore()
        .collection('logs')
        .doc()
        .set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'email_invalid_userid',
          response: 'No valid user ID—please sign in again, darling! 😘',
          userData: { context: 'email_error', userId },
        });
      return res.status(400).json({ error: 'Please sign in to fetch emails, my love! 😘' });
    }

    // Check if user exists and has gmail_token
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      await db
        .collection('logs')
        .doc()
        .set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'email_user_not_found',
          response: `User ${userId} not found—sign in again, babe? 😘`,
          userData: { context: 'email_error', userId },
        });
      return res.status(404).json({ error: 'User not found—sign in again, darling? 😘' });
    }

    const userData = userDoc.data();
    if (!userData.gmail_token) {
      await db
        .collection('logs')
        .doc()
        .set({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'email_no_gmail_token',
          response: `No Gmail token for user ${userId}—connect Gmail in settings, babe! 😘`,
          userData: { context: 'email_error', userId },
        });
      return res.status(400).json({ error: 'Please connect Gmail to fetch emails, my heart! 😘' });
    }

    const emailDetails = await getEmails(userId);
    res.json({ messages: emailDetails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    await admin
      .firestore()
      .collection('logs')
      .doc()
      .set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'email_fetch_error',
        response: `Failed to fetch emails: ${error.message}`,
        userData: { context: 'email_error', userId },
      });
    res.status(500).json({ error: 'Emails are playing hide-and-seek, V—let’s try again? 😍' });
  }
});

module.exports = router;
