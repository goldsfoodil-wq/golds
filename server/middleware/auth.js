'use strict';

var jwt    = require('jsonwebtoken');
var config = require('../config');

module.exports = function requireAdmin(req, res, next) {
  var header = req.headers['authorization'] || '';
  var token  = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ error: 'נדרשת התחברות', code: 'UNAUTHORIZED' });
  }

  try {
    var payload = jwt.verify(token, config.jwtSecret);
    if (payload.role !== 'admin') { throw new Error('not admin'); }
    req.admin = payload;
    next();
  } catch (_) {
    return res.status(401).json({ error: 'הפגישה פגה תוקפה, אנא התחבר מחדש', code: 'TOKEN_EXPIRED' });
  }
};