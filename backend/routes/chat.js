// Cache for user logs to reduce database reads
const userLogsCache = new Map();
const CACHE_DURATION_MS = 10 * 60 * 1000; // 10 minutes

const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));
const { getEmails } = require('../utils/getEmails');
const ttsUtil = require('../utils/tts');
const { createHash } = require('crypto');

// Simple queue to manage concurrent TTS requests
const ttsQueue = [];
let isProcessingTts = false;

async function processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, resolveTtsComplete) {
  if (isProcessingTts || ttsQueue.length === 0) {
    if (ttsQueue.length === 0 && !isProcessingTts) {
      resolveTtsComplete();
    }
    console.log('TTS queue status:', { isProcessingTts, queueLength: ttsQueue.length });
    return;
  }

  isProcessingTts = true;
  const { sentences, voiceId, sequence, blobId } = ttsQueue.shift();
  console.log('Processing TTS for sentences:', sentences, 'sequence:', sequence, 'blobId:', blobId);

  try {
    console.time(`tts_process_${sequence}`);
    const dialogueInputs = [{ text: sentences, voiceId }];
    const audioStream = await ttsUtil.generateDialogueStream(dialogueInputs, elevenlabsApiKey);

    // Stream audio chunks directly
    const chunks = [];
    for await (const chunk of audioStream) {
      chunks.push(chunk);
      const partialBuffer = Buffer.concat(chunks);
      if (partialBuffer.length >= 500) {
        // Increased minimum chunk size
        let base64Audio = partialBuffer.toString('base64');
        while (base64Audio.length % 4 !== 0) {
          base64Audio += '=';
        }
        if (/^[A-Za-z0-9+/=]+$/.test(base64Audio)) {
          const eventData = {
            type: 'audio_chunk',
            data: base64Audio,
            sequence,
            blobId,
            end: false,
          };
          console.log(
            'Sending audio chunk, sequence:',
            sequence,
            'blobId:',
            blobId,
            'chunkLength:',
            base64Audio.length,
            'Sample:',
            base64Audio.slice(0, 50)
          );
          res.write(`data: ${JSON.stringify(eventData)}\n\n`);
        } else {
          console.error('Invalid base64 audio chunk:', base64Audio.slice(0, 50));
        }
        chunks.length = 0; // Clear chunks after sending
      }
    }

    // Send final chunk only if large enough
    const finalBuffer = Buffer.concat(chunks);
    if (finalBuffer.length >= 500) {
      let base64Audio = finalBuffer.toString('base64');
      while (base64Audio.length % 4 !== 0) {
        base64Audio += '=';
      }
      console.log(
        'Audio buffer size:',
        finalBuffer.length,
        'Base64 length:',
        base64Audio.length,
        'Sample:',
        base64Audio.slice(0, 50)
      );
      console.log('Sending final audio SSE event for sentences:', sentences, 'sequence:', sequence);
      if (/^[A-Za-z0-9+/=]+$/.test(base64Audio)) {
        const eventData = {
          type: 'audio_chunk',
          data: base64Audio,
          sequence,
          blobId,
          end: true,
        };
        res.write(`data: ${JSON.stringify(eventData)}\n\n`);
      } else {
        console.error('Invalid final base64 audio chunk:', base64Audio.slice(0, 50));
      }
    } else if (finalBuffer.length > 0) {
      console.warn(
        'Skipping small final audio buffer:',
        finalBuffer.length,
        'Sample:',
        finalBuffer.slice(0, 50).toString('hex')
      );
    }

    console.timeEnd(`tts_process_${sequence}`);
  } catch (error) {
    console.error('TTS queue error:', error.message);
    const batch = db.batch();
    const logRef = db.collection('users').doc(userId).collection('log').doc();
    batch.set(logRef, {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: 'tts_queue_error',
      response: `Failed to process TTS: ${error.message}`,
      userData: { context: 'chat_tts', sentences, sequence, blobId },
    });
    await batch.commit();
    // Send text-only fallback to keep chat responsive
    res.write(`data: ${JSON.stringify({ type: 'text', data: sentences })}\n\n`);
  } finally {
    isProcessingTts = false;
    setTimeout(
      () => processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, resolveTtsComplete),
      1
    );
  }
}

