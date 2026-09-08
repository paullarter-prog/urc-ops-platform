const express = require('express');
const { base, TABLES } = require('../airtable');

const router = express.Router();

// GET /availability?officialId=xxx&date=YYYY-MM-DD&from=YYYY-MM-DD&to=YYYY-MM-DD
router.get('/', async (req, res) => {
  try {
    const { officialId, date, from, to } = req.query;
    const records = await base(TABLES.AVAILABILITY).select({}).all();
    let results = records.map((r) => ({ id: r.id, ...r.fields }));

    if (officialId) results = results.filter((r) => (r.Official || []).includes(officialId));
    if (date) results = results.filter((r) => r.Date === date);
    if (from) results = results.filter((r) => r.Date >= from);
    if (to) results = results.filter((r) => r.Date <= to);

    res.json(results);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch availability' });
  }
});

// POST /availability/bulk - body: { officialId, entries: [{ date, status }] }
// Upserts one record per (official, date) pair. status: null/omitted clears
// that date (deletes the existing record, if any) - lets a calendar UI mark
// a day back to "not set".
router.post('/bulk', async (req, res) => {
  try {
    const { officialId, entries } = req.body;
    if (!officialId || !Array.isArray(entries) || entries.length === 0) {
      return res.status(400).json({ error: 'officialId and a non-empty entries array are required' });
    }

    const existing = await base(TABLES.AVAILABILITY).select({}).all();
    const existingByDate = {};
    for (const r of existing) {
      if ((r.fields.Official || []).includes(officialId)) {
        existingByDate[r.fields.Date] = r.id;
      }
    }

    const toCreate = [];
    const toUpdate = [];
    const toDelete = [];
    for (const { date, status } of entries) {
      if (!date) continue;
      const existingId = existingByDate[date];
      if (status) {
        if (existingId) {
          toUpdate.push({ id: existingId, fields: { Status: status } });
        } else {
          toCreate.push({ fields: { Official: [officialId], Date: date, Status: status } });
        }
      } else if (existingId) {
        toDelete.push(existingId);
      }
    }

    let count = 0;
    for (let i = 0; i < toCreate.length; i += 10) {
      const created = await base(TABLES.AVAILABILITY).create(toCreate.slice(i, i + 10), { typecast: true });
      count += created.length;
    }
    for (let i = 0; i < toUpdate.length; i += 10) {
      const updated = await base(TABLES.AVAILABILITY).update(toUpdate.slice(i, i + 10));
      count += updated.length;
    }
    for (let i = 0; i < toDelete.length; i += 10) {
      const deleted = await base(TABLES.AVAILABILITY).destroy(toDelete.slice(i, i + 10));
      count += deleted.length;
    }

    res.json({ updated: count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to save availability' });
  }
});

module.exports = router;
