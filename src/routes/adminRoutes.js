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
          .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
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

// Get total appointment count for dashboard
router.get('/total-appointments', async (req, res) => {
  try {
    // Count all appointments regardless of date or status
    const { count, error } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true });
    
    if (error) throw error;
    
    res.json({
      success: true,
      total: count
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch total appointments count', 
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
    
    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0]; 

    // Build appointment query
    let query = supabase.from('appointments').select('*', { count: 'exact' });
    if (status) query = query.eq('status', status);
    
    // Default to today's date if no start_date is provided
    query = query.gte('appointment_date', start_date || today);
    
    if (end_date) query = query.lte('appointment_date', end_date);
    
    // Handle search on basic_info fields by fetching matching ids
    if (search) {
      const { data: matched, error: matchErr } = await supabase
        .from('basic_info')
        .select('id')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,contact_no.ilike.%${search}%`);
      
      if (matchErr) throw matchErr;
      
      // Also search in procedure names
      const { data: matchedProcedures, error: procMatchErr } = await supabase
        .from('procedures')
        .select('id')
        .ilike('name', `%${search}%`);
        
      if (procMatchErr) throw procMatchErr;
      
      // If we have patient matches, filter by patient ids
      const ids = matched.map(b => b.id);
      
      if (ids.length > 0) {
        query = query.in('basic_info_id', ids);
      } 
      // If we have procedure matches, filter by procedure ids
      else if (matchedProcedures?.length > 0) {
        const procIds = matchedProcedures.map(p => p.id);
        query = query.in('procedure_id', procIds);
      }
      // If no matches found in patients or procedures, return empty result
      else {
        return res.json({ success: true, appointments: [], count: 0 });
      }
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
          .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
          .in('id', basicIds)
      : { data: [], error: null };
    if (basicErr) throw basicErr;

    // Fetch related procedures
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('*').in('id', procIds)
      : { data: [], error: null };
    if (procErr) throw procErr;

    // Enrich appointments and filter payment information
    const enriched = appointments.map(a => {
      // Create base appointment object with patient and procedure info
      const appointmentData = {
        ...a,
        basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
        procedure: procedures.find(p => p.id === a.procedure_id) || null,
      };
      
      // Only include payment info if payment_status is 'succeeded'
      if (a.payment_status !== 'succeeded') {
        delete appointmentData.payment_id;
        delete appointmentData.payment_status;
      }
      
      return appointmentData;
    });

    res.json({
      success: true,
      appointments: enriched,
      count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch appointments', error: err.message });
  }
});

// Get all appointments regardless of date or status
router.get('/all-appointments', async (req, res) => {
  try {
    // Extract query parameters for filtering
    const { sort = 'appointment_date', order = 'desc', search } = req.query;

    // Build appointment query without date filtering
    let query = supabase.from('appointments').select('*', { count: 'exact' });
    
    // Handle search on basic_info fields by fetching matching ids
    if (search) {
      const { data: matched, error: matchErr } = await supabase
        .from('basic_info')
        .select('id')
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,email.ilike.%${search}%,contact_no.ilike.%${search}%`);
      
      if (matchErr) throw matchErr;
      
      // Also search in procedure names
      const { data: matchedProcedures, error: procMatchErr } = await supabase
        .from('procedures')
        .select('id')
        .ilike('name', `%${search}%`);
        
      if (procMatchErr) throw procMatchErr;
      
      // If we have patient matches, filter by patient ids
      const ids = matched.map(b => b.id);
      
      if (ids.length > 0) {
        query = query.in('basic_info_id', ids);
      } 
      // If we have procedure matches, filter by procedure ids
      else if (matchedProcedures?.length > 0) {
        const procIds = matchedProcedures.map(p => p.id);
        query = query.in('procedure_id', procIds);
      }
      // If no matches found in patients or procedures, return empty result
      else {
        return res.json({ success: true, appointments: [], count: 0 });
      }
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
          .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
          .in('id', basicIds)
      : { data: [], error: null };
    if (basicErr) throw basicErr;

    // Fetch related procedures
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('*').in('id', procIds)
      : { data: [], error: null };
    if (procErr) throw procErr;

    // Enrich appointments and filter payment information
    const enriched = appointments.map(a => {
      // Create base appointment object with patient and procedure info
      const appointmentData = {
        ...a,
        basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
        procedure: procedures.find(p => p.id === a.procedure_id) || null,
      };
      
      // Only include payment info if payment_status is 'succeeded'
      if (a.payment_status !== 'succeeded') {
        delete appointmentData.payment_id;
        delete appointmentData.payment_status;
      }
      
      return appointmentData;
    });

    res.json({
      success: true,
      appointments: enriched,
      count
    });
  } catch (err) {
    res.status(500).json({ success: false, message: 'Failed to fetch all appointments', error: err.message });
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
      .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
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

    // Create the response object
    const appointmentData = { ...appointment, basic_info, procedure };
    
    // Only include payment info if payment_status is 'succeeded'
    if (appointment.payment_status !== 'succeeded') {
      delete appointmentData.payment_id;
      delete appointmentData.payment_status;
    }

    res.json({ success: true, appointment: appointmentData });
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

// Calendar API for appointments
router.get('/calendar', async (req, res) => {
  try {
    // Build appointment query to fetch all appointments
    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*')
      .neq('status', 'cancelled');  // removed payment_status filter
    if (error) throw error;

    // Fetch related procedures for title information
    const procIds = [...new Set(appointments.map(a => a.procedure_id))];
    const { data: procedures = [], error: procErr } = procIds.length
      ? await supabase.from('procedures').select('id,name').in('id', procIds)
      : { data: [], error: null };
    if (procErr) throw procErr;

    // Fetch related basic info for patient information
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase
          .from('basic_info')
          .select('id,first_name,last_name')
          .in('id', basicIds)
      : { data: [], error: null };
    if (basicErr) throw basicErr;

    // Format appointments for FullCalendar
    const calendarEvents = appointments.map(appointment => {
      const procedure = procedures.find(p => p.id === appointment.procedure_id);
      const patient = basicInfos.find(b => b.id === appointment.basic_info_id);
      
      // Create a formatted title with patient name and procedure
      const patientName = patient ? `${patient.first_name} ${patient.last_name}` : 'Unknown Patient';
      const procedureName = procedure ? procedure.name : 'Unknown Procedure';
      const title = `${patientName} - ${procedureName}`;
      
      // Calculate end time (start time + 1 hour)
      const startDateTime = `${appointment.appointment_date}T${appointment.appointment_time}`;
      
      // Parse the start time and add 1 hour to get the end time
      const startDate = new Date(`${appointment.appointment_date}T${appointment.appointment_time}`);
      const endDate = new Date(startDate);
      endDate.setHours(endDate.getHours() + 1);
      
      // Format the end time as ISO string and extract just the time part
      const endTime = endDate.toISOString().split('T')[1].substring(0, 8);
      const endDateTime = `${appointment.appointment_date}T${endTime}`;
      
      // Create calendar event object
      return {
        id: appointment.id,
        title: title,
        start: startDateTime,
        end: endDateTime,
        extendedProps: {
          status: appointment.status
        }
      };
    });

    res.json({
      success: true,
      events: calendarEvents
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch calendar events', 
      error: err.message 
    });
  }
});

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
      ? await supabase.from('basic_info').select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address').in('id', basicIds)
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

// Get tomorrow's appointments count for dashboard
router.get('/tomorrow-schedule-count', async (req, res) => {
  try {
    // Calculate tomorrow's date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Query count of appointments for tomorrow
    const { count, error } = await supabase
      .from('appointments')
      .select('*', { count: 'exact', head: true })
      .eq('appointment_date', tomorrowDate);
    
    if (error) throw error;
    
    res.json({
      success: true,
      count: count || 0
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tomorrow\'s appointment count', 
      error: err.message 
    });
  }
});

// Add a new route to get tomorrow's appointments
router.get('/tomorrow-schedule', async (req, res) => {
  try {
    // Calculate tomorrow's date
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowDate = tomorrow.toISOString().split('T')[0]; // Format as YYYY-MM-DD
    
    // Query appointments for tomorrow
    const { data: appointments, error, count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('appointment_date', tomorrowDate)
      .order('appointment_time', { ascending: true });
    
    if (error) throw error;
    
    // Fetch related basic_info entries
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase
          .from('basic_info')
          .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
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
    const tomorrowSchedule = appointments.map(a => ({
      ...a,
      basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
      procedure: procedures.find(p => p.id === a.procedure_id) || null,
    }));
    
    // Get counts for different statuses
    const statusCounts = {
      total: tomorrowSchedule.length,
      pending: tomorrowSchedule.filter(a => a.status === 'pending').length,
      complete: tomorrowSchedule.filter(a => a.status === 'complete').length,
      cancelled: tomorrowSchedule.filter(a => a.status === 'cancelled').length,
      checkedIn: tomorrowSchedule.filter(a => a.status === 'checked-in').length,
      inConsultation: tomorrowSchedule.filter(a => a.status === 'in_consultation').length
    };
    
    res.json({
      success: true,
      tomorrowSchedule,
      statusCounts
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch tomorrow\'s schedule', 
      error: err.message 
    });
  }
});

// Get appointment insights for dashboard
router.get('/appointment-insights', async (req, res) => {
  try {
    // Get the current date
    const today = new Date().toISOString().split('T')[0];
    
    // Get completion rate of past appointments
    const { data: statusStats, error: statusError } = await supabase
      .from('appointments')
      .select('status')
      .lt('appointment_date', today); // Only past appointments
    
    if (statusError) throw statusError;
    
    const totalPastAppointments = statusStats.length;
    const completedAppointments = statusStats.filter(a => a.status === 'complete').length;
    const cancelledAppointments = statusStats.filter(a => a.status === 'cancelled').length;
    const pendingAppointments = statusStats.filter(a => a.status === 'pending').length;
    
    // Count uncompleted (cancelled + pending) appointments
    const uncompletedAppointments = cancelledAppointments + pendingAppointments;
    
    const completionRate = totalPastAppointments > 0 
      ? Math.round((completedAppointments / totalPastAppointments) * 100) 
      : 0;
    
    // Calculate completion to uncompleted ratio (completed vs. cancelled + pending)
    const completionToUncompletedRatio = uncompletedAppointments > 0
      ? (completedAppointments / uncompletedAppointments).toFixed(2)
      : completedAppointments > 0 ? 'Inf' : '0';
    
    res.json({
      success: true,
      insights: {
        completionRate,
        completionToUncompletedRatio,
        statsDetail: {
          total: totalPastAppointments,
          completed: completedAppointments,
          cancelled: cancelledAppointments,
          pending: pendingAppointments,
          uncompleted: uncompletedAppointments
        }
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch appointment insights', 
      error: err.message 
    });
  }
});

// Get appointments for a specific date
router.get('/date-schedule/:date', async (req, res) => {
  try {
    const { date } = req.params; // Get the date parameter in YYYY-MM-DD format
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(date)) {
      return res.status(400).json({ 
        success: false, 
        message: 'Invalid date format. Please use YYYY-MM-DD format.' 
      });
    }
    
    // Query appointments for the specific date
    const { data: appointments, error, count } = await supabase
      .from('appointments')
      .select('*', { count: 'exact' })
      .eq('appointment_date', date)
      .order('appointment_time', { ascending: true });
    
    if (error) throw error;
    
    // Fetch related basic_info entries
    const basicIds = [...new Set(appointments.map(a => a.basic_info_id))];
    const { data: basicInfos = [], error: basicErr } = basicIds.length
      ? await supabase
          .from('basic_info')
          .select('id,first_name,last_name,email,contact_no,sex,age,date_of_birth,address')
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
    const dateSchedule = appointments.map(a => ({
      ...a,
      basic_info: basicInfos.find(b => b.id === a.basic_info_id) || null,
      procedure: procedures.find(p => p.id === a.procedure_id) || null,
    }));
    
    // Get counts for different statuses
    const statusCounts = {
      total: dateSchedule.length,
      pending: dateSchedule.filter(a => a.status === 'pending').length,
      complete: dateSchedule.filter(a => a.status === 'complete').length,
      cancelled: dateSchedule.filter(a => a.status === 'cancelled').length,
      checkedIn: dateSchedule.filter(a => a.status === 'checked-in').length,
      inConsultation: dateSchedule.filter(a => a.status === 'in_consultation').length
    };
    
    res.json({
      success: true,
      dateSchedule,
      statusCounts,
      date
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: `Failed to fetch schedule for the specified date`, 
      error: err.message 
    });
  }
});

// Get most common procedure for dashboard
router.get('/most-common-procedure', async (req, res) => {
  try {
    // Get the current date
    const today = new Date().toISOString().split('T')[0];
    
    // Query to find the most booked procedure
    const { data: procCounts, error } = await supabase
      .from('appointments')
      .select('procedure_id, count')
      .order('count', { ascending: false })
      .limit(1)
      .then(result => {
        // If direct count didn't work, we'll need to manually count
        if (result.error || !result.data || result.data.length === 0) {
          return supabase
            .from('appointments')
            .select('procedure_id')
            .neq('status', 'cancelled');
        }
        return result;
      });
    
    if (error) throw error;
    
    // If we got a pre-counted result
    if (procCounts[0]?.count) {
      const procId = procCounts[0].procedure_id;
      
      // Get procedure name
      const { data: procedure, error: procError } = await supabase
        .from('procedures')
        .select('name')
        .eq('id', procId)
        .single();
        
      if (procError) throw procError;
      
      return res.json({
        success: true,
        procedure: {
          name: procedure.name,
          count: procCounts[0].count
        }
      });
    }
    
    // If we need to manually count
    // Count occurrences of each procedure
    const procedureCounts = {};
    procCounts.forEach(appt => {
      if (!procedureCounts[appt.procedure_id]) {
        procedureCounts[appt.procedure_id] = 0;
      }
      procedureCounts[appt.procedure_id]++;
    });
    
    // Find the procedure with the highest count
    let maxCount = 0;
    let mostCommonProcId = null;
    
    Object.entries(procedureCounts).forEach(([procId, count]) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonProcId = procId;
      }
    });
    
    if (!mostCommonProcId) {
      return res.json({
        success: true,
        procedure: {
          name: 'No data available',
          count: 0
        }
      });
    }
    
    // Get procedure name
    const { data: procedure, error: procError } = await supabase
      .from('procedures')
      .select('name')
      .eq('id', mostCommonProcId)
      .single();
      
    if (procError) throw procError;
    
    res.json({
      success: true,
      procedure: {
        name: procedure.name,
        count: maxCount
      }
    });
  } catch (err) {
    res.status(500).json({ 
      success: false, 
      message: 'Failed to fetch most common procedure', 
      error: err.message 
    });
  }
});

module.exports = router;
