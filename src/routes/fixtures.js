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

// POST /fixtures - create a fixture
// body: { homeTeam, awayTeam, date, kickoffTime, venue, round }
router.post('/', async (req, res) => {
  try {
    const { homeTeam, awayTeam, date, kickoffTime, venue, round } = req.body;

    if (!homeTeam || !awayTeam || !date || !round) {
      return res.status(400).json({ error: 'homeTeam, awayTeam, date and round are required' });
    }

    const fields = {
      'Fixture Name': `R${round}: ${homeTeam} v ${awayTeam}`,
      'Home Team': homeTeam,
      'Away Team': awayTeam,
      Date: date,
      Round: Number(round),
      Status: 'Scheduled',
    };
    if (kickoffTime) fields['Kickoff Time'] = kickoffTime;
    if (venue) fields.Venue = venue;

    const created = await base(TABLES.FIXTURES).create([{ fields }], { typecast: true });
    res.status(201).json({ id: created[0].id, ...created[0].fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create fixture' });
  }
});

module.exports = router;
