'use strict';

var express              = require('express');
var bcrypt               = require('bcryptjs');
var jwt                  = require('jsonwebtoken');
var router               = express.Router();
var db                   = require('../db');
var config               = require('../config');
var requireAdmin         = require('../middleware/auth');
var orderService         = require('../services/orderService');
var notificationService  = require('../services/notificationService');

var VALID_STATUSES = ['pending', 'paid', 'preparing', 'ready', 'delivered', 'cancelled'];

function formatRow(row) {
  return {
    id:            row.id,
    orderRef:      row.order_ref,
    name:          row.name,
    phone:         row.phone,
    eventDate:     row.event_date,
    deliveryType:  row.delivery_type,
    totalShekel:   row.total_agorot / 100,
    paymentStatus: row.payment_status,
    status:        row.status,
  };
}

// ── POST /api/admin/login ─────────────────────────────────────────────────────

router.post('/login', function (req, res) {
  var email    = String(req.body.email    || '').trim().toLowerCase();
  var password = String(req.body.password || '');

  if (!email || !password) {
    return res.status(400).json({ error: 'אנא הזן אימייל וסיסמה', code: 'MISSING_CREDENTIALS' });
  }

  if (!config.adminEmail || !config.adminPasswordHash) {
    console.error('[admin] login attempted but credentials not configured in .env');
    return res.status(500).json({ error: 'Admin credentials not configured', code: 'NOT_CONFIGURED' });
  }

  if (email !== config.adminEmail.toLowerCase()) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים', code: 'INVALID_CREDENTIALS' });
  }

  var match = bcrypt.compareSync(password, config.adminPasswordHash);
  if (!match) {
    return res.status(401).json({ error: 'אימייל או סיסמה שגויים', code: 'INVALID_CREDENTIALS' });
  }

  var token = jwt.sign({ role: 'admin', email: email }, config.jwtSecret, { expiresIn: '8h' });
  return res.json({ token: token });
});

// ── GET /api/admin/stats ──────────────────────────────────────────────────────

router.get('/stats', requireAdmin, function (req, res) {
  var today   = new Date().toISOString().split('T')[0];
  var in7Days = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];

  var todayCount   = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE event_date = ? AND status != 'cancelled'").get(today).n;
  var pendingCount = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'").get().n;
  var paidCount    = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'paid'").get().n;
  var readyCount   = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE status = 'ready'").get().n;

  var upcoming = db.prepare(`
    SELECT id, order_ref, name, phone, event_date, delivery_type, total_agorot, payment_status, status
    FROM orders
    WHERE event_date >= ? AND event_date <= ? AND status != 'cancelled'
    ORDER BY event_date ASC
    LIMIT 20
  `).all(today, in7Days);

  return res.json({
    todayCount:   todayCount,
    pendingCount: pendingCount,
    paidCount:    paidCount,
    readyCount:   readyCount,
    upcoming:     upcoming.map(formatRow),
  });
});

// ── GET /api/admin/orders ─────────────────────────────────────────────────────

router.get('/orders', requireAdmin, function (req, res) {
  var status = (req.query.status || '').trim();
  var search = (req.query.search || '').trim();
  var page   = Math.max(1, parseInt(req.query.page || '1', 10));
  var limit  = 25;
  var offset = (page - 1) * limit;

  var conditions = [];
  var params     = [];

  if (status && status !== 'all') {
    conditions.push('status = ?');
    params.push(status);
  }
  if (search) {
    conditions.push('(name LIKE ? OR order_ref LIKE ? OR phone LIKE ?)');
    params.push('%' + search + '%', '%' + search + '%', '%' + search + '%');
  }

  var where = conditions.length ? 'WHERE ' + conditions.join(' AND ') : '';

  var total = db.prepare('SELECT COUNT(*) AS n FROM orders ' + where).get.apply(
    db.prepare('SELECT COUNT(*) AS n FROM orders ' + where),
    params
  ).n;

  var rows = db.prepare(
    'SELECT id, order_ref, name, phone, event_date, delivery_type, total_agorot, payment_status, status ' +
    'FROM orders ' + where + ' ' +
    'ORDER BY event_date ASC, created_at DESC ' +
    'LIMIT ? OFFSET ?'
  ).all.apply(
    db.prepare(
      'SELECT id, order_ref, name, phone, event_date, delivery_type, total_agorot, payment_status, status ' +
      'FROM orders ' + where + ' ' +
      'ORDER BY event_date ASC, created_at DESC ' +
      'LIMIT ? OFFSET ?'
    ),
    params.concat([limit, offset])
  );

  return res.json({
    orders: rows.map(formatRow),
    total:  total,
    page:   page,
    pages:  Math.ceil(total / limit) || 1,
  });
});

