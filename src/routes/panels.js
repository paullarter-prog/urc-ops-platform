const express = require('express');
const { base, TABLES } = require('../airtable');
const { applyTransition } = require('../panelWorkflow');

const router = express.Router();

// A "panel" is the set of Appointment records linked to one Fixture, plus
// that fixture's Panel Status field. There's no separate Panels table.

// GET /panels/:fixtureId - panel status and its appointments
router.get('/:fixtureId', async (req, res) => {
  try {
    const fixture = await base(TABLES.FIXTURES).find(req.params.fixtureId);
    const allAppointments = await base(TABLES.APPOINTMENTS).select({}).all();
    const appointments = allAppointments
      .filter((r) => (r.fields.Fixture || []).includes(req.params.fixtureId))
      .map((r) => ({ id: r.id, ...r.fields }));

    res.json({
      fixtureId: fixture.id,
      fixtureName: fixture.fields['Fixture Name'],
      panelStatus: fixture.fields['Panel Status'] || 'Draft',
      appointments,
    });
  } catch (err) {
    console.error(err);
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.status(500).json({ error: 'Failed to fetch panel' });
  }
});

async function transition(req, res, action) {
  try {
    const fixture = await base(TABLES.FIXTURES).find(req.params.fixtureId);
    const currentStatus = fixture.fields['Panel Status'] || 'Draft';
    const result = applyTransition(currentStatus, action);
    if (!result.ok) {
      return res.status(409).json({ error: result.error });
    }

    const updated = await base(TABLES.FIXTURES).update([
      { id: fixture.id, fields: { 'Panel Status': result.status } },
    ]);
    res.json({ fixtureId: updated[0].id, panelStatus: updated[0].fields['Panel Status'] });
  } catch (err) {
    console.error(err);
    if (err.statusCode === 404) {
      return res.status(404).json({ error: 'Fixture not found' });
    }
    res.status(500).json({ error: `Failed to ${action} panel` });
  }
}

// POST /panels/:fixtureId/submit  - Draft -> Submitted (Booker)
// POST /panels/:fixtureId/review  - Submitted -> Under Review (Manager opens it)
// POST /panels/:fixtureId/approve - Submitted/Under Review -> Approved (Manager)
// POST /panels/:fixtureId/reject  - Submitted/Under Review -> Draft (Manager)
// POST /panels/:fixtureId/send    - Approved -> Sent to Officials (Booker)
router.post('/:fixtureId/submit', (req, res) => transition(req, res, 'submit'));
router.post('/:fixtureId/review', (req, res) => transition(req, res, 'review'));
router.post('/:fixtureId/approve', (req, res) => transition(req, res, 'approve'));
router.post('/:fixtureId/reject', (req, res) => transition(req, res, 'reject'));
router.post('/:fixtureId/send', (req, res) => transition(req, res, 'send'));

module.exports = router;
