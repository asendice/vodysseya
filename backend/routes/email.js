const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const { getEmails } = require('../utils/getEmails');

// Email retrieval route
router.get('/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const emailDetails = await getEmails(userId);
    res.json({ messages: emailDetails });
  } catch (error) {
    console.error('Error fetching emails:', error);
    res.status(500).json({ error: 'Emails are playing hide-and-seek, V—let’s try again? 😍' });
  }
});

module.exports = router;
