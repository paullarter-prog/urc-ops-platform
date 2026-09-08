const Airtable = require('airtable');

// API key lives ONLY here, server-side, via env var - never sent to the browser.
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Table IDs (from the URC Ops Platform base)
const TABLES = {
  FIXTURES: 'tblwmlfl8VbULZYEY',
  OFFICIALS: 'tbl1JO7LBcvTHuwmk',
  USERS: 'tblrWFaKtNpLpw5RN',
  APPOINTMENTS: 'tbl30LtLx8II4Y4EB',
};

module.exports = { base, TABLES };
