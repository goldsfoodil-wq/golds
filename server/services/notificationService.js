'use strict';

var emailProvider    = require('./notifications/emailProvider');
var whatsappProvider = require('./notifications/whatsappProvider');

function buildOwnerOrderMessage(order) {
  var lines = [
    'הזמנה חדשה — ' + order.orderRef,
    '',
    'לקוח:        ' + order.customer.name,
    'טלפון:       ' + order.customer.phone,
    'תאריך אירוע: ' + order.customer.eventDate,
    'אספקה:       ' + (order.customer.deliveryType === 'delivery'
      ? 'משלוח — ' + (order.customer.address || '')
      : 'איסוף עצמי'),
  ];

  if (order.customer.notes) {
    lines.push('הערות:       ' + order.customer.notes);
  }

  lines.push('');
  lines.push('פריטים:');
  order.items.forEach(function (item) {
    lines.push('  • ' + item.name + ' × ' + item.qty + ' — ₪' + item.lineTotalShekel.toFixed(2));
  });

  lines.push('');
  lines.push('סה"כ: ₪' + order.totalShekel.toFixed(2));
  lines.push('תשלום: ' + order.paymentStatus);

  return lines.join('\n');
}

function sendOwnerEmail(order) {
  var ownerEmail = process.env.OWNER_EMAIL || '';
  if (!ownerEmail) {
    console.warn('[notificationService] OWNER_EMAIL not configured — skipping email');
    return Promise.resolve({ ok: false, reason: 'not_configured' });
  }
  return emailProvider.sendEmail({
    to:      ownerEmail,
    subject: 'הזמנה חדשה — ' + order.orderRef,
    body:    buildOwnerOrderMessage(order),
  });
}

function sendOwnerWhatsApp(order) {
  var ownerPhone = process.env.OWNER_WHATSAPP || '';
  if (!ownerPhone) {
    console.warn('[notificationService] OWNER_WHATSAPP not configured — skipping WhatsApp');
    return Promise.resolve({ ok: false, reason: 'not_configured' });
  }
  return whatsappProvider.sendWhatsApp({
    to:      ownerPhone,
    message: buildOwnerOrderMessage(order),
  });
}

module.exports = {
  buildOwnerOrderMessage: buildOwnerOrderMessage,
  sendOwnerEmail:         sendOwnerEmail,
  sendOwnerWhatsApp:      sendOwnerWhatsApp,
};