const express = require('express');
const router = express.Router();
const paymentService = require('../services/paymentService');


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
    
    if (result.success) {
      res.status(200).json({ 
        success: true,
        message: 'Payment link created successfully',
        data: result.data
      });
    } else {
      res.status(500).json({ 
        success: false,
        message: 'Failed to create payment link',
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

module.exports = router;