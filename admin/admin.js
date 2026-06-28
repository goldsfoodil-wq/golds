'use strict';

/* Shared utilities for all admin pages */

var ADMIN = (function () {

  var TOKEN_KEY = 'golds_admin_token';
  var API_BASE  = 'http://localhost:3001';

  // ── Auth ─────────────────────────────────────────────────────────────────

  function getToken() {
    try { return localStorage.getItem(TOKEN_KEY); } catch (_) { return null; }
  }

  function setToken(t) {
    try { localStorage.setItem(TOKEN_KEY, t); } catch (_) {}
  }

  function clearToken() {
    try { localStorage.removeItem(TOKEN_KEY); } catch (_) {}
  }

  function logout() {
    clearToken();
    window.location.href = 'login.html';
  }

  function requireAuth() {
    if (!getToken()) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  // ── Fetch wrapper ────────────────────────────────────────────────────────

  function apiFetch(path, options) {
    var opts = options || {};
    var headers = Object.assign(
      { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + getToken() },
      opts.headers || {}
    );
    return fetch(API_BASE + path, Object.assign({}, opts, { headers: headers }))
      .then(function (res) {
        if (res.status === 401) {
          logout();
          return Promise.reject(new Error('unauthorized'));
        }
        return res.json().then(function (data) {
          return { ok: res.ok, status: res.status, data: data };
        });
      });
  }

  // ── Formatters ───────────────────────────────────────────────────────────

  function formatDate(str) {
    if (!str) { return '—'; }
    var p = str.split('-');
    return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : str;
  }

  function fmtMoney(n) {
    if (n === undefined || n === null) { return '—'; }
    return n.toLocaleString('he-IL') + ' ₪';
  }

  function phoneToWA(phone) {
    var digits = String(phone || '').replace(/\D/g, '');
    if (digits.startsWith('972')) { return 'https://wa.me/' + digits; }
    if (digits.startsWith('0'))   { digits = '972' + digits.slice(1); }
    return 'https://wa.me/' + digits;
  }

  // ── Labels & badges ──────────────────────────────────────────────────────

  var STATUS_HE = {
    pending:   'ממתין',
    paid:      'שולם',
    preparing: 'בהכנה',
    ready:     'מוכן',
    delivered: 'סופק',
    cancelled: 'בוטל',
  };

  var PAYMENT_HE = {
    unpaid:   'לא שולם',
    paid:     'שולם',
    refunded: 'הוחזר',
  };

  function statusLabel(s)  { return STATUS_HE[s]  || s; }
  function paymentLabel(s) { return PAYMENT_HE[s] || s; }

  function statusBadge(s) {
    return '<span class="badge badge-' + s + '">' + statusLabel(s) + '</span>';
  }

  function paymentBadge(s) {
    return '<span class="badge badge-payment-' + s + '">' + paymentLabel(s) + '</span>';
  }

  function statusSelectHTML(currentStatus, id) {
    var opts = Object.keys(STATUS_HE).map(function (s) {
      return '<option value="' + s + '"' + (s === currentStatus ? ' selected' : '') + '>' + STATUS_HE[s] + '</option>';
    }).join('');
    return '<select class="status-select" data-id="' + id + '">' + opts + '</select>';
  }

  function waBtn(phone) {
    return '<a class="btn-wa" href="' + phoneToWA(phone) + '" target="_blank" rel="noopener" ' +
           'onclick="event.stopPropagation()">' +
           '<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.554 4.122 1.527 5.855L.057 23.457a.75.75 0 00.914.99l5.65-1.438A11.945 11.945 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.75a9.725 9.725 0 01-5.022-1.394l-.36-.214-3.726.949.966-3.628-.235-.373A9.693 9.693 0 012.25 12c0-5.376 4.374-9.75 9.75-9.75S21.75 6.624 21.75 12 17.376 21.75 12 21.75z"/></svg>' +
           'וואטסאפ</a>';
  }

  // ── URL params ───────────────────────────────────────────────────────────

  function getParam(key) {
    return new URLSearchParams(window.location.search).get(key) || '';
  }

  // ── Public ───────────────────────────────────────────────────────────────

  return {
    getToken:     getToken,
    setToken:     setToken,
    logout:       logout,
    requireAuth:  requireAuth,
    apiFetch:     apiFetch,
    formatDate:   formatDate,
    fmtMoney:     fmtMoney,
    phoneToWA:    phoneToWA,
    statusLabel:  statusLabel,
    paymentLabel: paymentLabel,
    statusBadge:  statusBadge,
    paymentBadge: paymentBadge,
    statusSelectHTML: statusSelectHTML,
    waBtn:        waBtn,
    getParam:     getParam,
    STATUS_HE:    STATUS_HE,
  };

}());