// ── GET /api/admin/orders/:id ─────────────────────────────────────────────────

router.get('/orders/:id', requireAdmin, function (req, res) {
  var id = parseInt(req.params.id, 10);
  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'מזהה לא תקין', code: 'INVALID_ID' });
  }

  var row = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!row) {
    return res.status(404).json({ error: 'הזמנה לא נמצאה', code: 'ORDER_NOT_FOUND' });
  }

  var items = db.prepare('SELECT * FROM order_items WHERE order_id = ?').all(id);

  return res.json({
    id:       row.id,
    orderRef: row.order_ref,
    status:   row.status,
    customer: {
      name:         row.name,
      phone:        row.phone,
      eventDate:    row.event_date,
      deliveryType: row.delivery_type,
      address:      row.address || null,
      notes:        row.notes   || null,
    },
    items: items.map(function (i) {
      return {
        productId:       i.product_id,
        name:            i.name,
        unit:            i.unit,
        priceShekel:     i.price_agorot / 100,
        qty:             i.qty,
        lineTotalShekel: i.line_total_agorot / 100,
      };
    }),
    totalShekel:   row.total_agorot / 100,
    paymentStatus: row.payment_status,
    createdAt:     row.created_at,
    updatedAt:     row.updated_at,
  });
});

// ── PATCH /api/admin/orders/:id/status ───────────────────────────────────────

router.patch('/orders/:id/status', requireAdmin, function (req, res) {
  var id     = parseInt(req.params.id, 10);
  var status = String(req.body.status || '').trim();

  if (!id || isNaN(id)) {
    return res.status(400).json({ error: 'מזהה לא תקין', code: 'INVALID_ID' });
  }
  if (!VALID_STATUSES.includes(status)) {
    return res.status(400).json({ error: 'סטטוס לא תקין', code: 'INVALID_STATUS' });
  }

  var result = db.prepare(
    "UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?"
  ).run(status, id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'הזמנה לא נמצאה', code: 'ORDER_NOT_FOUND' });
  }

  var updated = db.prepare('SELECT id, order_ref, status, updated_at FROM orders WHERE id = ?').get(id);
  return res.json({ id: updated.id, orderRef: updated.order_ref, status: updated.status, updatedAt: updated.updated_at });
});

// ── GET /api/admin/orders/:ref/notification-preview ──────────────────────────

router.get('/orders/:ref/notification-preview', requireAdmin, function (req, res) {
  var order = orderService.getOrder(req.params.ref);
  if (!order) {
    return res.status(404).json({ error: 'הזמנה לא נמצאה', code: 'ORDER_NOT_FOUND' });
  }
  var message    = notificationService.buildOwnerOrderMessage(order);
  var ownerPhone = process.env.OWNER_WHATSAPP || '';
  var waUrl      = null;
  if (ownerPhone) {
    var digits = ownerPhone.replace(/\D/g, '');
    if (digits.charAt(0) === '0') { digits = '972' + digits.slice(1); }
    waUrl = 'https://wa.me/' + digits + '?text=' + encodeURIComponent(message);
  }
  return res.json({
    orderRef:           order.orderRef,
    preview:            message,
    whatsappConfigured: !!ownerPhone,
    whatsappUrl:        waUrl,
  });
});

module.exports = router;