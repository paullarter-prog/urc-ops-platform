const express = require('express');
const { base, TABLES } = require('../airtable');
const { isEligible } = require('../rulesEngine');

const router = express.Router();

// GET /appointments - list all panel appointments
router.get('/', async (req, res) => {
  try {
    const records = await base(TABLES.APPOINTMENTS).select({}).all();
    const appointments = records.map((r) => ({ id: r.id, ...r.fields }));
    res.json(appointments);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch appointments' });
  }
});

// POST /appointments - create a new appointment
// body: { name, status, notes, fixtureId, officialId, role }
// role is the panel slot being filled (e.g. 'Referee', 'AR1'); defaults to the
// official's own Role. Rejected with 400 if the official isn't eligible for
// that role on this fixture (neutral/home-union rules engine).
router.post('/', async (req, res) => {
  try {
    const { name, status, notes, fixtureId, officialId, role } = req.body;

    if (!fixtureId || !officialId) {
      return res.status(400).json({ error: 'fixtureId and officialId are required' });
    }

    const [fixture, official] = await Promise.all([
      base(TABLES.FIXTURES).find(fixtureId),
      base(TABLES.OFFICIALS).find(officialId),
    ]);

    const appointedRole = role || official.fields.Role;
    const check = isEligible(official.fields, appointedRole, fixture.fields);
    if (!check.eligible) {
      return res.status(400).json({ error: check.reason });
    }

    const appointmentName = name || `${fixture.fields['Fixture Name']} - ${appointedRole}`;

    const created = await base(TABLES.APPOINTMENTS).create(
      [
        {
          fields: {
            'Appointment Name': appointmentName,
            'Appointment Status': status || 'Proposed',
            Role: appointedRole,
            Notes: notes || '',
            Fixture: [fixtureId],
            Official: [officialId],
          },
        },
      ],
      { typecast: true }
    );
    res.status(201).json({ id: created[0].id, ...created[0].fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create appointment' });
  }
});

// DELETE /appointments/:id - remove an appointment (e.g. to clear/reassign a panel slot)
router.delete('/:id', async (req, res) => {
  try {
    await base(TABLES.APPOINTMENTS).destroy([req.params.id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to delete appointment' });
  }
});

// PATCH /appointments/:id - update status/notes
router.patch('/:id', async (req, res) => {
  try {
    const { status, notes } = req.body;
    const fields = {};
    if (status) fields['Appointment Status'] = status;
    if (notes !== undefined) fields.Notes = notes;

    const updated = await base(TABLES.APPOINTMENTS).update([
      { id: req.params.id, fields },
    ]);
    res.json({ id: updated[0].id, ...updated[0].fields });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update appointment' });
  }
});

module.exports = router;
