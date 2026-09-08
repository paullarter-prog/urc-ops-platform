const express = require('express');
const { base, TABLES } = require('../airtable');

const router = express.Router();

// GET /fixtures - list all fixtures
router.get('/', async (req, res) => {
  try {
    const records = await base(TABLES.FIXTURES).select({}).all();
    const fixtures = records.map((r) => ({ id: r.id, ...r.fields }));
    res.json(fixtures);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch fixtures' });
  }
});

// GET /fixtures/:id - single fixture
router.get('/:id', async (req, res) => {
  try {
    const record = await base(TABLES.FIXTURES).find(req.params.id);
    res.json({ id: record.id, ...record.fields });
  } catch (err) {
    console.error(err);
    res.status(404).json({ error: 'Fixture not found' });
  }
});

module.exports = router;
