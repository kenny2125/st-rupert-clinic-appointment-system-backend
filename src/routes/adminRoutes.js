const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

// Role check middleware
function checkRole(allowedRoles) {
  return (req, res, next) => {
    const { role } = req.body;
    if (!role || !allowedRoles.includes(role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient role' });
    }
    next();
  };
}

// Admin API for dashboard insights

router.get('/dashboard-insights', (req, res) => {
  res.json({ success: true, data: {} });
});

// Admin API for appointment list CRUD
router.get('/appointments', (req, res) => {
  res.json({ success: true, appointments: [] });
});
router.get('/appointments/:id', (req, res) => {
  res.json({ success: true, appointment: {} });
});
router.post('/appointments', (req, res) => {
  res.json({ success: true, message: 'Appointment created' });
});
router.put('/appointments/:id', (req, res) => {
  res.json({ success: true, message: 'Appointment updated' });
});
router.delete('/appointments/:id', (req, res) => {
  res.json({ success: true, message: 'Appointment deleted' });
});

// Admin API for archival of appointment list CRUD
router.get('/archived-appointments', (req, res) => {
  res.json({ success: true, archived: [] });
});
router.get('/archived-appointments/:id', (req, res) => {
  res.json({ success: true, archivedAppointment: {} });
});
router.post('/archived-appointments', (req, res) => {
  res.json({ success: true, message: 'Archived appointment created' });
});
router.put('/archived-appointments/:id', (req, res) => {
  res.json({ success: true, message: 'Archived appointment updated' });
});
router.delete('/archived-appointments/:id', (req, res) => {
  res.json({ success: true, message: 'Archived appointment deleted' });
});

// Admin login (with DB lookup)
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  try {
    const { data: user, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();
    if (error || !user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Compare hashed password
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
    // Optionally update last_login timestamp
    await supabase
      .from('admins')
      .update({ last_login: new Date() })
      .eq('id', user.id);
    res.json({ success: true, message: 'Admin logged in', data: { email: user.email, role: user.role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Login error', error: err.message });
  }
});

// Register new admin user
router.post('/register', async (req, res) => {
  const { email, password, role } = req.body;
  try {
    // Hash the password before storing
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);
    
    const { data, error } = await supabase
      .from('admins')
      .insert({ email, password: hashedPassword, role });
    
    if (error) {
      return res.status(500).json({ success: false, message: 'Could not create user', error: error.message });
    }
    
    // Simply return success with the provided data
    res.json({ 
      success: true, 
      message: 'User created', 
      user: { email, role } 
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Creation error', error: err.message });
  }
});

module.exports = router;
