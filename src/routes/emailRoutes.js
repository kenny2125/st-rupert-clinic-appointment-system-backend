const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');
const supabase = require('../config/supabase');
const paymentService = require('../services/paymentService'); // Assuming you have a paymentService for handling payments


// Route to send email verification code - Done
router.post('/send-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email address is required' 
      });
    }
    
    const result = await emailService.sendVerificationCode(email);
    
    if (result.success) {
      // Don't return the actual code in the response for security
      res.status(200).json({ 
        success: true,
        message: 'Verification code sent successfully',
        email: email,
        expiresIn: '5 minutes'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send verification code',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

// Route to verify the email code - Done
router.post('/verify-email-code', async (req, res) => {
  try {
    const { appointmentId, code } = req.body;
    if (!appointmentId || !code) {
      return res.status(400).json({ success: false, message: 'appointmentId and verification code are required' });
    }

    // Fetch appointment with patient info
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .select('id, basic_info(email, first_name, last_name)')
      .eq('id', appointmentId)
      .single();
    if (apptError || !appt) {
      return res.status(400).json({ success: false, message: 'No appointment found for this ID' });
    }
    const { email } = appt.basic_info;

    // Get stored verification data by email
    const verificationData = emailService.verificationCodes.get(email);
    if (!verificationData) {
      return res.status(400).json({ success: false, message: 'No verification code found for this email. Please request a new code.' });
    }
    if (verificationData.expires < Date.now()) {
      emailService.verificationCodes.delete(email);
      return res.status(400).json({ success: false, message: 'Verification code has expired. Please request a new code.' });
    }
    if (verificationData.code !== code) {
      return res.status(400).json({ success: false, message: 'Invalid verification code. Please try again.' });
    }
    // Code valid - remove it
    emailService.verificationCodes.delete(email);

    // Mark email as verified on appointment
    await supabase.from('appointments').update({ email_verified: true }).eq('id', appointmentId);

    // Create payment link
    const { first_name, last_name } = appt.basic_info;
    const paymentData = {
      amount: 300, // adjust amount
      description: 'Clinic Appointment Fee',
      name: `${first_name} ${last_name}`,
      email
    };
    const paymentResult = await paymentService.createPaymentLink({ ...paymentData, appointmentId });
    if (paymentResult.success) {
      const linkObj = paymentResult.data.data;
      await supabase
        .from('appointments')
        .update({ payment_id: linkObj.id, payment_url: linkObj.attributes.url })
        .eq('id', appointmentId);
      const checkoutUrl = linkObj.attributes.checkout_url || linkObj.attributes.url;
      return res.status(200).json({
        success: true,
        message: 'Email verified and payment link created',
        paymentId: linkObj.id,
        paymentUrl: linkObj.attributes.url,
        checkoutUrl
      });
    }

    // Default success if link not created
    return res.status(200).json({ success: true, message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error processing request', error: error.message });
  }
});

// Route to resend verification code
router.post('/resend-verification-code', async (req, res) => {
  try {
    const { email } = req.body;
    
    if (!email) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email address is required' 
      });
    }
    
    // Remove any existing code
    emailService.verificationCodes.delete(email);
    
    // Send a new code
    const result = await emailService.sendVerificationCode(email);
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Verification code resent successfully',
        email: email,
        expiresIn: '5 minutes'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to resend verification code',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

// Route to send appointment details email
router.post('/send-appointment-details', async (req, res) => {
  try {
    // Use data from request body or fallback to hardcoded values
    const appointmentData = req.body || {
      fullName: 'Eleanor Agapito',
      gender: 'Female',
      email: 'eleanoragapito@gmail.com',
      dateOfBirth: 'February 21, 1960',
      contactNo: '+639123456789',
      address: 'Blk 1, Lot2, San Banda, Brgy. Gilid Gilid, Quezon City',
      reason: 'For Job Requirements',
      service: 'Blood Chemistry',
      procedure: 'Total Cholesterol',
      date: 'April 21, 2025',
      time: '8:00 AM - 9:00 AM',
      price: '₱300.00'
    };
    
    const result = await emailService.sendAppointmentConfirmation(appointmentData);
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Appointment confirmation email sent successfully',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send appointment confirmation email',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

// Simple GET endpoint to send verification code to default email
router.get('/test-verification-email', async (req, res) => {
  try {
    const result = await emailService.sendTestVerificationCode();
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Test verification code sent successfully to default email (johnkennypogitalaga@gmail.com)',
        expiresIn: '5 minutes'
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send test verification code',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

// Simple GET endpoint to send test appointment confirmation to default email
router.get('/test-appointment-email', async (req, res) => {
  try {
    // Use default appointment data for test
    const defaultAppointmentData = {
      fullName: 'Eleanor Agapito',
      gender: 'Female',
      email: 'johnkennypogitalaga@gmail.com', // Default test email
      dateOfBirth: 'February 21, 1960',
      contactNo: '+639123456789',
      address: 'Blk 1, Lot2, San Banda, Brgy. Gilid Gilid, Quezon City',
      reason: 'For Job Requirements',
      service: 'Blood Chemistry',
      procedure: 'Total Cholesterol',
      date: 'April 21, 2025',
      time: '8:00 AM - 9:00 AM',
      price: '₱300.00'
    };
    
    const result = await emailService.sendAppointmentConfirmation(defaultAppointmentData);
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Test appointment confirmation email sent successfully to default email (johnkennypogitalaga@gmail.com)',
        messageId: result.messageId
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to send test appointment email',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
  }
});

module.exports = router;