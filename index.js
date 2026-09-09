require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const cookieParser = require('cookie-parser');

const { verifyToken, COOKIE_NAME } = require('./src/auth');
const authRouter = require('./src/routes/auth');
const fixturesRouter = require('./src/routes/fixtures');
const officialsRouter = require('./src/routes/officials');
const appointmentsRouter = require('./src/routes/appointments');
const usersRouter = require('./src/routes/users');
const panelsRouter = require('./src/routes/panels');
const availabilityRouter = require('./src/routes/availability');
const teamsheetsRouter = require('./src/routes/teamsheets');
const playersRouter = require('./src/routes/players');
const permitsRouter = require('./src/routes/permits');
const loansRouter = require('./src/routes/loans');
const matchdayRouter = require('./src/routes/matchday');

const app = express();
app.use(cors());
app.use(express.json());
app.use(cookieParser());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Everything except login/logout/health/the login page itself requires a
// valid session cookie. HTML page requests redirect to /login.html; API
// requests get a 401 JSON body.
const PUBLIC_PATHS = new Set(['/login.html', '/health', '/auth/login', '/auth/logout']);

app.use((req, res, next) => {
  // Crests/branding images are just public badge art, not sensitive data,
  // and the login page needs the URC logo before anyone is signed in.
  if (PUBLIC_PATHS.has(req.path) || req.path.startsWith('/logos/')) return next();

  let user = null;
  const token = req.cookies[COOKIE_NAME];
  if (token) {
    try {
      user = verifyToken(token);
    } catch (err) {
      user = null;
    }
  }

  if (!user) {
    if (req.path === '/' || req.path.endsWith('.html')) {
      return res.redirect('/login.html');
    }
    return res.status(401).json({ error: 'Not authenticated' });
  }

  req.user = user;
  next();
});

// Which roles may open which pages directly (nav already hides links a role
// can't use, but this stops someone reaching them by typing the URL).
// Pages not listed here (dashboard.html, etc.) are open to any signed-in role.
const PAGE_ROLES = {
  '/fixtures.html': ['Admin'],
  '/officials.html': ['Admin'],
  '/panel-builder.html': ['Admin', 'Official'],
  '/availability.html': ['Admin', 'Official'],
  '/teamsheets.html': ['Admin', 'Team Manager', 'Viewer'],
  '/squads.html': ['Admin', 'Team Manager', 'Viewer'],
  '/permits.html': ['Admin', 'Team Manager'],
  '/loans.html': ['Admin', 'Team Manager'],
  '/matchday.html': ['Admin', 'Team Manager', 'Viewer'],
};

app.use((req, res, next) => {
  const allowed = PAGE_ROLES[req.path];
  if (allowed && !allowed.includes(req.user.role)) {
    return res.redirect('/dashboard.html');
  }
  next();
});

app.get('/', (req, res) => res.redirect('/dashboard.html'));
app.use(express.static(path.join(__dirname, 'public')));

app.use('/auth', authRouter);
app.use('/fixtures', fixturesRouter);
app.use('/officials', officialsRouter);
app.use('/appointments', appointmentsRouter);
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);
app.use('/availability', availabilityRouter);
app.use('/teamsheets', teamsheetsRouter);
app.use('/players', playersRouter);
app.use('/permits', permitsRouter);
app.use('/loans', loansRouter);
app.use('/matchday', matchdayRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`URC Ops backend running on port ${PORT}`));
