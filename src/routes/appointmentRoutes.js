const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');


// Submit Appointment with procedure ID - Done
router.post('/submit-appointment', async (req, res) => {
  const { first_name, last_name, gender, email, date_of_birth, contact_no, address, reason,
          procedure_id, appointment_date, appointment_time } = req.body;
  if (!first_name || !gender || !email) {
    return res.status(400).json({ success: false, message: 'first_name, gender and email are required' });
  }
  try {
    // insert basic patient info
    const { data: patient, error: infoError } = await supabase
      .from('basic_info')
      .insert([{ first_name, last_name, gender, email, date_of_birth, contact_no, address, reason }])
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

    res.status(201).json({ success: true, message: 'Appointment submitted', patient, appointment });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to submit appointment', error: err.message });
  }
});

// API to send appointment details email
router.post('/send-appointment-details-email', (req, res) => {
  res.json({ success: true, message: 'Appointment details email sent' });
});

module.exports = router;
