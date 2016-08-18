var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');

var router = new  Router();

var getObject = function getObject(id) {
  return knex('voucher_types').select('*').where('id', id).then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get('/list', loginRequired, function voucherTypeList(req, res, next) {
  knex('voucher_types').select('*').then(function (list) {
    res.json({ data: casing.camelize(list) });
    next();
  }).catch(function (e) {
    next(e);
  });
});

module.exports = { router, getObject };
