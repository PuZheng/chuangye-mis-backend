const TABLE_NAME = 'store_orders';

var restify = require('restify');
var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var knex = require('./knex');
var moment = require('moment');
var casing = require('casing');
var co = require('co');
var storeOrderDef = require('./models')[TABLE_NAME];
var storeSubjectDef = require('./models').store_subjects;
var layerify = require('./utils/layerify');
var R = require('ramda');

var router = new  Router();

var list = function (req, res, next) {
  return co(function *() {
    let q = knex(TABLE_NAME);

    // filters
    for (let col of ['date_span', 'type', 'direction', 'subject_id', 'tenant_id']) {
      let v = req.params[col];
      switch (col) {
        case 'date_span': {
          let m = v.match(/in_(\d+)_days/);
          if (m) {
            let target = moment().subtract(m[1], 'days').toDate();
            q.where(TABLE_NAME + '.created', '>=', target);
          }
          break;
        }
        case 'subject_id': {
          v && q.where(TABLE_NAME + '.store_subject_id', v);
          break;
        }
        default: 
          v && q.where(TABLE_NAME + '.' + col, v);
      }
    }

    let totalCnt = (yield q.clone().count('*'))[0].count;

    // sort by
    if (req.params.sort_by) {
      let [col, order] = req.params.sort_by.split('.');
      order = order || 'asc';
      switch (col) {
        case 'total_price': {
          q.orderByRaw('(quantity * unit_price) ' + order);
          break;
        }
        default: {
          q.orderBy(col, order);
          break;
        }
      }
    }

    // offset & limit
    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }

    let data = yield q
    .join('store_subjects', 'store_subjects.id', 'store_orders.store_subject_id')
    .leftOuterJoin('invoices', 'invoices.id', 'store_orders.invoice_id')
    .leftOuterJoin('tenants', 'tenants.id', 'store_orders.tenant_id')
    .join('entities', 'entities.id', 'tenants.entity_id')
    .select([
      ...Object.keys(storeOrderDef)
      .map(function (col) {
        return TABLE_NAME + '.' + col;
      }),
      ...Object.keys(storeSubjectDef)
      .map(function (col) {
        return 'store_subjects.' + col + ' as store_subject__' + col;
      }),
      'invoices.id as invoice__id',
      'invoices.number as invoice__number',
      'tenants.id as tenant__id',
      'entities.name as tenant__entity__name',
    ])
    .then(function (data) {
      return data.map(function (record) {
        let ret = layerify(record);
        if (!ret.invoice.id) {
          delete ret.invoice;
        }
        return ret;
      });
    });
    res.json({
      data: data.map(casing.camelize),
      totalCnt
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var create = function (req, res, next) {
  return knex('store_orders')
  .insert(R.pick(Object.keys(storeOrderDef), casing.snakeize(req.body)))
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
};

router.post('/object', loginRequired, restify.bodyParser(), create);

module.exports = { router };
