'use strict';

var fs       = require('fs');
var path     = require('path');
var Database = require('better-sqlite3');
var config   = require('./config');

var dbPath = config.dbPath;

// Ensure the data directory exists before opening the file
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

var db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS orders (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    order_ref       TEXT    UNIQUE NOT NULL,
    status          TEXT    NOT NULL DEFAULT 'pending',
    name            TEXT    NOT NULL,
    phone           TEXT    NOT NULL,
    event_date      TEXT    NOT NULL,
    delivery_type   TEXT    NOT NULL,
    address         TEXT,
    notes           TEXT,
    total_agorot    INTEGER NOT NULL,
    payment_id      TEXT,
    payment_status  TEXT    NOT NULL DEFAULT 'unpaid',
    created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
    updated_at      TEXT    NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS order_items (
    id                  INTEGER PRIMARY KEY AUTOINCREMENT,
    order_id            INTEGER NOT NULL REFERENCES orders(id),
    product_id          TEXT    NOT NULL,
    name                TEXT    NOT NULL,
    unit                TEXT,
    price_agorot        INTEGER NOT NULL,
    qty                 INTEGER NOT NULL,
    line_total_agorot   INTEGER NOT NULL
  );
`);

// Safe migration: add payment columns that may be missing from existing databases
var existingCols = db.pragma('table_info(orders)').map(function (c) { return c.name; });

var paymentCols = [
  'payment_provider       TEXT',
  'payment_transaction_id TEXT',
  'payment_reference      TEXT',
  'payment_amount_agorot  INTEGER',
  'paid_at                TEXT',
];

paymentCols.forEach(function (colDef) {
  var colName = colDef.trim().split(/\s+/)[0];
  if (existingCols.indexOf(colName) === -1) {
    db.exec('ALTER TABLE orders ADD COLUMN ' + colDef + ';');
  }
});

module.exports = db;
