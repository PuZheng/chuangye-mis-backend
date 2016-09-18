var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var casing = require('casing');
var loginRequired = require('./login-required');
var knex = require('./knex');
var logger = require('./logger');
var objDef = require('./models').invoice_types;
var R = require('ramda');

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

var create = function (req, res, next) {
  let data = R.pick(Object.keys(objDef), casing.snakeize(req.body));
  knex('invoice_types')
  .where('name', data.name)
  .count()
  .then(function ([{ count }]) {
    if (Number(count) > 0) {
      res.json(403, {
        fields: {
          name: '已经存在该名称',
        }
      });
      next();
      return;
    }
    knex('invoice_types')
    .insert(data)
    .returning('id')
    .then(function ([id]) {
      res.json({
        id
      });
      next();
    })
    .catch(function (e) {
      logger.error(e);
      next(e);
    });
  });

};

router.post('/object', loginRequired, restify.bodyParser(), create);

var get = function (req, res, next) {
  knex('invoice_types')
  .where('id', req.params.id)
  .then(function ([obj]) {
    res.json(casing.camelize(obj));
    next();
  });
};

router.get('/object/:id', loginRequired, get);

var update = function (req, res, next) {
  let data = R.pick(Object.keys(objDef), casing.snakeize(req.body));
  knex('invoice_types')
  .where('name', data.name)
  .whereNot('id', req.params.id)
  .count()
  .then(function ([{ count }]) {
    if (Number(count) > 0) {
      res.json(403, {
        fields: {
          name: '已经存在该名称',
        }
      });
      next();
      return;
    }
    knex('invoice_types')
    .where('id', req.params.id)
    .update(data)
    .then(function () {
      res.json({});
      next();
    });
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

module.exports = {
  router,
  getObject
};
