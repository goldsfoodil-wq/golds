'use strict';

var express = require('express');
var config  = require('./config');

var app = express();

// ── Middleware ────────────────────────────────────────────────────────────────

app.use(express.json({ limit: '10kb' }));

// CORS — allow all origins in development, restrict in production via env
app.use(function (req, res, next) {
  var origin = config.nodeEnv === 'production'
    ? (process.env.ALLOWED_ORIGIN || '')
    : '*';
  res.setHeader('Access-Control-Allow-Origin',  origin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') { return res.sendStatus(204); }
  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

app.use('/api/orders', require('./routes/orders'));
app.use('/api/admin',  require('./routes/admin'));

app.get('/api/health', function (req, res) {
  res.json({ status: 'ok', uptime: Math.floor(process.uptime()) });
});

// Catch-all for unknown /api/* paths
app.use('/api', function (req, res) {
  res.status(404).json({ error: 'Not found', code: 'NOT_FOUND' });
});

// ── Start ─────────────────────────────────────────────────────────────────────

app.listen(config.port, function () {
  console.log('[golds] server running  http://localhost:' + config.port);
  console.log('[golds] env             ' + config.nodeEnv);
  console.log('[golds] database        ' + config.dbPath);
});
