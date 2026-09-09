// Teamsheet submission deadline: 11:15am Europe/London, the day before kickoff.
// Fixture dates/times aren't stored with a time zone, so we anchor the wall-clock
// deadline to Europe/London ourselves (handles the BST/GMT switch correctly).

function londonOffsetMinutes(utcDate) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/London',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
    .formatToParts(utcDate)
    .reduce((acc, p) => {
      acc[p.type] = p.value;
      return acc;
    }, {});

  const asUTC = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second)
  );
  return Math.round((asUTC - utcDate.getTime()) / 60000);
}

function londonWallTimeToUTC(y, m, d, hh, mm) {
  const guess = new Date(Date.UTC(y, m - 1, d, hh, mm, 0));
  const offsetMinutes = londonOffsetMinutes(guess);
  return new Date(guess.getTime() - offsetMinutes * 60000);
}

// fixtureDateISO: 'YYYY-MM-DD'. Returns a Date (UTC instant) for 11:15 London
// time on the day before that date.
function teamsheetDeadline(fixtureDateISO) {
  const [y, m, d] = fixtureDateISO.split('-').map(Number);
  const dayBefore = new Date(Date.UTC(y, m - 1, d));
  dayBefore.setUTCDate(dayBefore.getUTCDate() - 1);
  return londonWallTimeToUTC(
    dayBefore.getUTCFullYear(),
    dayBefore.getUTCMonth() + 1,
    dayBefore.getUTCDate(),
    11,
    15
  );
}

module.exports = { teamsheetDeadline };
