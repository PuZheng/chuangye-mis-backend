var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var knex = require('./knex');
var invoiceDef = require('./models').invoices;
var storeOrderDef = require('./models').store_orders;
var moment = require('moment');
var getInvoiceType = require('./invoice-type').getObject;
var getEntity = require('./entity').getObject;
var getStoreSubject = require('./store-subject').getObject;
var getUser = require('./user').getObject;
var R = require('ramda');
var StateMachine = require('./lite-sm');
var {
  INVOICE_STATES, INVOICE_ACTIONS, STORE_SUBJECT_TYPES, STORE_ORDER_DIRECTIONS
} =
  require('./const');

var sm = new StateMachine();

sm.addState(INVOICE_STATES.UNAUTHENTICATED, {
  [INVOICE_ACTIONS.EDIT]: INVOICE_STATES.UNAUTHENTICATED,
  [INVOICE_ACTIONS.DELETE]: INVOICE_STATES.DELETED,
  [INVOICE_ACTIONS.AUTHENTICATE]: INVOICE_STATES.AUTHENTICATED,
}, function (obj) {
  if (this.action == INVOICE_ACTIONS.EDIT) {
    return knex.transaction(function (trx) {
      return co(function *() {
        let { storeOrders } = obj;
        let [invoiceType] = yield trx('invoice_types')
        .where('id', obj.invoiceTypeId)
        .select('*')
        .then(casing.camelize);
        let storeOrderIdToDelete = new Set(
          (yield trx('store_orders').where('invoice_id', obj.id)
           .select('id'))
           .map(R.pipe(R.prop('id'), Number))
        );
        for (let so of (storeOrders || [])) {
          if (!so.id) {
            so = casing.snakeize(so);
            so.type = invoiceType.storeOrderType;
            so.direction = invoiceType.storeOrderDirection;
            so.invoice_id = obj.id;
            so.account_term_id = obj.accountTermId;
            so.date = obj.date;
            // 若采购原材料
            if (so.direction == STORE_ORDER_DIRECTIONS.INBOUND &&
                invoiceType.storeSubjectType == STORE_SUBJECT_TYPES.MATERIAL) {
              so.supplier_id = obj.vendorId;
            }
            // 若发货
            if (so.direction == STORE_ORDER_DIRECTIONS.OUTBOUND &&
                invoiceType.storeSubjectType == STORE_SUBJECT_TYPES.PRODUCT) {
              so.customer_id = obj.purchaserId;
            }
            yield trx.insert(R.pick(Object.keys(storeOrderDef), so))
            .into('store_orders');
          } else {
            storeOrderIdToDelete.delete(Number(so.id));
          }
        }
        for (let soId of storeOrderIdToDelete) {
          yield trx('store_orders').del().where({ id: soId });
        }
        obj = R.pick(Object.keys(invoiceDef), casing.snakeize(obj));
        yield trx('invoices').update(obj).where({ id: obj.id });
      });
    });
  }
})
.addState(INVOICE_STATES.AUTHENTICATED, {
  [INVOICE_ACTIONS.ABORT]: INVOICE_STATES.ABORTED,
}, function (id) {
  let actions = this.sm.actions;
  return knex('invoices').update({ status: this.label }).where({ id })
  .returning('status')
  .then(function ([ status ]) {
    return { status, actions, };
  });
})
.addState(INVOICE_STATES.ABORTED, null, function (id) {
  let actions = this.sm.actions;
  return knex('invoices').update({ status: this.label }).where({ id })
  .returning('status')
  .then(function ([ status ]) {
    return { status, actions, };
  });
})
.addState(INVOICE_STATES.DELETED, null, function (obj) {
  return knex.transaction(function (trx) {
    return co(function *() {
      yield trx('store_orders').del().where({ invoice_id: obj.id });
      yield trx('invoices').del().where({ id: obj.id });
    });
  });
});

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex.transaction(function (trx) {
      return co(function *() {
        let storeOrders = req.body.storeOrders;
        let data = R.pick(Object.keys(invoiceDef), casing.snakeize(req.body));
        data.creator_id = req.user.id;
        let [invoice] = yield trx
        .insert(data)
        .returning('*')
        .into('invoices')
        .then(casing.camelize);
        let [invoiceType] = yield knex('invoice_types')
        .where('id', data.invoice_type_id)
        .select('*')
        .then(casing.camelize);
        for (let so of (storeOrders || [])) {
          so = R.pick(Object.keys(storeOrderDef), casing.snakeize(so));
          so.direction = invoiceType.storeOrderDirection;
          so.invoice_id = invoice.id;
          so.date = invoice.date;
          so.account_term_id = invoice.accountTermId;
          // 若采购原材料
          if (so.direction == STORE_ORDER_DIRECTIONS.INBOUND &&
             invoiceType.storeSubjectType == STORE_SUBJECT_TYPES.MATERIAL) {
            so.supplier_id = invoice.vendorId;
          }
          // 若发货
          if (so.direction == STORE_ORDER_DIRECTIONS.OUTBOUND &&
             invoiceType.storeSubjectType == STORE_SUBJECT_TYPES.PRODUCT) {
            so.customer_id = invoice.purchaserId;
          }
          yield trx.insert(so).into('store_orders');
        }
        res.send(invoice);
        next();
      });
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

var fullfill = function (obj) {
  var getAccountTerm = require('./account-term').getObject;
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
    invoice.actions = sm.state(invoice.status).actions;
    res.json(invoice);
    next();
  }).catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

var list = function (req, res, next) {
  let q = knex('invoices');
  co(function *() {
    // filters
    for (
      let it of ['invoice_type_id', 'account_term_id', 'vendor_id',
        'purchaser_id', 'amount', 'status']
    ) {
      req.params[it] && q.where(it, req.params[it]);
    }
    let { date_span, number__like } = req.params;
    if (date_span) {
      let m = date_span.match(/in_(\d+)_days/);
      if (m) {
        let target = moment().subtract(m[1], 'days').toDate();
        q.where('date', '>=', target);
      }
    }
    number__like && q.whereRaw(
      'UPPER(number) like ?', number__like.toUpperCase() + '%'
    );

    let totalCnt = (yield q.clone().count('*'))[0].count;

    // sort by
    if (req.params.sort_by) {
      let [col, order] = req.params.sort_by.split('.');
      order = order || 'asc';
      switch (col) {
      case 'account_term': {
        q
        .join(
          'account_terms', 'account_terms.id', '=', 'invoices.account_term_id'
        )
        .orderBy('account_terms.id');
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
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

router.get('/hints/:kw', loginRequired, function getHints(req, res, next) {
  knex('invoices')
  .whereRaw('UPPER(number) like ?', req.params.kw.toUpperCase() + '%')
  .then(function (list) {
    res.json({ data: list.map(it => it.number) });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

var update = function (req, res, next) {
  let { id } = req.params;
  return knex('invoices').where({ id }).select('status')
  .then(function ([{ status }]) {
    return sm.state(status).perform(INVOICE_ACTIONS.EDIT, req.body)
    .then(function () {
      res.json({});
      next();
    })
    .catch(function (e) {
      if (e.code === StateMachine.INVALID_ACTION) {
        res.json(400, e);
      }
      throw e;
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

router.post(
  '/object/:id/:action', loginRequired,
  function (req, res, next) {
    let { id, action } = req.params;
    action = action.toUpperCase();
    return co(function *() {
      let [obj] = yield knex('invoices').where({ id }).select('*');
      sm.state(obj.status);
      try {
        return sm.perform(action, obj.id)
        .then(function (obj) {
          res.json(obj);
          next();
        });
      } catch (e) {
        if (e.code == StateMachine.INVALID_ACTION) {
          res.json(400, e);
          next();
          return;
        }
      }
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

var del = function (req, res, next) {
  let { id } = req.params;
  return knex('invoices').where({ id }).select('*')
  .then(function ([ obj ]) {
    try {
      return sm.state(obj.status).perform(INVOICE_ACTIONS.DELETE, obj)
      .then(function () {
        res.json({});
        next();
      });
    } catch (e) {
      if (e.code === StateMachine.INVALID_ACTION) {
        res.json(400, e);
        next();
        return;
      }
      throw e;
    }
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.del('/object/:id', loginRequired, del);

module.exports = {
  router,
  getObject,
  sm
};
