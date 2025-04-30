require('dotenv').config();

const express = require('express');
const cors = require('cors'); 
const emailRoutes = require('./routes/emailRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const adminRoutes = require('./routes/adminRoutes');
const emailService = require('./services/emailService');
const supabaseRouter = require('./supabaseServer');
const app = express();
const PORT = process.env.PORT || 3000; 


app.use(express.json());
app.use(cors());


emailService.setupVerificationCodeCleanup();


app.get('/', (req, res) => {
  res.json({ message: 'Welcome mga skibidi!' });
});


app.use('/api/email', emailRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/appointment', appointmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/supabase', supabaseRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});