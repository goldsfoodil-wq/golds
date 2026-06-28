'use strict';

var providerName = process.env.PAYMENT_PROVIDER || 'payplus';

var providers = {
  payplus: require('./paymentProviders/payplusProvider'),
};

function getProvider() {
  return providers[providerName] || null;
}

function isConfigured() {
  var provider = getProvider();
  return Boolean(provider && provider.isConfigured && provider.isConfigured());
}

function createPaymentLink(order) {
  var provider = getProvider();

  if (!provider || typeof provider.createPaymentLink !== 'function') {
    var err = new Error('Payment provider is not supported');
    err.code = 'PAYMENT_PROVIDER_NOT_SUPPORTED';
    throw err;
  }

  return provider.createPaymentLink(order);
}

module.exports = {
  isConfigured: isConfigured,
  createPaymentLink: createPaymentLink,
};