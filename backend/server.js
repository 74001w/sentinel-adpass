require('dotenv').config();

const path = require('path');
const express = require('express');
const cors = require('cors');

const adsRouter = require('./src/routes/ads');

const app = express();
app.use(cors());
app.use(express.json());

app.use(express.static(path.join(__dirname, '..', 'frontend')));

app.use('/api/ads', adsRouter);
app.use('/api/auction', adsRouter);

// Global safety net: catches anything unexpected (malformed JSON, uncaught
// errors deeper in the app) so the API always returns clean JSON instead of
// Express's default HTML error page or a silent crash.
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err.message);
  res.status(500).json({ error: 'Something went wrong on our end. Please try again.' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sentinel-AdPass API listening on port ${PORT}`);
});
// test
