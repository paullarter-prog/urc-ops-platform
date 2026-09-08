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

// POST /officials - create a new official
// body: { name, role, email, phone, homeUnion }
router.post('/', async (req, res) => {
  try {
    const { name, role, email, phone, homeUnion } = req.body;

    if (!name || !role) {
      return res.status(400).json({ error: 'name and role are required' });
    }

    const fields = { Name: name, Role: role, Availability: 'Available' };
    if (email) fields.Email = email;
    if (phone) fields.Phone = phone;
    if (homeUnion) fields['Home Union'] = homeUnion;

    const created = await base(TABLES.OFFICIALS).create([{ fields }], { typecast: true });
    res.status(201).json({ id: created[0].id, ...created[0].fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create official' });
  }
});

// GET /officials/:id/history - this official's past appointments, most recent
// first. Each entry carries the fixture's teams/date so a caller can work out
// "how many times with team X" / "when did they last officiate team X"
// (the doc's conflict-flag feature) without a separate per-team endpoint.
router.get('/:id/history', async (req, res) => {
  try {
    const officialId = req.params.id;
    const [appointments, fixtures] = await Promise.all([
      base(TABLES.APPOINTMENTS).select({}).all(),
      base(TABLES.FIXTURES).select({}).all(),
    ]);

    const fixturesById = {};
    for (const f of fixtures) fixturesById[f.id] = f.fields;

    const history = appointments
      .filter((a) => (a.fields.Official || []).includes(officialId))
      .map((a) => {
        const fixtureId = (a.fields.Fixture || [])[0];
        const fixture = fixturesById[fixtureId] || {};
        return {
          fixtureId,
          fixtureName: fixture['Fixture Name'] || null,
          round: fixture.Round ?? null,
          homeTeam: fixture['Home Team'] || null,
          awayTeam: fixture['Away Team'] || null,
          date: fixture.Date || null,
          role: a.fields.Role || null,
          appointmentStatus: a.fields['Appointment Status'] || null,
        };
      })
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));

    res.json(history);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch official history' });
  }
});

module.exports = router;