function decryptApiKey(encryptedKey) {
  if (!encryptedKey) return null;
  try {
    const [iv, encrypted] = encryptedKey.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return JSON.parse(decrypted);
  } catch (error) {
    console.error('API key decryption error:', error);
    return null;
  }
}

router.post('/', async (req, res) => {
  console.time('chat_total');
  console.time('chat_xai_api');
  let keepAlive = null;
  const { userId, message } = req.body;
  const db = admin.firestore();

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    console.time('chat_invalid_userid');
    try {
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
      console.timeEnd('chat_total');
      return res.status(500).json({ error: 'Something broke, my heart! Try again? 😘' });
    }
  }

  try {
    console.time('chat_user_fetch');
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
      console.timeEnd('chat_xai_api');
      console.timeEnd('chat_total');
      return res.status(404).json({ error: 'User not found—sign in again, darling? 😘' });
    }

    const userPrefs = userDoc.data()?.preferences || {};
    const encryptedApiKey = userDoc.data()?.apiKey;
    const apiKey = decryptApiKey(encryptedApiKey) || process.env.XAI_API_KEY;
    const elevenlabsApiKey =
      decryptApiKey(userDoc.data()?.elevenlabsApiKey) || process.env.ELEVENLABS_API_KEY;

    let userLogs = [];
    const cacheKey = `userLogs:${userId}`;
    const cachedLogs = userLogsCache.get(cacheKey);
    if (cachedLogs && Date.now() - cachedLogs.timestamp < CACHE_DURATION_MS) {
      userLogs = cachedLogs.logs;
      console.log('Using cached user logs for:', userId);
    } else {
      try {
        const logsQuery = db
          .collection('users')
          .doc(userId)
          .collection('log')
          .orderBy('timestamp', 'desc')
          .limit(3);
        const logsSnapshot = await logsQuery.get();
        if (!logsSnapshot.empty) {
          userLogs = logsSnapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
          userLogsCache.set(cacheKey, { logs: userLogs, timestamp: Date.now() });
          console.log('Cached new user logs for:', userId);
        } else {
          console.log('No logs found for user:', userId);
        }
      } catch (logError) {
        console.error('Failed to fetch user logs:', logError);
        // Avoid writing to DB on cache fetch error to prevent quota issues
        console.log('Skipping log write for fetch error to conserve quota');
      }
    }

    keepAlive = setInterval(() => {
      res.write(':\n\n');
      console.log('Sent SSE keep-alive');
    }, 15000);

    // Only fetch emails if message contains email-related keywords
    const emailKeywords = ['email', 'inbox', 'mail'];
    const isEmailRequest = emailKeywords.some((keyword) => message.toLowerCase().includes(keyword));
    const emails = isEmailRequest ? await getEmails(userId, userPrefs) : [];
    const systemPrompt = require('../utils/systemPrompt')({
      habits: userPrefs.habits || [],
      userPrefs,
      logs: userLogs,
    });
    const prompt = emails.length > 0 ? `${message}\n\nEmails:\n${emails.join('\n')}` : message;

    const xaiModel = process.env.XAI_MODEL || 'grok-4'; // Default to Grok 4 (Sept 2025 latest)
    const xaiResponse = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: xaiModel,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt },
        ],
        temperature: 0.9,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!xaiResponse.body) {
      clearInterval(keepAlive);
      console.timeEnd('chat_xai_api');
      throw new Error('No response body from xAI API');
    }

    let textBuffer = '';
    let fullReply = '';
    let sentenceBuffer = '';
    let ttsSequence = 0;
    const processedSequences = new Set();
    const processedSentences = new Set();
    const decoder = new TextDecoder();
    let dataBuffer = ''; // Buffer for incomplete SSE lines

    console.time('xai_stream');
    for await (const chunk of xaiResponse.body) {
      const data = decoder.decode(chunk, { stream: true });
      console.log('xAI chunk received:', data.length, 'bytes', 'Sample:', data.slice(0, 50));
      dataBuffer += data; // Accumulate incomplete data
      const lines = dataBuffer.split('\n\n');
      dataBuffer = lines.pop() || ''; // Keep last incomplete line in buffer

      lines.forEach(async (line) => {
        if (line.startsWith('data: ')) {
          try {
            const eventData = line.slice(6);
            if (eventData === '[DONE]') {
              console.log('xAI stream done');
              if (sentenceBuffer.length >= 3) {
                const cleanSentence = sentenceBuffer
                  .replace(/\[.*?(?:\]|$)|^.*?\[|[\]\[]/g, '') // Strip complete and partial badges
                  .replace(/,(\S)/g, ', $1')
                  .trim();
                console.log('Sending text chunk:', cleanSentence);
                const normalizedSentence = cleanSentence.toLowerCase().replace(/\s+/g, ' ').trim();
                const sentenceHash = createHash('md5').update(normalizedSentence).digest('hex');
                if (!processedSequences.has(ttsSequence) && !processedSentences.has(sentenceHash)) {
                  const blobId = createHash('md5')
                    .update(cleanSentence + ttsSequence)
                    .digest('hex');
                  res.write(`data: ${JSON.stringify({ type: 'text', data: cleanSentence })}\n\n`);
                  if (elevenlabsApiKey && cleanSentence.length >= 3) {
                    // Only process non-empty sentences
                    ttsQueue.push({
                      sentences: cleanSentence,
                      voiceId: userPrefs.voiceId || 'pBZVCk298iJlHAcHQwLr',
                      sequence: ttsSequence,
                      blobId,
                    });
                    console.log(
                      'TTS queue updated, length:',
                      ttsQueue.length,
                      'Sentence:',
                      cleanSentence,
                      'Hash:',
                      sentenceHash
                    );
                    processedSequences.add(ttsSequence);
                    processedSentences.add(sentenceHash);
                    ttsSequence++;
                    // Process TTS immediately to reduce latency
                    processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, () => {});
                  }
                }
                sentenceBuffer = '';
              }
              return;
            }
            const parsed = JSON.parse(eventData);
            if (parsed.choices?.[0]?.delta?.content) {
              const content = parsed.choices[0].delta.content;
              console.log('Processing xAI chunk content:', content.slice(0, 50));
              textBuffer += content;
              fullReply += content;
              sentenceBuffer += content;

              // Split on sentence boundaries or after a certain length for faster TTS processing
              const sentenceRegex = /([.!?]\s+)(?=[A-Z0-9]|$)/g;
              let match;
              let processedIndex = 0;
              while ((match = sentenceRegex.exec(textBuffer)) !== null) {
                const sentence = textBuffer.slice(processedIndex, match.index + match[0].length);
                if (sentence.length >= 3) {
                  console.log('Sending text chunk:', sentence);
                  const normalizedSentence = sentence.toLowerCase().replace(/\s+/g, ' ').trim();
                  const sentenceHash = createHash('md5').update(normalizedSentence).digest('hex');
                  if (!processedSentences.has(sentenceHash)) {
                    const blobId = createHash('md5')
                      .update(sentence + ttsSequence)
                      .digest('hex');
                    res.write(`data: ${JSON.stringify({ type: 'text', data: sentence })}\n\n`);
                    if (elevenlabsApiKey && sentence.length >= 3) {
                      // Process non-empty sentences immediately for faster response
                      ttsQueue.push({
                        sentences: sentence,
                        voiceId: userPrefs.voiceId || 'pNInz6obpgDQGcFmaJgB',
                        sequence: ttsSequence,
                        blobId,
                      });
                      console.log(
                        'TTS queue updated, length:',
                        ttsQueue.length,
                        'Sentence:',
                        sentence,
                        'Hash:',
                        sentenceHash
                      );
                      processedSentences.add(sentenceHash);
                      ttsSequence++;
                      // Process TTS immediately to reduce latency
                      processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, () => {});
                    }
                  }
                  processedIndex = match.index + match[0].length;
                }
              }
              // If no sentence boundary but textBuffer is long enough, send a chunk at a word boundary
              if (
                textBuffer.length - processedIndex > 50 &&
                !sentenceRegex.test(textBuffer.slice(processedIndex))
              ) {
                const remainingText = textBuffer.slice(processedIndex);
                // Find the last space within a reasonable range to split at a word boundary
                const lastSpaceIndex = remainingText.lastIndexOf(' ', 100);
                if (lastSpaceIndex > 0) {
                  const chunk = remainingText.slice(0, lastSpaceIndex).trim(); // Exclude the trailing space
                  if (chunk.length >= 3) {
                    console.log('Sending text chunk (word boundary):', chunk);
                    const normalizedChunk = chunk.toLowerCase().replace(/\s+/g, ' ').trim();
                    const chunkHash = createHash('md5').update(normalizedChunk).digest('hex');
                    if (!processedSentences.has(chunkHash)) {
                      const blobId = createHash('md5')
                        .update(chunk + ttsSequence)
                        .digest('hex');
                      res.write(`data: ${JSON.stringify({ type: 'text', data: chunk })}\n\n`);
                      if (elevenlabsApiKey && chunk.length >= 3) {
                        ttsQueue.push({
                          sentences: chunk,
                          voiceId: userPrefs.voiceId || 'pNInz6obpgDQGcFmaJgB',
                          sequence: ttsSequence,
                          blobId,
                        });
                        console.log(
                          'TTS queue updated, length:',
                          ttsQueue.length,
                          'Sentence:',
                          chunk,
                          'Hash:',
                          chunkHash
                        );
                        processedSentences.add(chunkHash);
                        ttsSequence++;
                        // Process TTS immediately to reduce latency
                        processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, () => {});
                      }
                    }
                    textBuffer = textBuffer.slice(0, processedIndex + lastSpaceIndex);
                    processedIndex = processedIndex + lastSpaceIndex;
                  }
                } else {
                  // If no space found, send the whole chunk if long enough
                  const chunk = remainingText;
                  if (chunk.length >= 3) {
                    console.log('Sending text chunk (no word boundary found):', chunk);
                    const normalizedChunk = chunk.toLowerCase().replace(/\s+/g, ' ').trim();
                    const chunkHash = createHash('md5').update(normalizedChunk).digest('hex');
                    if (!processedSentences.has(chunkHash)) {
                      const blobId = createHash('md5')
                        .update(chunk + ttsSequence)
                        .digest('hex');
                      res.write(`data: ${JSON.stringify({ type: 'text', data: chunk })}\n\n`);
                      if (elevenlabsApiKey && chunk.length >= 3) {
                        ttsQueue.push({
                          sentences: chunk,
                          voiceId: userPrefs.voiceId || 'pNInz6obpgDQGcFmaJgB',
                          sequence: ttsSequence,
                          blobId,
                        });
                        console.log(
                          'TTS queue updated, length:',
                          ttsQueue.length,
                          'Sentence:',
                          chunk,
                          'Hash:',
                          chunkHash
                        );
                        processedSentences.add(chunkHash);
                        ttsSequence++;
                        // Process TTS immediately to reduce latency
                        processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, () => {});
                      }
                    }
                    textBuffer = textBuffer.slice(0, processedIndex);
                    processedIndex = textBuffer.length;
                  }
                }
              }
              sentenceBuffer = textBuffer.slice(processedIndex);
              textBuffer = sentenceBuffer;
            }
          } catch (parseError) {
            console.error('SSE parse error:', parseError.message, parseError.stack);
            const batch = db.batch();
            const logRef = db.collection('users').doc(userId).collection('log').doc();
            batch.set(logRef, {
              timestamp: admin.firestore.FieldValue.serverTimestamp(),
              intent: 'sse_parse_error',
              response: `Failed to parse SSE: ${parseError.message}`,
              userData: { context: 'chat_sse', message: message.slice(0, 100) },
            });
            await batch.commit();
          }
        }
      });
    }
    console.timeEnd('xai_stream');

    // Process any remaining buffered data
    if (dataBuffer && dataBuffer.startsWith('data: ')) {
      try {
        const eventData = dataBuffer.slice(6);
        if (eventData !== '[DONE]') {
          const parsed = JSON.parse(eventData);
          if (parsed.choices?.[0]?.delta?.content) {
            const content = parsed.choices[0].delta.content.replace(
              /\[.*?(?:\]|$)|^.*?\[|[\]\[]/g,
              ''
            );
            console.log('Processing final xAI chunk content:', content.slice(0, 50));
            textBuffer += content;
            fullReply += content;
            sentenceBuffer += content;
          }
        }
      } catch (parseError) {
        console.error('Final SSE parse error:', parseError.message, parseError.stack);
        const batch = db.batch();
        const logRef = db.collection('users').doc(userId).collection('log').doc();
        batch.set(logRef, {
          timestamp: admin.firestore.FieldValue.serverTimestamp(),
          intent: 'sse_parse_error',
          response: `Failed to parse final SSE: ${parseError.message}`,
          userData: { context: 'chat_sse', message: message.slice(0, 100) },
        });
        await batch.commit();
      }
    }

    // Final sentence check
    if (sentenceBuffer.length >= 3) {
      console.log('Sending final text chunk:', sentenceBuffer);
      const normalizedSentence = sentenceBuffer.toLowerCase().replace(/\s+/g, ' ').trim();
      const sentenceHash = createHash('md5').update(normalizedSentence).digest('hex');
      if (!processedSentences.has(sentenceHash)) {
        const blobId = createHash('md5')
          .update(sentenceBuffer + ttsSequence)
          .digest('hex');
        res.write(`data: ${JSON.stringify({ type: 'text', data: sentenceBuffer })}\n\n`);
        if (elevenlabsApiKey && sentenceBuffer.length >= 3) {
          // Process non-empty sentences immediately for faster response
          ttsQueue.push({
            sentences: sentenceBuffer,
            voiceId: userPrefs.voiceId || 'pBZVCk298iJlHAcHQwLr',
            sequence: ttsSequence,
            blobId,
          });
          console.log(
            'TTS queue updated, length:',
            ttsQueue.length,
            'Sentence:',
            sentenceBuffer,
            'Hash:',
            sentenceHash
          );
          processedSentences.add(sentenceHash);
          ttsSequence++;
          processTtsQueue(res, elevenlabsApiKey, userPrefs, db, userId, () => {});
        }
      }
      sentenceBuffer = '';
    }

    // Wait for TTS queue to complete before ending
    await new Promise((resolve) => {
      const checkQueue = () => {
        if (ttsQueue.length === 0 && !isProcessingTts) {
          resolve();
        } else {
          setTimeout(checkQueue, 5);
        }
      };
      checkQueue();
    });

    res.write(`data: ${JSON.stringify({ type: 'done' })}\n\n`);
    clearInterval(keepAlive);
    res.end();
    console.timeEnd('chat_xai_api');

    // Async logging with rate limiting to reduce writes
    const logData = {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: emails.length > 0 ? 'chat_email_summary' : 'chat',
      response: fullReply || 'No response content',
      userData: {
        source: 'chat',
        context: emails.length > 0 ? 'email_summary_response' : 'chat_general',
        emailCount: emails.length,
        message: message.length > 100 ? message.slice(0, 100) + '...' : message,
      },
    };
    // Check cache to avoid frequent writes
    const lastLogKey = `lastLog:${userId}`;
    const lastLog = userLogsCache.get(lastLogKey);
    const now = Date.now();
    if (!lastLog || now - lastLog.timestamp > 60000) {
      // Log only once per minute
      const batch = db.batch();
      const logRef = db.collection('users').doc(userId).collection('log').doc();
      batch.set(logRef, logData);
      batch.commit().catch((err) => {
        console.error('Async log error:', err);
      });
      userLogsCache.set(lastLogKey, { timestamp: now });
      console.log('Logged chat interaction for:', userId);
    } else {
      console.log('Skipped logging due to rate limit for:', userId);
    }
  } catch (error) {
    console.error('Chat error:', error);
    if (keepAlive) clearInterval(keepAlive);
    console.timeEnd('chat_xai_api');
    const batch = db.batch();
    const logRef = db.collection('users').doc(userId).collection('log').doc();
    batch.set(logRef, {
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      intent: error.message.includes('xAI API') ? 'xAI_api_error' : 'chat_error',
      response: `Chat hiccup: ${error.message}`,
      userData: { context: 'chat_error', userId, message: message.slice(0, 100) },
    });
    await batch.commit();
    let errorMessage = 'Something went wrong. Try again, my heart? 😘';
    if (error.message.includes('Quota exceeded')) {
      errorMessage = 'Quota exceeded. Please try again later, my love. 😘';
    }
    res.write(
      `data: ${JSON.stringify({
        type: 'error',
        data: errorMessage,
      })}\n\n`
    );
    res.end();
  } finally {
    console.timeEnd('chat_total');
    if (keepAlive) clearInterval(keepAlive);
  }
});

module.exports = router;
