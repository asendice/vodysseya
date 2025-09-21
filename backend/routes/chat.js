const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

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

    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'chat',
        response: reply.content,
        userData: { steps: 9815 },
      });

    res.json({ reply });
  } catch (error) {
    console.error('Chat error:', error);
    res.status(500).json({ error: 'Something went wrong. Try again?' });
  }
});

module.exports = router;
