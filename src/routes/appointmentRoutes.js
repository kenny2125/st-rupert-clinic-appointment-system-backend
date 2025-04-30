const express = require('express');
const router = express.Router();

// User API to submit appointment
router.post('/submit-appointment', (req, res) => {
  res.json({ success: true, message: 'Appointment submitted' });
});

// API to send appointment details email
router.post('/send-appointment-details-email', (req, res) => {
  res.json({ success: true, message: 'Appointment details email sent' });
});

module.exports = router;
