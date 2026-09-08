// Appointment eligibility rules (Doc Section 8: neutral vs home-union roles).

// Multiple aliases per team since sponsor-prefixed names change season to
// season (e.g. Emirates Lions -> 10bet Lions) and older records may use
// the shorter form (e.g. 'Edinburgh' vs 'Edinburgh Rugby').
const UNION_TEAMS = {
  SCO: ['Glasgow Warriors', 'Edinburgh Rugby', 'Edinburgh'],
  ITA: ['Benetton', 'Zebre Parma'],
  WAL: ['Cardiff Rugby', 'Cardiff', 'Dragons RFC', 'Dragons', 'Ospreys', 'Scarlets'],
  IRL: ['Connacht', 'Leinster', 'Munster', 'Ulster'],
  RSA: ['Vodacom Bulls', '10bet Lions', 'Emirates Lions', 'Hollywoodbets Sharks', 'DHL Stormers'],
};

const FIVE_UNIONS = Object.keys(UNION_TEAMS);

// Officials' "Home Union" field holds governing-body names, not the short union codes above.
const GOVERNING_BODY_TO_UNION = {
  IRFU: 'IRL',
  SARU: 'RSA',
  SRU: 'SCO',
  WRU: 'WAL',
  FIR: 'ITA',
};

function teamUnion(teamName) {
  const entry = Object.entries(UNION_TEAMS).find(([, teams]) => teams.includes(teamName));
  return entry ? entry[0] : null;
}

function officialUnion(homeUnion) {
  if (!homeUnion) return null;
  return GOVERNING_BODY_TO_UNION[homeUnion.toUpperCase()] || null;
}

// Round is a Number field in Airtable (1-18), so knockout stage is tracked via
// a separate 'Stage' text field (e.g. 'Quarter Final') set once QF/SF/GF
// matchups are known. No Stage value means regular season.
function isKnockout(fixture) {
  return typeof fixture.Stage === 'string' && fixture.Stage.trim() !== '';
}

// official: Airtable fields for an Officials record (needs Home Union)
// role: the panel role slot being filled, e.g. 'Referee', 'AR1', 'TMO', 'Timekeeper'
// fixture: Airtable fields for a Fixtures record (needs Home Team, Away Team, Round)
function isEligible(official, role, fixture) {
  const neutralRoles = isKnockout(fixture)
    ? ['Referee', 'AR1', 'AR2', 'TMO']
    : ['Referee', 'TMO'];

  const homeUnion = teamUnion(fixture['Home Team']);
  const awayUnion = teamUnion(fixture['Away Team']);
  const union = officialUnion(official['Home Union']);

  if (neutralRoles.includes(role)) {
    if (union && union === homeUnion) {
      return { eligible: false, reason: `${homeUnion} official — not neutral for this fixture` };
    }
    if (union && union === awayUnion) {
      return { eligible: false, reason: `${awayUnion} official — not neutral for this fixture` };
    }
    return { eligible: true };
  }

  // Home-union role: must match the home team's union, unless the home team
  // isn't one of the 5 URC unions (per doc, any official is accepted then).
  if (homeUnion && FIVE_UNIONS.includes(homeUnion) && union !== homeUnion) {
    return { eligible: false, reason: `Must be a ${homeUnion} official (home union role)` };
  }

  return { eligible: true };
}

module.exports = { isEligible, teamUnion, officialUnion, isKnockout, UNION_TEAMS, GOVERNING_BODY_TO_UNION };
