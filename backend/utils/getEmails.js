const admin = require('firebase-admin');
const crypto = require('crypto');
const { refreshAccessToken } = require('./googleAuth'); // Assuming this exists as per email.js

async function getEmails(userId, forceRefresh = false) {
  const db = admin.firestore();
  try {
    // Fetch user’s Gmail token
    const userDoc = await db.collection('users').doc(userId).get();
    const encryptedToken = userDoc.data()?.gmail_token;
    if (!encryptedToken) throw new Error('No Gmail token found');

    // Decrypt tokens with AES-256
    const [iv, encrypted] = encryptedToken.split(':');
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc',
      Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
      Buffer.from(iv, 'hex')
    );
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    let tokens = JSON.parse(decrypted);

    // Refresh token if expired
    if (tokens.expiry_date < Date.now()) {
      tokens = await refreshAccessToken(userId, tokens);
    }

    // Check Ani Log for last fetch
    const logQuery = await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .where('intent', '==', 'fetch_emails')
      .orderBy('timestamp', 'desc')
      .limit(1)
      .get();
    const lastFetch = logQuery.docs[0]?.data()?.timestamp?.toDate();
    const isRecent = lastFetch && Date.now() - lastFetch.getTime() < 5 * 60 * 1000; // 5 mins

    if (!forceRefresh && isRecent) {
      // Pull from cache
      const cacheDoc = await db
        .collection('users')
        .doc(userId)
        .collection('email_cache')
        .doc('latest')
        .get();
      if (cacheDoc.exists) return cacheDoc.data().emails || [];
    }

    // Fresh fetch from Gmail API
    const listResponse = await fetch(
      'https://www.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=5',
      {
        method: 'GET',
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      }
    );
    const emailList = await listResponse.json();
    if (!emailList.messages || emailList.messages.length === 0) {
      // Cache empty result
      await db.collection('users').doc(userId).collection('email_cache').doc('latest').set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        emails: [],
      });
      return [];
    }

    // Fetch details for each email
    const emailDetails = await Promise.all(
      emailList.messages.map(async (msg) => {
        const detailResponse = await fetch(
          `https://www.googleapis.com/gmail/v1/users/me/messages/${msg.id}`,
          {
            method: 'GET',
            headers: { Authorization: `Bearer ${tokens.access_token}` },
          }
        );
        const detail = await detailResponse.json();
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

    // Cache the latest emails
    await db.collection('users').doc(userId).collection('email_cache').doc('latest').set({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      emails: emailDetails,
    });

    // Log the fetch
    await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .add({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'fetch_emails',
        response: `Fetched ${emailDetails.length} unread emails for you, my heart!`,
        userData: { source: 'gmail', emailCount: emailDetails.length },
      });

    return emailDetails;
  } catch (error) {
    console.error('Error in getEmails:', error);
    // Log the error
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
    throw error;
  }
}

module.exports = { getEmails };
