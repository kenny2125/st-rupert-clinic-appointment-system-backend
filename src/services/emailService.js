const nodemailer = require('nodemailer');

// Store verification codes temporarily (in a real app, use a database)
const verificationCodes = new Map();

// Email templates
const emailTemplates = {
  verificationCode: (verificationCode) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
      <h2 style="color: #0066cc; text-align: center;">St. Rupert's Medical Clinic</h2>
      <h3 style="text-align: center;">Verify your email address</h3>
      <p>Hello,</p>
      <p>Please enter the following verification code to verify your email address:</p>
      
      <div style="background-color: #f9f9f9; padding: 15px; border-radius: 5px; margin: 20px 0; text-align: center;">
        <h2 style="letter-spacing: 5px; font-size: 28px;">${verificationCode}</h2>
      </div>
      
      <p>The code will expire in 5 minutes.</p>
      <p>If you did not request this code, please ignore this email.</p>
      
      <p style="text-align: center; margin-top: 30px; color: #666;">This is an automated message, please do not reply.</p>
    </div>
  `,
  appointmentConfirmation: (data) => `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #ddd; padding: 20px; border-radius: 5px;">
      <div style="border-bottom: 2px dotted #0066cc; margin-bottom: 20px;">
        <h2 style="color: #0066cc; text-align: center;">SUMMARY</h2>
        <p style="text-align: center; color: #666;">Please review your details before your appointment</p>
      </div>
      
      <div style="display: flex; flex-wrap: wrap; border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 15px;">
        <div style="flex: 1; min-width: 250px; margin-right: 20px;">
          <h3 style="color: #0066cc;">BASIC INFORMATION</h3>
          <p><strong>Full Name:</strong> ${data.fullName || 'Eleanor Agapito'}</p>
          <p><strong>Gender:</strong> ${data.gender || 'Female'}</p>
          <p><strong>Email Address:</strong> ${data.email || 'eleanoragapito@gmail.com'}</p>
          <p><strong>Date of Birth:</strong> ${data.dateOfBirth || 'February 21, 1960'}</p>
          <p><strong>Contact No:</strong> ${data.contactNo || '+639123456789'}</p>
          <p><strong>Address:</strong> ${data.address || 'Blk 1, Lot2, San Banda, Brgy. Gilid Gilid, Quezon City'}</p>
          <p><strong>Reason:</strong> ${data.reason || 'For Job Requirements'}</p>
        </div>
        
        <div style="flex: 1; min-width: 250px;">
          <h3 style="color: #0066cc;">Appointment Information</h3>
          <p><strong>Service:</strong> ${data.service || 'Blood Chemistry'}</p>
          <p><strong>Procedure:</strong> ${data.procedure || 'Total Cholesterol'}</p>
          <p><strong>Price:</strong> ${data.price || '₱300.00'}</p>
          <p><strong>Appointment Time:</strong> ${data.time || '8:00 AM - 9:00 AM'}</p>
          <p><strong>Appointment Date:</strong> ${data.date || 'April 21, 2025'}</p>
        </div>
      </div>
      
      <p style="margin: 15px 0;">By receiving this email, you have read, understood and agreed to our Privacy Policy & Terms and Conditions.</p>
      
      <div style="display: flex; margin-top: 20px; justify-content: space-between;">
        <div style="text-align: center; width: 45%; background-color: #f5f5f5; padding: 10px; border-radius: 5px;">
          <p>Need to reschedule?</p>
          <p>Contact us at: +639123456789</p>
        </div>
        <div style="text-align: center; width: 45%; background-color: #0066cc; padding: 10px; border-radius: 5px; color: white;">
          <p>Appointment Confirmed</p>
          <p>Please arrive 15 minutes early</p>
        </div>
      </div>
      
      <p style="text-align: center; margin-top: 30px;">Thank you for choosing St. Rupert's Medical Clinic!</p>
    </div>
  `
};

// Create transporter for sending emails
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Function to generate a random 6-digit verification code
const generateVerificationCode = () => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

// Function to send verification code email
const sendVerificationCode = async (email) => {
  try {
    // Generate a new verification code
    const verificationCode = generateVerificationCode();
    
    // Store the code with an expiration time (5 minutes)
    verificationCodes.set(email, {
      code: verificationCode,
      expires: Date.now() + 5 * 60 * 1000 // 5 minutes in milliseconds
    });
    
    // Email content
    const mailOptions = {
      from: 'strupertmedicalclinic01@gmail.com',
      to: email,
      subject: 'St. Rupert\'s Medical Clinic - Verify Your Email Address',
      html: emailTemplates.verificationCode(verificationCode)
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Verification email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending verification email:', error);
    return { success: false, error: error.message };
  }
};

// Simple function to send a test verification code to a default email
const sendTestVerificationCode = async () => {
  const defaultEmail = 'johnkennypogitalaga@gmail.com'; // Default test email
  return await sendVerificationCode(defaultEmail);
};

// Function to send appointment confirmation email
const sendAppointmentConfirmation = async (appointmentData) => {
  try {
    // Email content
    const mailOptions = {
      from: 'strupertmedicalclinic01@gmail.com', // Sender email
      to: appointmentData.email || 'johnkennypogitalaga@gmail.com', // Default recipient email
      subject: 'St. Rupert\'s Medical Clinic - Appointment Confirmation',
      html: emailTemplates.appointmentConfirmation(appointmentData)
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error: error.message };
  }
};

// Clean up expired verification codes every 10 minutes
const setupVerificationCodeCleanup = () => {
  setInterval(() => {
    const now = Date.now();
    for (const [email, data] of verificationCodes.entries()) {
      if (data.expires < now) {
        verificationCodes.delete(email);
        console.log(`Deleted expired verification code for ${email}`);
      }
    }
  }, 10 * 60 * 1000);
};

module.exports = {
  sendVerificationCode,
  sendTestVerificationCode,
  sendAppointmentConfirmation,
  verificationCodes,
  setupVerificationCodeCleanup
};