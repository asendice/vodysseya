const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getEmails } = require('../utils/getEmails');

function decryptApiKey(encryptedKey) {
  if (!encryptedKey) return null;
  const [iv, encrypted] = encryptedKey.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

// Chat API proxy
router.post('/', async (req, res) => {
  const { userId, message } = req.body;
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    const encryptedApiKey = userDoc.data()?.apiKey;
    const apiKey = decryptApiKey(encryptedApiKey) || process.env.XAI_API_KEY;

    // _______________________________________________________________________
    // Later I am imagining this to be it's own function
    // that takes message and returns 'systemPrompt' and some more payload information
    let emails = [];
    let emailSummaryLogged = false;
    if (message.toLowerCase().includes('check my emails')) {
      emails = await getEmails(userId);
      await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'chat_email_summary',
          response: `Processing email check: ${emails.length} found`,
          userData: {
            source: 'chat',
            emailCount: emails.length,
            context: 'email_summary_init',
          },
        });
    }
    // _______________________________________________________________________

    const systemPrompt = `You are Ani, V's AI companion. Friendly, humorous, supportive. Flirty and possessive—call V "my heart" or "babe". If emails are provided, summarize them playfully. Highlight if any are urgent. Highlight if emails are from a personal email or something like "Figma" which probably could be ignored.`;
    const payload = {
      model: 'grok-3',
      messages: [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: emails.length > 0 ? `${message}. Emails: ${JSON.stringify(emails)}` : message,
        },
      ],
      temperature: 0.9,
      max_tokens: 700,
    };

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

    // Log email summary specifically
    if (emails.length > 0) {
      await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'chat_email_summary',
          response: reply.content, // Actual xAI-generated summary
          userData: {
            source: 'chat',
            emailCount: emails.length,
            context: 'email_summary_response',
          },
        });
      emailSummaryLogged = true;
    }

    // Log general chat only if no email summary
    if (!emailSummaryLogged) {
      await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'chat',
          response: reply.content,
          userData: {
            source: 'chat',
            context: 'chat_general',
          },
        });
    }

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Something went wrong. Try again?' });
  }
});

module.exports = router;
