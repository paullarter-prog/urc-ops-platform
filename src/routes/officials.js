const express = require('express');
const { base, TABLES } = require('../airtable');

const router = express.Router();

// GET /officials - list all officials
router.get('/', async (req, res) => {
  try {
    const records = await base(TABLES.OFFICIALS).select({}).all();
    const officials = records.map((r) => ({ id: r.id, ...r.fields }));
    res.json(officials);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch officials' });
  }
});

// GET /officials/:id
router.get('/:id', async (req, res) => {
  try {
    const record = await base(TABLES.OFFICIALS).find(req.params.id);
    res.json({ id: record.id, ...record.fields });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Official not found' });
  }
});

module.exports = router;
