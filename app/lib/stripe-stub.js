// Stub: disable Stripe SDK loading in local development
module.exports.loadStripe = function () { return Promise.resolve(null) }
