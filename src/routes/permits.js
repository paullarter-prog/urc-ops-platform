const express = require('express');
const { base, TABLES } = require('../airtable');
const { TEAM_NAMES, resolveTeamName, franchiseMatchesTeam } = require('../permissions');

const router = express.Router();

function serialize(record) {
  return { id: record.id, ...record.fields };
}

function canManageTeam(user, team) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Team Manager') return franchiseMatchesTeam(user.franchise, team);
  return false;
}

// GET /permits?team=Leinster - Team Manager always scoped to their own team
router.get('/', async (req, res) => {
  try {
    let team = req.query.team;
    if (req.user.role === 'Team Manager') {
      team = resolveTeamName(req.user.franchise);
      if (!team) return res.json([]);
    }
    const opts = team ? { filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` } : {};
    const records = await base(TABLES.PERMITS).select(opts).all();
    res.json(records.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch permit requests' });
  }
});

// POST /permits - a team requests a player outside their registered squad
router.post('/', async (req, res) => {
  try {
    const {
      team, firstName, lastName, middleName, knownName, position, reason,
      passportNo, dob, replacingPlayer, roundFrom, notes,
    } = req.body;

    if (!team || !firstName || !lastName || !reason) {
      return res.status(400).json({ error: 'team, firstName, lastName and reason are required' });
    }
    if (!TEAM_NAMES.includes(team)) return res.status(400).json({ error: 'Unknown team' });
    if (!canManageTeam(req.user, team)) {
      return res.status(403).json({ error: 'You can only submit permit requests for your own team' });
    }

    const fields = {
      'Full Name': `${firstName} ${lastName}`.trim(),
      Team: team,
      'First Name': firstName,
      'Last Name': lastName,
      Reason: reason,
      Status: 'Pending',
      'Date Submitted': new Date().toISOString(),
      'Submitted By': [req.user.sub],
    };
    if (middleName) fields['Middle Name'] = middleName;
    if (knownName) fields['Known Name'] = knownName;
    if (position) fields.Position = position;
    if (passportNo) fields['Passport No.'] = passportNo;
    if (dob) fields['Date of Birth'] = dob;
    if (replacingPlayer) fields['Replacing Player'] = replacingPlayer;
    if (roundFrom) fields['Round From'] = Number(roundFrom);
    if (notes) fields['Additional Notes'] = notes;

    const [created] = await base(TABLES.PERMITS).create([{ fields }], { typecast: true });
    res.status(201).json(serialize(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to submit permit request' });
  }
});

// PATCH /permits/:id - Admin approves/declines. Approving auto-adds the
// player to the team's registered squad, mirroring the source spreadsheet's
// "approved players auto-appear on team squad sheets" behaviour.
router.patch('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can review permit requests' });
    }
    const record = await base(TABLES.PERMITS).find(req.params.id).catch(() => null);
    if (!record) return res.status(404).json({ error: 'Permit request not found' });

    const { status, approvedFrom, approvedUntil } = req.body;
    const fields = {};
    if (status) fields.Status = status;
    if (approvedFrom) fields['Approved From'] = approvedFrom;
    if (approvedUntil) fields['Approved Until'] = approvedUntil;

    const wasApproved = record.fields.Status === 'Approved';
    const [updated] = await base(TABLES.PERMITS).update([{ id: record.id, fields }], { typecast: true });

    if (status === 'Approved' && !wasApproved) {
      const f = updated.fields;
      const playerFields = {
        'Full Name': f['Full Name'],
        Team: f.Team,
        'Club Association': 'Permit',
      };
      if (f['First Name']) playerFields['First Name'] = f['First Name'];
      if (f['Last Name']) playerFields['Last Name'] = f['Last Name'];
      if (f['Middle Name']) playerFields['Middle Name'] = f['Middle Name'];
      if (f['Known Name']) playerFields['Known Name'] = f['Known Name'];
      if (f.Position) playerFields.Position = f.Position;
      if (f['Passport No.']) playerFields['Passport No.'] = f['Passport No.'];
      if (f['Date of Birth']) playerFields['Date of Birth'] = f['Date of Birth'];
      await base(TABLES.PLAYERS).create([{ fields: playerFields }], { typecast: true });
    }

    res.json(serialize(updated));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update permit request' });
  }
});

module.exports = router;
