var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var casing = require('casing');
var loginRequired = require('./login-required');
var knex = require('./knex');
var objDef = require('./models').invoice_types;
var R = require('ramda');
var layerify = require('./utils/layerify');
var voucherSubjectDef = require('./models').voucher_subjects;


var getObject = function (id) {
  return knex('invoice_types')
  .select('*').where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired, restify.queryParser(),
  function listCb(req, res, next) {
    let q = knex('invoice_types');
    let { kw, vendor_type, purchaser_type, only_vat, material_type } = req.params;
    kw && q.where('name', 'like', kw + '%');
    vendor_type && q.where('vendor_type', vendor_type);
    purchaser_type && q.where('purchaser_type', purchaser_type);
    only_vat == '1' && q.where('is_vat', true),
    material_type && q.where('material_type', material_type);

    q
    .leftOuterJoin(
      'voucher_subjects', 'voucher_subjects.id',
      'invoice_types.related_voucher_subject_id'
    )
    .select([
      ...Object.keys(objDef).map(R.concat('invoice_types.')),
      ...Object.keys(voucherSubjectDef).map(
        it => `voucher_subjects.${it} as related_voucher_subject__${it}`
      )
    ])
    .then(R.map(R.pipe(layerify, casing.camelize)))
    .then(function (data) {
      res.json({ data, });
      next();
    })
    .catch(function (e) {
      req.log.error(e);
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
  .catch(function (err) {
    res.log.error({ err });
    next(err);
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
      res.json(400, {
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
    .catch(function (err) {
      res.log.error({ err });
      next(err);
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
      res.json(400, {
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
