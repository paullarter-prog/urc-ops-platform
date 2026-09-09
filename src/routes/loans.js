const express = require('express');
const { base, TABLES } = require('../airtable');
const { TEAM_NAMES, resolveTeamName, franchiseMatchesTeam } = require('../permissions');

const router = express.Router();

function serialize(record) {
  return { id: record.id, ...record.fields };
}

function canManageTeam(user, team) {
  if (user.role === 'Admin') return true;
  if (user.role === 'Club Ops') return franchiseMatchesTeam(user.franchise, team);
  return false;
}

// GET /loans?team=Leinster - Club Ops always scoped to their own team
router.get('/', async (req, res) => {
  try {
    let team = req.query.team;
    if (req.user.role === 'Club Ops') {
      team = resolveTeamName(req.user.franchise);
      if (!team) return res.json([]);
    }
    const opts = team ? { filterByFormula: `{Team} = "${team.replace(/"/g, '\\"')}"` } : {};
    const records = await base(TABLES.LOANS).select(opts).all();
    res.json(records.map(serialize));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch loan players' });
  }
});

// POST /loans - log an incoming loan player
router.post('/', async (req, res) => {
  try {
    const {
      team, firstName, lastName, middleName, knownName, position, union,
      loanType, startDate, endDate, passportNo, dob, replacingPlayer, notes,
    } = req.body;

    if (!team || !firstName || !lastName) {
      return res.status(400).json({ error: 'team, firstName and lastName are required' });
    }
    if (!TEAM_NAMES.includes(team)) return res.status(400).json({ error: 'Unknown team' });
    if (!canManageTeam(req.user, team)) {
      return res.status(403).json({ error: 'You can only log loan players for your own team' });
    }

    const fields = {
      'Full Name': `${firstName} ${lastName}`.trim(),
      Team: team,
      'First Name': firstName,
      'Last Name': lastName,
      Status: 'Pending',
      'Date Submitted': new Date().toISOString(),
      'Submitted By': [req.user.sub],
    };
    if (middleName) fields['Middle Name'] = middleName;
    if (knownName) fields['Known Name'] = knownName;
    if (position) fields.Position = position;
    if (union) fields.Union = union;
    if (loanType) fields['Loan Type'] = loanType;
    if (startDate) fields['Start Date'] = startDate;
    if (endDate) fields['End Date'] = endDate;
    if (passportNo) fields['Passport No.'] = passportNo;
    if (dob) fields['Date of Birth'] = dob;
    if (replacingPlayer) fields['Replacing Player'] = replacingPlayer;
    if (notes) fields.Notes = notes;

    const [created] = await base(TABLES.LOANS).create([{ fields }], { typecast: true });
    res.status(201).json(serialize(created));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to log loan player' });
  }
});

// PATCH /loans/:id - Admin activates/ends a loan. Activating auto-adds the
// player to the team's registered squad.
router.patch('/:id', async (req, res) => {
  try {
    if (req.user.role !== 'Admin') {
      return res.status(403).json({ error: 'Only Admins can review loan players' });
    }
    const record = await base(TABLES.LOANS).find(req.params.id).catch(() => null);
    if (!record) return res.status(404).json({ error: 'Loan player not found' });

    const { status } = req.body;
    const fields = {};
    if (status) fields.Status = status;

    const wasActive = record.fields.Status === 'Active';
    const [updated] = await base(TABLES.LOANS).update([{ id: record.id, fields }], { typecast: true });

    if (status === 'Active' && !wasActive) {
      const f = updated.fields;
      const playerFields = {
        'Full Name': f['Full Name'],
        Team: f.Team,
        'Club Association': 'Loan In',
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
    res.status(500).json({ error: 'Failed to update loan player' });
  }
});

module.exports = router;
