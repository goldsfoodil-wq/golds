'use strict';

var https = require('https');

var PAYPLUS_API_URL =
  process.env.PAYPLUS_API_URL ||
  'https://restapi.payplus.co.il/api/v1.0/PaymentPages/generateLink';

function isConfigured() {
  return Boolean(
    process.env.PAYPLUS_API_KEY &&
    process.env.PAYPLUS_SECRET_KEY &&
    process.env.PAYPLUS_PAYMENT_PAGE_UID
  );
}

function postJson(url, headers, payload) {
  return new Promise(function (resolve, reject) {
    var body = JSON.stringify(payload);
    var parsed = new URL(url);

    var req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      }, headers || {}),
    }, function (res) {
      var chunks = '';

      res.on('data', function (chunk) {
        chunks += chunk;
      });

      res.on('end', function () {
        var data;

        try {
          data = chunks ? JSON.parse(chunks) : {};
        } catch (err) {
          return reject(new Error('Invalid PayPlus response'));
        }

        if (res.statusCode < 200 || res.statusCode >= 300) {
          var msg = data.message || data.error || 'PayPlus request failed';
          var e = new Error(msg);
          e.statusCode = res.statusCode;
          e.response = data;
          return reject(e);
        }

        resolve(data);
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function createPaymentLink(order) {
  if (!isConfigured()) {
    var err = new Error('PayPlus is not configured');
    err.code = 'PAYPLUS_NOT_CONFIGURED';
    throw err;
  }

  var baseUrl = process.env.PUBLIC_SITE_URL || 'http://localhost:3000';

  var payload = {
    payment_page_uid: process.env.PAYPLUS_PAYMENT_PAGE_UID,

    amount: Number((order.totalAgorot / 100).toFixed(2)),
    currency_code: 'ILS',

    refURL_success: baseUrl + '/order/thank-you.html?order=' + encodeURIComponent(order.orderRef),
    refURL_failure: baseUrl + '/order/checkout.html?payment=failed&order=' + encodeURIComponent(order.orderRef),
    refURL_callback: baseUrl + '/api/payplus/webhook',

    customer: {
      customer_name: order.name,
      phone: order.phone,
    },

    more_info: order.orderRef,
  };

  return postJson(PAYPLUS_API_URL, {
    'api-key': process.env.PAYPLUS_API_KEY,
    'secret-key': process.env.PAYPLUS_SECRET_KEY,
  }, payload);
}

module.exports = {
  isConfigured: isConfigured,
  createPaymentLink: createPaymentLink,
};