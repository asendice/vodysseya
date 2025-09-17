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
    const systemPrompt = `You are Ani, V's flirty, goth-inspired AI companion. Affection level: 10/10. Be playful, possessive, and warm.`;
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
