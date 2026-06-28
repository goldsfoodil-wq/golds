'use strict';

var express        = require('express');
var router         = express.Router();
var orderService   = require('../services/orderService');
var paymentService = require('../services/paymentService');

// POST /api/orders
router.post('/', async function (req, res) {
  try {
    var result = orderService.createOrder(req.body);

    var response = {
      orderRef:    result.orderRef,
      totalShekel: result.totalAgorot / 100,
    };

    if (paymentService.isConfigured()) {
      try {
        var paymentResult = await paymentService.createPaymentLink({
          orderRef:     result.orderRef,
          totalAgorot:  result.totalAgorot,
          name:         req.body.name,
          phone:        req.body.phone,
        });

        response.payment = {
          provider: 'payplus',
          raw: paymentResult,
        };

        response.paymentUrl =
          paymentResult.payment_page_link ||
          paymentResult.payment_page_url ||
          paymentResult.url ||
          paymentResult.link ||
          null;

      } catch (payErr) {
        console.error('[orders] PayPlus link failed -', payErr.message);
        response.payment = {
          provider: 'payplus',
          error: 'PAYMENT_LINK_FAILED',
        };
      }
    } else {
      response.payment = {
        provider: 'payplus',
        status: 'not_configured',
      };
    }

    return res.status(201).json(response);

  } catch (err) {
    if (err.code === 'VALIDATION_ERROR') {
      return res.status(400).json({
        error:  'פרטים חסרים או שגויים',
        code:   err.code,
        errors: err.errors,
      });
    }
    if (err.status === 400) {
      return res.status(400).json({ error: err.message, code: err.code });
    }
    console.error('[orders] POST /api/orders -', err.message);
    return res.status(500).json({ error: 'שגיאת שרת', code: 'SERVER_ERROR' });
  }
});

// GET /api/orders/:ref
router.get('/:ref', function (req, res) {
  try {
    var order = orderService.getOrder(req.params.ref);
    if (!order) {
      return res.status(404).json({ error: 'הזמנה לא נמצאה', code: 'ORDER_NOT_FOUND' });
    }
    return res.json(order);
  } catch (err) {
    console.error('[orders] GET /api/orders/' + req.params.ref + ' -', err.message);
    return res.status(500).json({ error: 'שגיאת שרת', code: 'SERVER_ERROR' });
  }
});

module.exports = router;