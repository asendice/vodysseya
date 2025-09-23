const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getEmails } = require('../utils/getEmails');
const ttsUtil = require('../utils/tts');
const systemPrompt = require('../utils/systemPrompt');

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

router.post('/', async (req, res) => {
  console.time('chat_total'); // Start overall timer
  const { userId, message } = req.body;

  // Validate userId
  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.time('chat_invalid_userid');
    try {
      const db = admin.firestore();
      const batch = db.batch();
      const logRef = db
        .collection('users')
        .doc(userId || 'anonymous')
        .collection('log')
        .doc();
      batch.set(logRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'chat_invalid_userid',
        response: 'No valid user ID—please sign in again, darling! 😘',
        userData: { context: 'chat_error', message },
      });
      await batch.commit();
      console.timeEnd('chat_invalid_userid');
      return res.status(400).json({ error: 'Please sign in to chat, my love! 😘' });
    } catch (logError) {
      console.error('Log error:', logError);
    }
  }

  try {
    console.time('chat_user_fetch'); // Time user doc and logs
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      const batch = db.batch();
      const logRef = db.collection('users').doc(userId).collection('log').doc();
      batch.set(logRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'chat_user_not_found',
        response: `User ${userId} not found—sign in again, babe? 😘`,
        userData: { context: 'chat_error', message },
      });
      await batch.commit();
      console.timeEnd('chat_user_fetch');
      return res.status(404).json({ error: 'User not found—sign in again, darling? 😘' });
    }

    const userPrefs = userDoc.data()?.preferences || {};
    const encryptedApiKey = userDoc.data()?.apiKey;
    const apiKey = decryptApiKey(encryptedApiKey) || process.env.XAI_API_KEY;

    // Fetch recent logs from subcollection
    let userLogs = [];
    try {
      const logsSnapshot = await db
        .collection('users')
        .doc(userId)
        .collection('log')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();
      userLogs = logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
    } catch (logError) {
      console.error('Failed to fetch user logs:', logError);
      const batch = db.batch();
      const logRef = db.collection('users').doc(userId).collection('log').doc();
      batch.set(logRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'log_fetch_error',
        response: `Failed to fetch logs: ${logError.message}`,
        userData: { context: 'chat_log_fetch', message },
      });
      await batch.commit();
    }
    console.timeEnd('chat_user_fetch');

    console.time('chat_email_fetch'); // Time email fetch if needed
    let emails = [];
    if (message.toLowerCase().includes('check my emails')) {
      emails = await getEmails(userId);
    }
    console.timeEnd('chat_email_fetch');

    console.time('chat_xai_api'); // Time xAI API call
    // Call xAI API
    const payload = {
      model: 'grok-3',
      messages: [
        {
          role: 'system',
          content: systemPrompt({ userPrefs, habits: [], logs: userLogs }),
        },
        {
          role: 'user',
          content: emails.length > 0 ? `${message}. Emails: ${JSON.stringify(emails)}` : message,
        },
      ],
      temperature: 0.9,
      max_tokens: 2000,
    };

    const response = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`xAI API error: ${response.statusText}`);
    }

    const reply = (await response.json()).choices[0].message;
    console.timeEnd('chat_xai_api');

    console.time('chat_tts'); // Time TTS generation
    let audioBase64 = null;
    try {
      if (!reply.content) {
        const batch = db.batch();
        const logRef = db.collection('users').doc(userId).collection('log').doc();
        batch.set(logRef, {
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'dialogue_skipped',
          response: `Empty reply content for user ${userId}`,
          userData: { context: 'chat_dialogue', emailCount: emails.length },
        });
        await batch.commit();
      } else {
        const elevenlabsApiKey =
          decryptApiKey(userDoc.data()?.elevenlabsApiKey) || process.env.ELEVENLABS_API_KEY;
        if (!elevenlabsApiKey) {
          const batch = db.batch();
          const logRef = db.collection('users').doc(userId).collection('log').doc();
          batch.set(logRef, {
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            intent: 'dialogue_skipped',
            response: `No ElevenLabs API key for user ${userId}`,
            userData: { context: 'chat_dialogue', emailCount: emails.length },
          });
          await batch.commit();
        } else {
          const dialogueInputs = [
            {
              text: reply.content.startsWith('[') ? reply.content : `[flirty] ${reply.content}`,
              voiceId: userPrefs.voiceId || 'tnSpp4vdxKPjI9w0GnoV', // Rachel
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
            throw new Error(`Invalid audioBase64: ${audioBase64}`);
          }
        }
      }
    } catch (ttsError) {
      console.error('Dialogue error:', ttsError);
      const batch = db.batch();
      const logRef = db.collection('users').doc(userId).collection('log').doc();
      batch.set(logRef, {
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'dialogue_generation_error',
        response: `Failed to whisper that dialogue: ${ttsError.message}`,
        userData: { context: 'chat_dialogue', emailCount: emails.length },
      });
      await batch.commit();
    }
    reply.audioBase64 = audioBase64;
    console.timeEnd('chat_tts');

    // Strip emotion/tone badges like [happy] or [frustrated sigh] for clean frontend display
    if (reply.content) {
      reply.content = reply.content.replace(/\[[^\]]+\]/g, '').trim();
    }

    // Send response immediately to reduce latency
    res.json({ reply });

    // Consolidated logging (async to avoid delaying response)
    // TODO: Revisit logging all user messages for privacy/storage optimization (Q1 2026)
    const batch = db.batch();
    const logRef = db.collection('users').doc(userId).collection('log').doc();
    batch.set(logRef, {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: emails.length > 0 ? 'chat_email_summary' : 'chat',
      response: reply.content || 'No response content',
      userData: {
        source: 'chat',
        context: emails.length > 0 ? 'email_summary_response' : 'chat_general',
        emailCount: emails.length,
        message: message.length > 100 ? message.slice(0, 100) + '...' : message, // Log user message, truncated for safety
      },
    });

    // Commit batch asynchronously
    batch.commit().catch((logError) => {
      console.error('Async log error:', logError);
    });
  } catch (error) {
    console.error('Chat error:', error);
    const batch = db.batch();
    const logRef = db.collection('users').doc(userId).collection('log').doc();
    batch.set(logRef, {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: error.message.includes('xAI API') ? 'xai_api_error' : 'chat_error',
      response: `Chat hiccup: ${error.message}`,
      userData: { context: 'chat_error', userId, message },
    });
    await batch.commit();
    res.status(500).json({ error: 'Something went wrong. Try again, my heart? 😘' });
  } finally {
    console.timeEnd('chat_total'); // End overall timer, always
  }
});

module.exports = router;
