var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var casing = require('casing');
var loginRequired = require('./login-required');
var knex = require('./knex');
var logger = require('./logger');

var getObject = function (id) {
  return knex('invoice_types')
  .select('*').where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired, restify.queryParser(),
  function invoiceTypelistCb(req, res, next) {
    let q = knex('invoice_types');
    let { kw, vendor_type, purchaser_type, only_vat, material_type } = req.params;
    kw && q.where('name', 'like', kw + '%');
    vendor_type && q.where('vendor_type', vendor_type);
    purchaser_type && q.where('purchaser_type', purchaser_type);
    only_vat == '1' && q.where('is_vat', true),
    material_type && q.where('material_type', material_type);

    q
    .select('*')
    .then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    }).catch(function (e) {
      next(e);
    });
  }
);

var getHints = function(req, res, next) {
  let kw = req.params.kw;
  knex('invoice_types')
  .where('name', 'like', kw + '%')
  .select('name')
  .then(function (list) {
      res.json({ 
        data: list.map(function ({ name }) {
          return name;
        })
      });
      next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

module.exports = {
  router,
  getObject
};
