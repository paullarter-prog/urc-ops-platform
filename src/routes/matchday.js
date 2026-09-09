const express = require('express');
const { base, TABLES } = require('../airtable');
const { franchiseMatchesTeam } = require('../permissions');

const router = express.Router();

function serialize(record) {
  return { id: record.id, ...record.fields };
}

function canManageTeam(user, team) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Team Manager') return franchiseMatchesTeam(user.franchise, team);
  return false;
}

async function destroyInChunks(ids) {
  for (let i = 0; i < ids.length; i += 10) {
    await base(TABLES.MATCHDAY).destroy(ids.slice(i, i + 10));
  }
}

// GET /matchday?fixtureId=rec...&team=Leinster
router.get('/', async (req, res) => {
  try {
    const { fixtureId, team } = req.query;
    if (!fixtureId) return res.status(400).json({ error: 'fixtureId is required' });

    const records = await base(TABLES.MATCHDAY).select({}).all();
    const filtered = records.filter(
      (r) => (r.fields.Fixture || []).includes(fixtureId) && (!team || r.fields.Team === team)
    );
    res.json(filtered.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch matchday squad' });
  }
});

// POST /matchday - save a team's full 23-player matchday selection for a
// fixture. Replaces any existing selection for that fixture+team.
// body: { fixtureId, team, selections: [{ shirtNumber, position, playerId, captain, viceCaptain, coversLHP, coversHooker, coversTHP }] }
router.post('/', async (req, res) => {
  try {
    const { fixtureId, team, selections } = req.body;
    if (!fixtureId || !team || !Array.isArray(selections)) {
      return res.status(400).json({ error: 'fixtureId, team and selections are required' });
    }
    if (!canManageTeam(req.user, team)) {
      return res.status(403).json({ error: 'You can only select a matchday squad for your own team' });
    }

    const fixture = await base(TABLES.FIXTURES).find(fixtureId).catch(() => null);
    if (!fixture) return res.status(404).json({ error: 'Fixture not found' });
    if (![fixture.fields['Home Team'], fixture.fields['Away Team']].includes(team)) {
      return res.status(400).json({ error: 'Team is not playing in this fixture' });
    }

    const squadPlayers = await base(TABLES.PLAYERS)
      .select({ filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` })
      .all();
    const squadById = new Map(squadPlayers.map((p) => [p.id, p.fields]));

    for (const sel of selections) {
      if (sel.playerId && !squadById.has(sel.playerId)) {
        return res.status(400).json({ error: 'A selected player is not in this team\'s registered squad' });
      }
    }

    const existing = await base(TABLES.MATCHDAY).select({}).all();
    const toDelete = existing
      .filter((r) => (r.fields.Fixture || []).includes(fixtureId) && r.fields.Team === team)
      .map((r) => r.id);
    if (toDelete.length) await destroyInChunks(toDelete);

    const newRecords = selections
      .filter((s) => s.playerId)
      .map((s) => {
        const shirtNumber = Number(s.shirtNumber);
        const playerName = squadById.get(s.playerId)['Full Name'];
        return {
          fields: {
            Name: `${fixture.fields['Fixture Name']} — ${team} #${shirtNumber} ${playerName}`,
            Fixture: [fixtureId],
            Team: team,
            'Shirt Number': shirtNumber,
            Status: shirtNumber <= 15 ? 'Starting XV' : 'Bench',
            Position: s.position || undefined,
            Player: [s.playerId],
            Captain: !!s.captain,
            'Vice Captain': !!s.viceCaptain,
            'Covers LHP': !!s.coversLHP,
            'Covers Hooker': !!s.coversHooker,
            'Covers THP': !!s.coversTHP,
          },
        };
      });

    const created = [];
    for (let i = 0; i < newRecords.length; i += 10) {
      const chunk = await base(TABLES.MATCHDAY).create(newRecords.slice(i, i + 10), { typecast: true });
      created.push(...chunk);
    }
    res.status(201).json(created.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save matchday squad' });
  }
});

module.exports = router;
