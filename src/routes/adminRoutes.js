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

// Endpoint to get today's appointments for dashboard
router.get('/today-schedule', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0]; // Get today's date in YYYY-MM-DD format
    
    // Query appointments for today
    const { data: appointments, error, count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('appointment_date', today)
      .order('appointment_time', { ascending: true });
    
    if (error) throw error;
    
    // Fetch related basic_info entries
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase
          .from('basic_info')
          .select('id,first_name,last_name,email,contact_no,sex,age')
          .in('id', basicIds)
      : { data: [], error: null };
    
    if (basicErr) throw basicErr;
    
    // Fetch related procedures
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('*').in('id', procIds)
      : { data: [], error: null };
    
    if (procErr) throw procErr;
    
    // Enrich appointments with patient and procedure info
    const todaySchedule = appointments.map(a => ({
      ...a,
      basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
      procedure: procedures.find(p => p.id === a.procedure_id) || null,
    }));
    
    // Get counts for different statuses
    const statusCounts = {
      total: todaySchedule.length,
      pending: todaySchedule.filter(a => a.status === 'pending').length,
      complete: todaySchedule.filter(a => a.status === 'complete').length,
      cancelled: todaySchedule.filter(a => a.status === 'cancelled').length,
      checkedIn: todaySchedule.filter(a => a.status === 'checked-in').length,
      inConsultation: todaySchedule.filter(a => a.status === 'in_consultation').length
    };
    
    res.json({
      success: true,
      todaySchedule,
      statusCounts
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch today\'s schedule', 
      error: err.message 
    });
  }
});

// Admin API for appointment list CRUD

// Done
router.get('/appointments', async (req, res) => {
  try {
    // Extract query parameters for filtering (not pagination)
    const { sort = 'appointment_date', order = 'desc', status, search, start_date, end_date } = req.query;

    // Build appointment query
    let query = supabase.from('appointments').select('*', { count: 'exact' });
    if (status) query = query.eq('status', status);
    if (start_date) query = query.gte('appointment_date', start_date);
    if (end_date) query = query.lte('appointment_date', end_date);
    // Handle search on basic_info fields by fetching matching ids
    if (search) {
      const { data: matched, error: matchErr } = await supabase
        .from('basic_info')
        .select('id')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,contact_no.ilike.%${search}%`);
      if (matchErr) throw matchErr;
      const ids = matched.map(b => b.id);
      if (ids.length) query = query.in('basic_info_id', ids);
      else return res.json({ success: true, appointments: [], count: 0 });
    }

    // Fetch all appointments (no pagination)
    const { data: appointments, error, count } = await query
      .order(sort, { ascending: order === 'asc' });
    if (error) throw error;

    // Fetch related basic_info entries
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase
          .from('basic_info')
          .select('id,first_name,last_name,email,contact_no,sex,age')
          .in('id', basicIds)
      : { data: [], error: null };
    if (basicErr) throw basicErr;

    // Fetch related procedures
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('*').in('id', procIds)
      : { data: [], error: null };
    if (procErr) throw procErr;

    // Enrich appointments
    const enriched = appointments.map(a => ({
      ...a,
      basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
      procedure: procedures.find(p => p.id === a.procedure_id) || null,
    }));

    res.json({
      success: true,
      appointments: enriched,
      count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: err.message });
  }
});

//Done
router.get('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) {
      if (error.code === 'PGRST116') return res.status(404).json({ success: false, message: 'Appointment not found' });
      throw error;
    }

    // Fetch related basic_info
    const { data: basic_info, error: basicErr } = await supabase
      .from('basic_info')
      .select('id,first_name,last_name,email,contact_no,sex,age')
      .eq('id', appointment.basic_info_id)
      .single();
    if (basicErr) throw basicErr;

    // Fetch related procedure
    const { data: procedure, error: procErr } = await supabase
      .from('procedures')
      .select('*')
      .eq('id', appointment.procedure_id)
      .single();
    if (procErr) throw procErr;

    res.json({ success: true, appointment: { ...appointment, basic_info, procedure } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointment', error: err.message });
  }
});


// Done
router.delete('/appointments/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    // Check if appointment exists
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('id')
      .eq('id', id)
      .single();
    
    if (fetchError) {
      if (fetchError.code === 'PGRST116') {
        return res.status(404).json({ 
          success: false, 
          message: 'Appointment not found' 
        });
      }
      throw fetchError;
    }
    
    // Delete the appointment
    const { error: deleteError } = await supabase
      .from('appointments')
      .delete()
      .eq('id', id);
    
    if (deleteError) throw deleteError;
    
    res.json({ 
      success: true, 
      message: 'Appointment deleted successfully',
      id
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to delete appointment', 
      error: err.message 
    });
  }
});

// Update appointment status - DOne
router.patch('/appointments/:id/status', async (req, res) => {
  const { id } = req.params;
  const { status } = req.body;
  const allowed = ['pending','checked-in','in_consultation','complete','cancelled'];
  if (!allowed.includes(status)) {
    return res.status(400).json({ success: false, message: 'Invalid status value' });
  }
  try {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .single();
    if (error) throw error;
    res.json({ success: true, appointment: data });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to update status', error: err.message });
  }
});

// Admin API for archival of appointment list (read-only history)
router.get('/archived-appointments', async (req, res) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: appointments, error, count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .lt('appointment_date', today)
      .order('appointment_date', { ascending: false });
    if (error) throw error;

    // Fetch related basic_info
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase.from('basic_info').select('id,first_name,last_name,email,contact_no,sex,age').in('id', basicIds)
      : { data: [], error: null };
    if (basicErr) throw basicErr;

    // Fetch related procedures
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('*').in('id', procIds)
      : { data: [], error: null };
    if (procErr) throw procErr;

    // Enrich appointments
    const archived = appointments.map(a => ({
      ...a,
      basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
      procedure: procedures.find(p => p.id === a.procedure_id) || null,
    }));

    res.json({ success: true, archived });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch archived appointments', error: err.message });
  }
});

router.get('/archived-appointments/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const { data: appointment, error } = await supabase
      .from('appointments')
      .select('*')
      .eq('id', id)
      .single();
    if (error) throw error;
    const today = new Date().toISOString().split('T')[0];
    if (appointment.appointment_date >= today) {
      return res.status(404).json({ success: false, message: 'Archived appointment not found' });
    }

    // Fetch related basic_info
    const { data: basic_info, error: basicErr } = await supabase
      .from('basic_info')
      .select('id,first_name,last_name,email,contact_no,sex,age')
      .eq('id', appointment.basic_info_id)
      .single();
    if (basicErr) throw basicErr;

    // Fetch related procedure
    const { data: procedure, error: procErr } = await supabase
      .from('procedures')
      .select('*')
      .eq('id', appointment.procedure_id)
      .single();
    if (procErr) throw procErr;

    res.json({ success: true, archivedAppointment: { ...appointment, basic_info, procedure } });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch archived appointment', error: err.message });
  }
});

// Disable create/update/delete on archived records
router.post('/archived-appointments', (req, res) =>
  res.status(405).json({ success: false, message: 'Archived records are read-only' })
);
router.put('/archived-appointments/:id', (req, res) =>
  res.status(405).json({ success: false, message: 'Archived records are read-only' })
);
router.delete('/archived-appointments/:id', (req, res) =>
  res.status(405).json({ success: false, message: 'Archived records are read-only' })
);

module.exports = router;
