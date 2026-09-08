require('dotenv').config();
const express = require('express');
const cors = require('cors');

const fixturesRouter = require('./src/routes/fixtures');
const officialsRouter = require('./src/routes/officials');
const appointmentsRouter = require('./src/routes/appointments');
const usersRouter = require('./src/routes/users');
const panelsRouter = require('./src/routes/panels');

const app = express();
app.use(cors());
app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/fixtures', fixturesRouter);
app.use('/officials', officialsRouter);
app.use('/appointments', appointmentsRouter);
app.use('/users', usersRouter);
app.use('/panels', panelsRouter);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`URC Ops backend running on port ${PORT}`));
