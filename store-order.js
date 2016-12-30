const TABLE_NAME = 'store_orders';

var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var knex = require('./knex');
var casing = require('casing');
var co = require('co');
var {
  [TABLE_NAME]: storeOrderDef,
  store_subjects: storeSubjectDef,
  departments: departmentDef,
  account_terms: accountTermDef
} = require('./models');
var layerify = require('./utils/layerify');
var R = require('ramda');
var moment = require('moment');

var router = new  Router();

var list = function (req, res, next) {
  return co(function *() {
    let q = knex(TABLE_NAME)
    .join(
      'store_subjects', 'store_subjects.id', 'store_orders.store_subject_id'
    )
    .join(
      'account_terms', 'account_terms.id', 'store_orders.account_term_id'
    );


    // filters
    for (
      let col of [
        'type', 'direction', 'subject_id', 'department_id',
        'account_term_id',
      ]
    ) {
      let v = req.params[col] || '';
      switch (col) {
      case 'subject_id': {
        v && q.where(TABLE_NAME + '.store_subject_id', v);
        break;
      }
      case 'type': {
        v && q.where('store_subjects.type', v);
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
    .leftOuterJoin('invoices', 'invoices.id', 'store_orders.invoice_id')
    .leftOuterJoin('departments', 'departments.id',
                   'store_orders.department_id')
    .select([
      ...Object.keys(storeOrderDef)
      .map(function (col) {
        return TABLE_NAME + '.' + col;
      }),
      ...Object.keys(storeSubjectDef)
      .map(function (col) {
        return 'store_subjects.' + col + ' as store_subject__' + col;
      }),
      ...Object.keys(accountTermDef)
      .map(it => `account_terms.${it} as account_term__${it}`),
      'invoices.id as invoice__id',
      'invoices.number as invoice__number',
      ...Object.keys(departmentDef)
      .map(it => `departments.${it} as department__${it}`)
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
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var create = function (req, res, next) {
  return co(function *() {
    let data = R.pick(Object.keys(storeOrderDef), casing.snakeize(req.body));
    let [ {id: account_term_id} ] = yield knex('account_terms')
    .where('name', moment(data.date).format('YYYY-MM')).select('id');
    data.account_term_id = account_term_id;
    let [id] = yield knex('store_orders')
    .insert(data)
    .returning('id');
    res.json({ id });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var object = function (req, res, next) {
  return knex('store_orders')
  .where('id', req.params.id)
  .then(function ([ obj ]) {
    res.json(casing.camelize(obj));
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/object/:id', loginRequired, object);

var update = function (req, res, next) {
  return knex('store_orders')
  .where('id', req.params.id)
  .update(R.pick(Object.keys(storeOrderDef), casing.snakeize(req.body)))
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

module.exports = { router };
