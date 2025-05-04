const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');
const supabase = require('../config/supabase');
const emailService = require('../services/emailService');

// Update create endpoint to save payment link data
router.post('/create-payment-link', async (req, res) => {
  try {
    const { amount, description, name, email } = req.body;
    
    if (!amount || !description) {
      return res.status(400).json({ 
        success: false, 
        message: 'Amount and description are required' 
      });
    }
    
    const paymentData = {
      amount: Number(amount),
      description,
      name: name || 'Patient',
      email: email || 'patient@example.com'
    };
    
    const result = await paymentService.createPaymentLink(paymentData);
    const { appointmentId } = req.body;
    if (!appointmentId) {
      return res.status(400).json({ success: false, message: 'appointmentId is required' });
    }
    if (result.success) {
      const linkObj = result.data.data;
      // Save payment_id and payment_url
      await supabase
        .from('appointments')
        .update({ payment_id: linkObj.id, payment_url: linkObj.attributes.url })
        .eq('id', appointmentId);
      // Extract checkout URL if provided by PayMongo
      const checkoutUrl = linkObj.attributes.checkout_url || linkObj.attributes.url;
      res.status(200).json({ 
        success: true,
        message: 'Payment link created successfully',
        paymentId: linkObj.id,
        paymentUrl: linkObj.attributes.url,
        checkoutUrl: checkoutUrl
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing payment request',
      error: error.message
    });
  }
});


router.get('/test-payment-link', async (req, res) => {
  try {
    const result = await paymentService.createTestPaymentLink();
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Test payment link created successfully',
        data: result.data
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to create test payment link',
        error: result.error
      });
    }
  } catch (error) {
    res.status(500).json({ 
      success: false,
      message: 'Error processing payment request',
      error: error.message
    });
  }
});

// Webhook to handle PayMongo payment events
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const event = paymentService.verifyWebhook(req);
  // Log the full webhook event for inspection
  console.log('Webhook event received:', JSON.stringify(event, null, 2));

  // Only process PayMongo Link payments
  if (event.data?.attributes?.type === 'link.payment.paid') {
    const resource = event.data.attributes.data;
    const linkId = resource.id;

    // Update appointment status to succeeded
    const { data: appt, error: apptError } = await supabase
      .from('appointments')
      .update({ payment_status: 'succeeded' })
      .eq('payment_id', linkId)
      .select('*, basic_info(*)')
      .single();

    if (!apptError && appt) {
      // Fetch procedure details
      const { data: proc, error: procError } = await supabase
        .from('procedures')
        .select('name, service_id')
        .eq('id', appt.procedure_id)
        .single();
      let serviceName = null;
      if (!procError && proc) {
        // Fetch service name
        const { data: serv, error: servError } = await supabase
          .from('services')
          .select('name')
          .eq('id', proc.service_id)
          .single();
        if (!servError && serv) serviceName = serv.name;
      }
      // Send confirmation email with names
      await emailService.sendAppointmentConfirmation({
        fullName: `${appt.basic_info.first_name} ${appt.basic_info.last_name}`,
        gender: appt.basic_info.sex,
        email: appt.basic_info.email,
        dateOfBirth: appt.basic_info.date_of_birth,
        contactNo: appt.basic_info.contact_no,
        address: appt.basic_info.address,
        reason: appt.basic_info.reason,
        service: serviceName,
        procedure: proc ? proc.name : null,
        date: appt.appointment_date,
        time: appt.appointment_time,
        price: null
      });
    }
  }

  res.sendStatus(200);
});

module.exports = router;