const express = require('express');
const { base, TABLES } = require('../airtable');
const { TEAM_NAMES, franchiseMatchesTeam, resolveTeamName } = require('../permissions');

const router = express.Router();
const SQUAD_CAP = 70;

function serialize(record) {
  return { id: record.id, ...record.fields };
}

function canManageTeam(user, team) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Club Ops') return franchiseMatchesTeam(user.franchise, team);
  return false;
}

// GET /players?team=Leinster - list a team's squad. Club Ops is always scoped
// to their own team regardless of the query param; Admin/Official/Viewer can
// request any team, or all players if none is given.
router.get('/', async (req, res) => {
  try {
    let team = req.query.team;
    if (req.user.role === 'Club Ops') {
      team = resolveTeamName(req.user.franchise);
      if (!team) return res.json([]);
    }

    const selectOpts = team
      ? { filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` }
      : {};
    const records = await base(TABLES.PLAYERS).select(selectOpts).all();
    res.json(records.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch players' });
  }
});

// POST /players - register a new player to a squad (max 70 per team)
router.post('/', async (req, res) => {
  try {
    const { team, firstName, lastName, middleName, knownName, nationality, passportNo, dob, position } = req.body;

    if (!team || !firstName || !lastName) {
      return res.status(400).json({ error: 'team, firstName and lastName are required' });
    }
    if (!TEAM_NAMES.includes(team)) {
      return res.status(400).json({ error: 'Unknown team' });
    }
    if (!canManageTeam(req.user, team)) {
      return res.status(403).json({ error: 'You can only register players for your own team' });
    }

    const existing = await base(TABLES.PLAYERS)
      .select({ filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` })
      .all();
    if (existing.length >= SQUAD_CAP) {
      return res.status(400).json({ error: `Squad is full (${SQUAD_CAP}/${SQUAD_CAP})` });
    }

    const fields = {
      'Full Name': `${firstName} ${lastName}`.trim(),
      'First Name': firstName,
      'Last Name': lastName,
      Team: team,
    };
    if (middleName) fields['Middle Name'] = middleName;
    if (knownName) fields['Known Name'] = knownName;
    if (nationality) fields.Nationality = nationality;
    if (passportNo) fields['Passport No.'] = passportNo;
    if (dob) fields['Date of Birth'] = dob;
    if (position) fields.Position = position;

    const [created] = await base(TABLES.PLAYERS).create([{ fields }], { typecast: true });
    res.status(201).json(serialize(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to register player' });
  }
});

// PATCH /players/:id - update a player's details
router.patch('/:id', async (req, res) => {
  try {
    const record = await base(TABLES.PLAYERS).find(req.params.id).catch(() => null);
    if (!record) return res.status(404).json({ error: 'Player not found' });
    if (!canManageTeam(req.user, record.fields.Team)) {
      return res.status(403).json({ error: 'Not authorized to edit this player' });
    }

    const editable = [
      'Position', 'Nationality', 'Passport No.', 'Date of Birth', 'Availability',
      'Active Suspension', 'PA Signed', 'LHP Trained', 'Hooker Trained', 'THP Trained',
      'Known Name', 'Club Association',
    ];
    const fields = {};
    for (const key of editable) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) fields[key] = req.body[key];
    }

    const [updated] = await base(TABLES.PLAYERS).update([{ id: record.id, fields }], { typecast: true });
    res.json(serialize(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update player' });
  }
});

// DELETE /players/:id - remove a player from the squad
router.delete('/:id', async (req, res) => {
  try {
    const record = await base(TABLES.PLAYERS).find(req.params.id).catch(() => null);
    if (!record) return res.status(404).json({ error: 'Player not found' });
    if (!canManageTeam(req.user, record.fields.Team)) {
      return res.status(403).json({ error: 'Not authorized to remove this player' });
    }

    await base(TABLES.PLAYERS).destroy([record.id]);
    res.json({ ok: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to remove player' });
  }
});

module.exports = router;
