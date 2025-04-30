const express = require('express');
const router = express.Router();
const emailService = require('../services/emailService');


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
    const { email, code } = req.body;
    
    if (!email || !code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Email and verification code are required' 
      });
    }
    
    // Get stored verification data
    const verificationData = emailService.verificationCodes.get(email);
    
    if (!verificationData) {
      return res.status(400).json({ 
        success: false, 
        message: 'No verification code found for this email. Please request a new code.' 
      });
    }
    
    if (verificationData.expires < Date.now()) {
      // Remove expired code
      emailService.verificationCodes.delete(email);
      return res.status(400).json({ 
        success: false, 
        message: 'Verification code has expired. Please request a new code.' 
      });
    }
    
    if (verificationData.code !== code) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid verification code. Please try again.' 
      });
    }
    
    // Code is valid - remove it from map as it's been used
    emailService.verificationCodes.delete(email);
    
    res.status(200).json({ 
      success: true,
      message: 'Email verified successfully'
    });
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing request',
      error: error.message
    });
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