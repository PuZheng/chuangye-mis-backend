var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new  Router();

router.get('/list', loginRequired, function voucherTypeList(req, res, next) {
  knex('voucher_types').select('*').then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }).catch(function (e) {
    next(e);
  });
});

module.exports = { router };
