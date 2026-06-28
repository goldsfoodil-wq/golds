'use strict';

var path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env') });

module.exports = {
  port:              parseInt(process.env.PORT || '3001', 10),
  nodeEnv:           process.env.NODE_ENV      || 'development',
  dbPath:            process.env.DB_PATH       || path.join(__dirname, 'data/database.sqlite'),
  jwtSecret:         process.env.JWT_SECRET    || 'dev-secret-change-in-production',
  adminEmail:        process.env.ADMIN_EMAIL   || '',
  adminPasswordHash: process.env.ADMIN_PASSWORD_HASH || '',
};