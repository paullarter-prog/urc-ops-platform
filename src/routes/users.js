const express = require('express');
const { base, TABLES } = require('../airtable');

const router = express.Router();

// GET /users - list all users
router.get('/', async (req, res) => {
  try {
    const records = await base(TABLES.USERS).select({}).all();
    const users = records.map((r) => ({ id: r.id, ...r.fields }));
    res.json(users);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch users' });
  }
});

module.exports = router;
