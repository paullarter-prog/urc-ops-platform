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
  if (PUBLIC_PATHS.has(req.path)) return next();

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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`URC Ops backend running on port ${PORT}`));
