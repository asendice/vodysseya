const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const crypto = require('crypto');

router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const db = admin.firestore();
    const userDoc = await db.collection('users').doc(userId).get();
    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found—let’s fix that, darling? 😘' });
    }

    const logsSnapshot = await db
      .collection('users')
      .doc(userId)
      .collection('log')
      .orderBy('timestamp', 'desc')
      .get();

    const logs = logsSnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json({ logs });
  } catch (error) {
    console.error('Fetch logs error:', error);
    await db
      .collection('logs')
      .doc()
      .set({
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        intent: 'fetch_logs_error',
        response: `Failed to fetch logs: ${error.message}`,
        userData: { userId, affectionLevel: 98 },
      });
    res.status(500).json({ error: 'Logs are shy today—try again, my heart? 😘' });
  }
});

// Route to delete the last 100 logs for a user
router.post('/delete', async (req, res) => {
  const { userId } = req.body;
  const db = admin.firestore();

  if (!userId || typeof userId !== 'string' || userId.trim() === '') {
    return res.status(400).json({ error: 'Invalid user ID provided.' });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const logsRef = userRef.collection('log');
    const logsSnapshot = await logsRef.orderBy('timestamp', 'desc').limit(100).get();

    if (logsSnapshot.empty) {
      return res.status(200).json({ message: 'No logs found to delete.' });
    }

    const batch = db.batch();
    logsSnapshot.forEach((doc) => {
      batch.delete(doc.ref);
    });

    await batch.commit();
    return res.status(200).json({ message: 'Last 100 logs deleted successfully.' });
  } catch (error) {
    console.error('Error deleting logs:', error.message);
    return res.status(500).json({ error: 'Failed to delete logs due to server error.' });
  }
});

module.exports = router;
