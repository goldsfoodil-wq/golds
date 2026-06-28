'use strict';

function sendEmail(opts) {
  console.log('[email] STUB — would send to:', opts.to);
  console.log('[email] Subject:', opts.subject);
  console.log('[email] Body:\n' + opts.body);
  return Promise.resolve({ ok: true, mode: 'stub' });
}

module.exports = { sendEmail: sendEmail };