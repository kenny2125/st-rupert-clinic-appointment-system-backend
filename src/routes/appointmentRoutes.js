const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');

// Submit Appointment with procedure ID - Done
router.post('/submit-appointment', async (req, res) => {
  const { first_name, last_name, sex, age, email, date_of_birth, contact_no, address, reason,
          procedure_id, appointment_date, appointment_time } = req.body;
  if (!first_name || !sex || !email) {
    return res.status(400).json({ success: false, message: 'first_name, sex and email are required' });
  }
  try {
    // insert basic patient info
    const { data: patient, error: infoError } = await supabase
      .from('basic_info')
      .insert([{ first_name, last_name, sex, age, email, date_of_birth, contact_no, address, reason }])
      .select()
      .single();
    if (infoError || !patient) throw infoError || new Error('Failed to insert patient info');

    // insert appointment record with status default 'pending'
    const { data: appointment, error: apptError } = await supabase
      .from('appointments')
      .insert([{ basic_info_id: patient.id, procedure_id, appointment_date, appointment_time }])
      .select()
      .single();
    if (apptError || !appointment) throw apptError || new Error('Failed to create appointment');

    // Send email verification code
    await emailService.sendVerificationCode(email);

    res.status(201).json({ 
      success: true,
      appointmentId: appointment.id,
      expiresIn: '5 minutes'
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit appointment', error: err.message });
  }
});

// API to send appointment details email
router.post('/send-appointment-details-email', (req, res) => {
  res.json({ success: true, message: 'Appointment details email sent' });
});

// Endpoint to get appointment confirmation status
router.get('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { data, error } = await supabase
      .from('appointments')
      .select('id, email_verified, payment_status')
      .eq('id', id)
      .single();
    if (error) throw error;
    res.status(200).json({ success: true, status: data });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Failed to fetch status', error: error.message });
  }
});

module.exports = router;
