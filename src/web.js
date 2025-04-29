require('dotenv').config();

const express = require('express');
const cors = require('cors'); 
const emailRoutes = require('./routes/emailRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const emailService = require('./services/emailService');
const app = express();
const PORT = process.env.PORT || 3000; 


app.use(express.json());
app.use(cors());


emailService.setupVerificationCodeCleanup();


app.get('/', (req, res) => {
  res.json({ message: 'Welcome mga skibidi!' });
});


app.use('/api', emailRoutes);
app.use('/api/payment', paymentRoutes);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});