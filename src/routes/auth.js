const express = require('express');
const { base, TABLES } = require('../airtable');
const { comparePassword, signToken, COOKIE_NAME } = require('../auth');

const router = express.Router();

const COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

// POST /auth/login - body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' });
    }

    const records = await base(TABLES.USERS).select({}).all();
    const match = records.find(
      (r) => (r.fields.Email || '').toLowerCase() === email.toLowerCase()
    );

    if (!match || !match.fields['Password Hash']) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const valid = await comparePassword(password, match.fields['Password Hash']);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const user = {
      sub: match.id,
      email: match.fields.Email,
      name: match.fields.Name,
      role: match.fields.Role || 'Official',
      franchise: match.fields.Franchise || null,
    };
    const token = signToken(user);

    res.cookie(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: COOKIE_MAX_AGE,
    });
    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// POST /auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

// GET /auth/me - requires the global auth guard to have already run
router.get('/me', (req, res) => {
  res.json(req.user);
});

module.exports = router;
