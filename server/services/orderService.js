'use strict';

var fs   = require('fs');
var path = require('path');
var db   = require('../db');

// ── Load product catalogue once at startup ────────────────────────────────────

var cataloguePath = path.join(__dirname, '../../assets/data/products.json');
var catalogue;

try {
  catalogue = JSON.parse(fs.readFileSync(cataloguePath, 'utf8'));
} catch (e) {
  throw new Error('Cannot load products.json: ' + e.message);
}

var productMap = {};
catalogue.products.forEach(function (p) {
  productMap[p.id] = p;
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function validatePhone(val) {
  var digits = val.replace(/\D/g, '');
  if (digits.slice(0, 3) === '972') { digits = digits.slice(3); }
  return digits.length >= 9 && digits.length <= 10;
}

function isFutureOrToday(val) {
  if (!val) { return false; }
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  return new Date(val) >= today;
}

function makeError(message, code, status, extra) {
  var err = new Error(message);
  err.code   = code;
  err.status = status || 400;
  if (extra) { Object.assign(err, extra); }
  return err;
}

// ── Prepared statements (created once, reused) ────────────────────────────────

var stmtInsertOrder = db.prepare(`
  INSERT INTO orders
    (order_ref, name, phone, event_date, delivery_type, address, notes,
     total_agorot, payment_status, payment_amount_agorot)
  VALUES
    (?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', ?)
`);

var stmtInsertItem = db.prepare(`
  INSERT INTO order_items
    (order_id, product_id, name, unit, price_agorot, qty, line_total_agorot)
  VALUES
    (?, ?, ?, ?, ?, ?, ?)
`);

var stmtGetOrder = db.prepare(
  'SELECT * FROM orders WHERE order_ref = ?'
);

var stmtGetItems = db.prepare(
  'SELECT * FROM order_items WHERE order_id = ?'
);

// ── createOrder ───────────────────────────────────────────────────────────────

function createOrder(body) {
  var name         = String(body.name         || '').trim();
  var phone        = String(body.phone        || '').trim();
  var eventDate    = String(body.eventDate    || '').trim();
  var deliveryType = String(body.deliveryType || '').trim();
  var address      = String(body.address      || '').trim();
  var notes        = String(body.notes        || '').trim();
  var items        = body.items;

  // ── Field validation ──────────────────────────────────────────────────────
  var errors = {};

  if (!name)                              { errors.name = 'שם מלא נדרש'; }
  if (!validatePhone(phone))              { errors.phone = 'מספר טלפון לא תקין'; }
  if (!isFutureOrToday(eventDate))        { errors.eventDate = 'תאריך אירוע לא תקין'; }
  if (deliveryType !== 'pickup' &&
      deliveryType !== 'delivery')        { errors.deliveryType = 'אופן קבלה לא תקין'; }
  if (deliveryType === 'delivery' &&
      !address)                           { errors.address = 'כתובת נדרשת למשלוח'; }
  if (!Array.isArray(items) ||
      items.length === 0)                 { errors.items = 'ההזמנה ריקה'; }

  if (Object.keys(errors).length > 0) {
    throw makeError('Validation failed', 'VALIDATION_ERROR', 400, { errors: errors });
  }

  // ── Item validation + server-side total ───────────────────────────────────
  var validatedItems = [];
  var totalAgorot    = 0;

  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var productId = String(item.id || '').trim();
    var qty       = parseInt(item.qty, 10);

    if (!productId || !isFinite(qty) || qty < 1) {
      throw makeError('פריט לא תקין', 'INVALID_ITEM', 400);
    }

    var product = productMap[productId];
    if (!product) {
      throw makeError('מוצר לא נמצא: ' + productId, 'PRODUCT_NOT_FOUND', 400);
    }
    if (!product.available) {
      throw makeError('מוצר לא זמין: ' + product.name, 'PRODUCT_UNAVAILABLE', 400);
    }
    if (product.minQty && qty < product.minQty) {
      throw makeError(
        'כמות מינימלית עבור ' + product.name + ' היא ' + product.minQty,
        'MIN_QTY_NOT_MET', 400
      );
    }

    var priceAgorot    = Math.round(product.price * 100);
    var lineTotalAgorot = priceAgorot * qty;
    totalAgorot += lineTotalAgorot;

    validatedItems.push({
      productId:        productId,
      name:             product.name,
      unit:             product.unit || null,
      priceAgorot:      priceAgorot,
      qty:              qty,
      lineTotalAgorot:  lineTotalAgorot,
    });
  }

  // ── Persist in a single transaction ──────────────────────────────────────
  var orderRef = 'ORD-' + Date.now();

  var write = db.transaction(function () {
    var result  = stmtInsertOrder.run(
      orderRef, name, phone, eventDate, deliveryType,
      address || null, notes || null, totalAgorot, totalAgorot
    );
    var orderId = result.lastInsertRowid;

    validatedItems.forEach(function (vi) {
      stmtInsertItem.run(
        orderId, vi.productId, vi.name, vi.unit,
        vi.priceAgorot, vi.qty, vi.lineTotalAgorot
      );
    });

    return { orderId: orderId, orderRef: orderRef, totalAgorot: totalAgorot };
  });

  return write();
}

// ── getOrder ──────────────────────────────────────────────────────────────────

function getOrder(ref) {
  var row = stmtGetOrder.get(ref);
  if (!row) { return null; }

  var itemRows = stmtGetItems.all(row.id);

  return {
    orderRef:  row.order_ref,
    status:    row.status,
    customer: {
      name:         row.name,
      phone:        row.phone,
      eventDate:    row.event_date,
      deliveryType: row.delivery_type,
      address:      row.address  || null,
      notes:        row.notes    || null,
    },
    items: itemRows.map(function (r) {
      return {
        productId:       r.product_id,
        name:            r.name,
        unit:            r.unit,
        priceAgorot:     r.price_agorot,
        priceShekel:     r.price_agorot / 100,
        qty:             r.qty,
        lineTotalAgorot: r.line_total_agorot,
        lineTotalShekel: r.line_total_agorot / 100,
      };
    }),
    totalAgorot:   row.total_agorot,
    totalShekel:   row.total_agorot / 100,
    paymentStatus: row.payment_status,
    payment: {
      provider:      row.payment_provider       || null,
      status:        row.payment_status,
      transactionId: row.payment_transaction_id || null,
      reference:     row.payment_reference      || null,
      amountAgorot:  row.payment_amount_agorot  || null,
      paidAt:        row.paid_at                || null,
    },
    createdAt:     row.created_at,
  };
}

module.exports = { createOrder: createOrder, getOrder: getOrder };
