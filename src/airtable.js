const Airtable = require('airtable');

// API key lives ONLY here, server-side, via env var - never sent to the browser.
const base = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(
  process.env.AIRTABLE_BASE_ID
);

// Table IDs (from the URC Ops Platform base). AVAILABILITY is referenced by
// name rather than ID since it's created manually in the Airtable UI - the
// Airtable SDK accepts either.
const TABLES = {
  FIXTURES: 'tblwmlfl8VbULZYEY',
  OFFICIALS: 'tbl1JO7LBcvTHuwmk',
  USERS: 'tblrWFaKtNpLpw5RN',
  APPOINTMENTS: 'tbl30LtLx8II4Y4EB',
  AVAILABILITY: 'MO Availability',
};

module.exports = { base, TABLES };
