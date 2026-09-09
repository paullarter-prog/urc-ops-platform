const TEAM_NAMES = [
  'Benetton', 'Vodacom Bulls', 'Cardiff Rugby', 'Connacht', 'Dragons RFC',
  'Edinburgh Rugby', 'Glasgow Warriors', 'Leinster', '10bet Lions', 'Munster',
  'Ospreys', 'Scarlets', 'Hollywoodbets Sharks', 'DHL Stormers', 'Ulster', 'Zebre Parma',
];

// A Club Ops user's Franchise field and a team name elsewhere in the app use
// inconsistent naming (e.g. "Bulls" vs "Vodacom Bulls") - a loose two-way
// substring match tolerates that instead of requiring them to be kept in sync.
function franchiseMatchesTeam(franchise, team) {
  if (!franchise || !team) return false;
  const f = franchise.trim().toLowerCase();
  const t = team.trim().toLowerCase();
  return f === t || f.includes(t) || t.includes(f);
}

// Resolves a Club Ops user's free-text Franchise field to one of the 16
// canonical team names used elsewhere (Fixtures, Players, Teamsheets).
function resolveTeamName(franchise) {
  return TEAM_NAMES.find((team) => franchiseMatchesTeam(franchise, team)) || null;
}

module.exports = { TEAM_NAMES, franchiseMatchesTeam, resolveTeamName };
