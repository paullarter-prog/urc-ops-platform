const express = require('express');
const multer = require('multer');
const { base, TABLES } = require('../airtable');
const { teamsheetDeadline } = require('../deadline');
const { franchiseMatchesTeam } = require('../permissions');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

async function findTeamsheet(fixtureId, team) {
  const records = await base(TABLES.TEAMSHEETS)
    .select({ filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` })
    .all();
  return records.find((r) => (r.fields.Fixture || []).includes(fixtureId));
}

async function uploadAttachment(recordId, fieldId, file) {
  const res = await fetch(
    `https://content.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}/${recordId}/${fieldId}/uploadAttachment`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.AIRTABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contentType: file.mimetype,
        file: file.buffer.toString('base64'),
        filename: file.originalname,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Attachment upload failed: ${res.status} ${text}`);
  }
  return res.json();
}

// GET /teamsheets?fixtureIds=recA,recB - submission status for a set of fixtures
router.get('/', async (req, res) => {
  try {
    const fixtureIds = (req.query.fixtureIds || '').split(',').filter(Boolean);
    if (fixtureIds.length === 0) return res.json([]);

    const records = await base(TABLES.TEAMSHEETS).select({}).all();
    const relevant = records.filter((r) =>
      (r.fields.Fixture || []).some((id) => fixtureIds.includes(id))
    );

    const teamsheets = relevant.map((r) => {
      const file = (r.fields.File || [])[0];
      return {
        id: r.id,
        fixtureId: (r.fields.Fixture || [])[0],
        team: r.fields.Team,
        status: r.fields.Status,
        submittedAt: r.fields['Submitted At'],
        file: file ? { url: file.url, filename: file.filename } : null,
      };
    });
    res.json(teamsheets);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch teamsheets' });
  }
});

// POST /teamsheets - multipart: fixtureId, team, file
router.post('/', upload.single('file'), async (req, res) => {
  try {
    const { fixtureId, team } = req.body;
    if (!fixtureId || !team || !req.file) {
      return res.status(400).json({ error: 'fixtureId, team and file are required' });
    }

    const fixture = await base(TABLES.FIXTURES).find(fixtureId).catch(() => null);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });

    const validTeam = [fixture.fields['Home Team'], fixture.fields['Away Team']].includes(team);
    if (!validTeam) {
      return res.status(400).json({ error: 'Team is not playing in this fixture' });
    }

    const { role, franchise } = req.user;
    if (role === 'Club Ops') {
      if (!franchiseMatchesTeam(franchise, team)) {
        return res.status(403).json({ error: 'You can only submit a teamsheet for your own team' });
      }
    } else if (role !== 'Admin') {
      return res.status(403).json({ error: 'Not authorized to submit teamsheets' });
    }

    if (role !== 'Admin' && Date.now() > teamsheetDeadline(fixture.fields.Date).getTime()) {
      return res.status(403).json({ error: 'The submission window for this fixture has closed' });
    }

    const nowISO = new Date().toISOString();
    let record = await findTeamsheet(fixtureId, team);

    if (record) {
      const [updated] = await base(TABLES.TEAMSHEETS).update([
        {
          id: record.id,
          fields: {
            Status: 'Submitted',
            'Submitted By': [req.user.sub],
            'Submitted At': nowISO,
            File: [],
          },
        },
      ]);
      record = updated;
    } else {
      const [created] = await base(TABLES.TEAMSHEETS).create(
        [
          {
            fields: {
              Name: `${fixture.fields['Fixture Name']} — ${team}`,
              Fixture: [fixtureId],
              Team: team,
              Status: 'Submitted',
              'Submitted By': [req.user.sub],
              'Submitted At': nowISO,
            },
          },
        ],
        { typecast: true }
      );
      record = created;
    }

    await uploadAttachment(record.id, 'fldjsiOFFtfQzJRYJ', req.file);
    const final = await base(TABLES.TEAMSHEETS).find(record.id);
    const file = (final.fields.File || [])[0];

    res.status(201).json({
      id: final.id,
      fixtureId,
      team,
      status: final.fields.Status,
      submittedAt: final.fields['Submitted At'],
      file: file ? { url: file.url, filename: file.filename } : null,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit teamsheet' });
  }
});

module.exports = router;
