var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var knex = require('./knex');
var invoiceDef = require('./models').invoices;
var storeOrderDef = require('./models').store_orders;
var moment = require('moment');
var getAccountTerm = require('./account-term').getObject;
var getInvoiceType = require('./invoice-type').getObject;
var getEntity = require('./entity').getObject;
var getStoreSubject = require('./store-subject').getObject;
var getUser = require('./user').getObject;
var R = require('ramda');

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex.transaction(function (trx) {
      return co(function *() {
        let storeOrders = req.body.storeOrders;
        let data = R.pick(Object.keys(invoiceDef), casing.snakeize(req.body));
        data.creator_id = req.user.id;
        let [id] = yield trx
        .insert(data)
        .returning('id')
        .into('invoices');
        let [invoiceType] = yield knex('invoice_types')
        .where('id', data.invoice_type_id)
        .select('*')
        .then(casing.camelize);
        for (var so of (storeOrders || [])) {
          so = R.pick(Object.keys(storeOrderDef), casing.snakeize(so));
          so.type = invoiceType.storeOrderType;
          so.direction = invoiceType.storeOrderDirection;
          so.invoice_id = id;
          yield trx.insert(so).into('store_orders');
        }
        res.send({id});
        next();
      });
    })
    .catch(function (e) {
      logger.error(e.stack);
      next(e);
    });
  }
);

var fullfill = function (obj) {
  return co(function *() {
    obj.invoiceType = yield getInvoiceType(obj.invoiceTypeId);
    obj.accountTerm = yield getAccountTerm(obj.accountTermId);
    obj.vendor = yield getEntity(obj.vendorId);
    obj.purchaser = yield getEntity(obj.purchaserId);
    obj.storeOrders = yield knex('store_orders').where('invoice_id', obj.id)
    .then(casing.camelize);
    for (let so of obj.storeOrders) {
      so.storeSubject = yield getStoreSubject(so.storeSubjectId);
    }
    obj.creator = yield getUser(obj.creatorId);
    return obj;
  });
};

var getObject = function (id) {
  return knex('invoices').select('*').where('id', id)
  .then(function ([obj]) {
    obj = casing.camelize(obj);
    obj.date = moment(obj.date).format('YYYY-MM-DD');
    return fullfill(obj);
  });
};

router.get('/object/:id', loginRequired, function (req, res, next) {
  getObject(req.params.id).then(function (invoice) {
    res.json(invoice);
    next();
  }).catch(function (e) {
    logger.error(e);
    next(e);
  });
});

var list = function (req, res, next) {
  let q = knex('invoices');
  co(function *() {
    // filters
    for (var it of [ 'invoice_type_id', 'account_term_id', 'vendor_id', 'purchaser_id', 'amount' ]) {
      req.params[it] && q.where(it, req.params[it]);
    }
    let { date_span } = req.params;
    if (date_span) {
      let m = date_span.match(/in_(\d+)_days/);
      if (m) {
        let target = moment().subtract(m[1], 'days').toDate();
        q.where('date', '>=', target);
      }
    }
    let numberLike = req.params.number__like;
    numberLike && q.whereRaw('UPPER(number) like ?', numberLike.toUpperCase() + '%');
    let totalCnt = (yield q.clone().count('*'))[0].count;

    // sort by
    if (req.params.sort_by) {
      let [col, order] = req.params.sort_by.split('.');
      order = order || 'asc';
      switch (col) {
        case 'account_term': {
          q.join('account_terms', 'account_terms.id', '=', 'invoices.account_term_id').orderBy('account_terms.id');
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
    let data = yield q.select('invoices.*');
    for (var i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
      data[i].date = moment(data[i].date).format('YYYY-MM-DD');
    }
    res.json({
      totalCnt,
      data,
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

router.get('/hints/:kw', loginRequired, function getHints(req, res, next) {
  knex('invoices').whereRaw('UPPER(number) like ?', req.params.kw.toUpperCase() + '%')
  .then(function (list) {
    res.json({ data: list.map(it => it.number) });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
});

module.exports = {
  router,
  getObject,
};
