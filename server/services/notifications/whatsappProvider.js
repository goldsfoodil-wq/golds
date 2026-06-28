'use strict';

function sendWhatsApp(opts) {
  console.log('[whatsapp] STUB — would send to:', opts.to);
  console.log('[whatsapp] Message:\n' + opts.message);
  return Promise.resolve({ ok: true, mode: 'stub' });
}

module.exports = { sendWhatsApp: sendWhatsApp };