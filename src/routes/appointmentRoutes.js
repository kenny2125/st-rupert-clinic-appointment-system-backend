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

// Get appointment time slot availability
router.get('/status', async (req, res) => {
  try {
    // Get date parameter from request query (default to today if not provided)
    const { startDate, endDate } = req.query;
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    
    const queryStartDate = startDate || today;
    // Default end date to 30 days from start date if not provided
    const queryEndDate = endDate || new Date(new Date(queryStartDate).setDate(new Date(queryStartDate).getDate() + 30)).toISOString().split('T')[0];
    
    // Define time slots (same as in frontend)
    const timeSlots = [
      { id: 1, time: "8:00 AM - 9:00 AM", maxCapacity: 10 },
      { id: 2, time: "9:00 AM - 10:00 AM", maxCapacity: 10 },
      { id: 3, time: "10:00 AM - 11:00 AM", maxCapacity: 10 },
      { id: 4, time: "11:00 AM - 12:00 PM", maxCapacity: 10 },
      { id: 5, time: "1:00 PM - 2:00 PM", maxCapacity: 10 },
      { id: 6, time: "3:00 PM - 4:00 PM", maxCapacity: 10 },
      { id: 7, time: "4:00 PM - 5:00 PM", maxCapacity: 10 },
    ];
    
    // Query to count appointments for each date and time slot
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('appointment_date, appointment_time')
      .gte('appointment_date', queryStartDate)
      .lte('appointment_date', queryEndDate)
      .neq('status', 'cancelled'); // Don't count cancelled appointments
    
    if (error) throw error;
    
    // Process the appointments into the expected format
    // Format: { "YYYY-MM-DD": { timeSlotId: bookedCount } }
    const timeSlotAvailability = {};
    
    // Initialize dates in the range
    const start = new Date(queryStartDate);
    const end = new Date(queryEndDate);
    for (let date = new Date(start); date <= end; date.setDate(date.getDate() + 1)) {
      const dateString = date.toISOString().split('T')[0];
      timeSlotAvailability[dateString] = {};
      
      // Initialize all time slots with 0 bookings
      timeSlots.forEach(slot => {
        timeSlotAvailability[dateString][slot.id] = 0;
      });
    }
    
    // Map appointment times to time slot IDs
    const timeToSlotId = {
      '08:00:00': 1, '8:00:00': 1,
      '09:00:00': 2, '9:00:00': 2,
      '10:00:00': 3,
      '11:00:00': 4,
      '13:00:00': 5, '1:00:00': 5,
      '15:00:00': 6, '3:00:00': 6,
      '16:00:00': 7, '4:00:00': 7,
    };
    
    // Count booked appointments for each date and time slot
    appointments.forEach(appointment => {
      const dateString = appointment.appointment_date;
      const time = appointment.appointment_time;
      
      // Extract hours from time (could be in HH:MM:SS format)
      // Check if time matches any of our slots
      const slotId = timeToSlotId[time];
      
      if (slotId && timeSlotAvailability[dateString]) {
        timeSlotAvailability[dateString][slotId]++;
      }
    });
    
    res.status(200).json({ 
      success: true, 
      data: {
        timeSlots,
        timeSlotAvailability
      }
    });
  } catch (error) {
    console.error('Error fetching time slot status:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch time slot availability', 
      error: error.message 
    });
  }
});

module.exports = router;
