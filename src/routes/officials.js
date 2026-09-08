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
