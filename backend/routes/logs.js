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

module.exports = router;
