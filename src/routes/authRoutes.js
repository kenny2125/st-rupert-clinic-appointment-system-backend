const express = require('express');
const router = express.Router();
const supabase = require('../config/supabase');
const bcrypt = require('bcrypt');

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
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
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
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    const { data, error } = await supabase
      .from('admins')
      .insert({ email, password: hashedPassword, role });

    if (error) {
      return res.status(500).json({ success: false, message: 'Could not create user', error: error.message });
    }

    res.json({ success: true, message: 'User created', user: { email, role } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Creation error', error: err.message });
  }
});

// Verify admin password for secure logout
router.post('/verify-password', async (req, res) => {
  const { email, password } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('admins')
      .select('*')
      .eq('email', email)
      .single();
    
    if (error || !user) {
      return res.status(401).json({ 
        success: false, 
        message: 'User not found' 
      });
    }
    
    const passwordMatch = await bcrypt.compare(password, user.password);
    
    if (!passwordMatch) {
      return res.status(401).json({ 
        success: false, 
        message: 'Invalid password' 
      });
    }
    
    res.json({ 
      success: true, 
      message: 'Password verified successfully',
      data: { 
        email: user.email,
        role: user.role 
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Verification error', 
      error: err.message 
    });
  }
});

module.exports = router;