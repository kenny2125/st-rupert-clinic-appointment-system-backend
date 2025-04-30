const fetch = require('node-fetch');

/**
 * Creates a payment link using PayMongo API
 * @param {Object} paymentData - Payment information
 * @param {number} paymentData.amount - Amount in smallest currency unit (e.g., cents for PHP)
 * @param {string} paymentData.description - Description of the payment
 * @param {string} paymentData.name - Customer name
 * @param {string} paymentData.email - Customer email
 * @returns {Promise<Object>} - Response from PayMongo API
 */
const createPaymentLink = async (paymentData) => {
  try {
    const { amount, description, name, email } = paymentData;
    
    // PayMongo expects amount in smallest currency unit (centavos for PHP)
    // so ₱100 = 10000 centavos
    const amountInCentavos = amount * 100;
    
    const url = 'https://api.paymongo.com/v1/links';
    const options = {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Basic ${Buffer.from(process.env.PAYMONGO_SECRET_KEY + ':').toString('base64')}`
      },
      body: JSON.stringify({
        data: {
          attributes: {
            amount: amountInCentavos,
            description: description,
            remarks: "St. Rupert's Medical Clinic Appointment",
            currency: "PHP",
            billing: {
              name: name,
              email: email
            }
          }
        }
      })
    };

    const response = await fetch(url, options);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(`PayMongo API error: ${data.errors?.[0]?.detail || 'Unknown error'}`);
    }
    
    return {
      success: true,
      data: data
    };
  } catch (error) {
    console.error('Error creating payment link:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

/**
 * Creates a test payment link with default data
 * @returns {Promise<Object>} - Response from PayMongo API
 */
const createTestPaymentLink = async () => {
  const defaultPaymentData = {
    amount: 300, // ₱300.00
    description: "St. Rupert's Medical Clinic - Blood Chemistry Test",
    name: "Eleanor Agapito",
    email: "johnkennypogitalaga@gmail.com"
  };
  
  return await createPaymentLink(defaultPaymentData);
};

/**
 * Verifies and parses PayMongo webhook payload
 * @param {object} req - Express request object with raw body
 * @returns {object} Parsed event payload
 */
function verifyWebhook(req) {
  // Handle raw buffer or already-parsed JSON body
  if (Buffer.isBuffer(req.body)) {
    return JSON.parse(req.body.toString());
  }
  return req.body;
}



module.exports = {
  createPaymentLink,
  createTestPaymentLink,
  verifyWebhook,
};