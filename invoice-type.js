var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var casing = require('casing');
var loginRequired = require('./login-required');
var knex = require('./knex');

var getObject = function (id) {
  return knex('invoice_types')
  .select('*').where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired, 
  function invoiceTypelistCb(req, res, next) {
    knex('invoice_types').select('*').then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    }).catch(function (e) {
      next(e);
    });
  }
);

module.exports = {
  router,
  getObject
};
