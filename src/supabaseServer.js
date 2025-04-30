const express = require('express');
const supabase = require('./config/supabase');

const router = express.Router();
const port = process.env.PORT || 3000;

// Example route to fetch data from Supabase
router.get('/data', async (req, res) => {
  const { data, error } = await supabase
    .from('test_table')
    .select('*');

  if (error) {
    return res.status(500).json({ error: error.message });
  }

  res.json(data);
});

// Export router to be mounted in main app
module.exports = router;