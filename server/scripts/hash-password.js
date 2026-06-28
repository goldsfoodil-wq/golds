#!/usr/bin/env node
'use strict';

var bcrypt   = require('bcryptjs');
var password = process.argv[2];

if (!password) {
  console.error('Usage: node scripts/hash-password.js <your-password>');
  process.exit(1);
}

var hash = bcrypt.hashSync(password, 12);
console.log('\nAdd these lines to your .env file:\n');
console.log('ADMIN_PASSWORD_HASH=' + hash);
console.log('\nDo not share or commit the .env file.');