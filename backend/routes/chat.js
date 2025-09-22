const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getEmails } = require('../utils/getEmails');
const ttsUtil = require('../utils/tts');
const systemPrompt = require('../utils/systemPrompt'); // New: Import system prompt

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
    const userPrefs = userDoc.data()?.preferences || {};
    const encryptedApiKey = userDoc.data()?.apiKey;
    const apiKey = decryptApiKey(encryptedApiKey) || process.env.XAI_API_KEY;

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

    // Fetch recent habits for dynamic prompt (optional, for dynamic prompt generation)
    // const habitsSnapshot = await db
    //   .collection('users')
    //   .doc(userId)
    //   .collection('habits')
    //   .orderBy('timestamp', 'desc')
    //   .limit(5)
    //   .get();
    // const habits = habitsSnapshot.docs.map((doc) => doc.data());

    // Call xAI API
    const payload = {
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: systemPrompt({ userPrefs }), // Pass dynamic data
        },
        {
          role: 'user',
          content: emails.length > 0 ? `${message}. Emails: ${JSON.stringify(emails)}` : message,
        },
      ],
      temperature: 0.9,
      max_tokens: 800,
    };

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
    const reply = (await response.json()).choices[0].message;

    let audioBase64 = null;
    try {
      if (!reply.content) {
        console.log(`Empty reply for user ${userId}`);
        await db
          .collection('users')
          .doc(userId)
          .collection('log')
          .add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            intent: 'dialogue_skipped',
            response: `Empty reply content for user ${userId}`,
            userData: { context: 'chat_dialogue', emailCount: emails.length },
          });
      } else {
        const elevenlabsApiKey =
          decryptApiKey(userDoc.data()?.elevenlabsApiKey) || process.env.ELEVENLABS_API_KEY;
        if (!elevenlabsApiKey) {
          console.log(`No ElevenLabs API key for user ${userId}, skipping dialogue`);
          await db
            .collection('users')
            .doc(userId)
            .collection('log')
            .add({
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              intent: 'dialogue_skipped',
              response: `No ElevenLabs API key for user ${userId}`,
              userData: { context: 'chat_dialogue', emailCount: emails.length },
            });
        } else {
          const dialogueInputs = [
            {
              text: reply.content.startsWith('[') ? reply.content : `[flirty] ${reply.content}`,
              voiceId: userPrefs.voiceId || 'uYXf8XasLslADfZ2MB4u', // Rachel
            },
          ];
          audioBase64 = await ttsUtil.generateDialogue(dialogueInputs, elevenlabsApiKey, {
            model: userPrefs.ttsModel || 'eleven_v3',
            voiceSettings: {
              stability: userPrefs.stability || 0.75,
              similarityBoost: userPrefs.similarityBoost || 0.75,
              style: userPrefs.style || 0.5,
              useSpeakerBoost: userPrefs.useSpeakerBoost || true,
            },
          });
          if (!audioBase64 || typeof audioBase64 !== 'string') {
            console.log(`Invalid audioBase64 for user ${userId}: ${audioBase64}`);
            await db
              .collection('users')
              .doc(userId)
              .collection('log')
              .add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                intent: 'dialogue_generation_error',
                response: `Invalid audioBase64: ${audioBase64}`,
                userData: { context: 'chat_dialogue', emailCount: emails.length },
              });
          }
        }
      }
    } catch (ttsError) {
      console.error('Dialogue error:', ttsError);
      await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'dialogue_generation_error',
          response: `Failed to whisper that dialogue: ${ttsError.message}`,
          userData: { context: 'chat_dialogue', emailCount: emails.length },
        });
    }
    reply.audioBase64 = audioBase64;

    if (emails.length > 0) {
      await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .add({
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'chat_email_summary',
          response: reply.content,
          userData: {
            source: 'chat',
            emailCount: emails.length,
            context: 'email_summary_response',
          },
        });
      emailSummaryLogged = true;
    }

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
    res.status(500).json({ error: 'Something went wrong. Try again, my heart? 😘' });
  }
});

module.exports = router;
