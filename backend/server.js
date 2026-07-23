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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Sentinel-AdPass API listening on port ${PORT}`);
});
