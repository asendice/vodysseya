const { google } = require('googleapis');
const admin = require('firebase-admin');
const crypto = require('crypto');

async function decryptToken(encryptedToken) {
  if (!encryptedToken) return null;
  const [iv, encrypted] = encryptedToken.split(':');
  const decipher = crypto.createDecipheriv(
    'aes-256-cbc',
    Buffer.from(process.env.ENCRYPTION_KEY, 'hex'),
    Buffer.from(iv, 'hex')
  );
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return JSON.parse(decrypted);
}

async function getEmails(userId) {
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) throw new Error('User not found');
    const { gmail_token } = userDoc.data();
    if (!gmail_token) throw new Error('No Gmail token found');

    const tokens = await decryptToken(gmail_token);
    if (!tokens.access_token) throw new Error('Invalid or expired Gmail token');

    const oauth2Client = new google.auth.OAuth2(
      process.env.REACT_APP_GOOGLE_CLIENT_ID,
      process.env.REACT_APP_GMAIL_OAUTH_CLIENT_SECRET,
      'postmessage'
    );
    oauth2Client.setCredentials(tokens);

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client });
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: 'is:unread',
      maxResults: 5,
    });

    const messages = response.data.messages || [];
    const emailDetails = await Promise.all(
      messages.map(async (msg) => {
        const message = await gmail.users.messages.get({
          userId: 'me',
          id: msg.id,
        });
        return {
          id: msg.id,
          snippet: message.data.snippet,
          subject: message.data.payload.headers.find((h) => h.name === 'Subject')?.value || '',
          from: message.data.payload.headers.find((h) => h.name === 'From')?.value || '',
        };
      })
    );

    return emailDetails;
  } catch (error) {
    console.error('getEmails error:', error);
    throw error;
  }
}

module.exports = { getEmails };
