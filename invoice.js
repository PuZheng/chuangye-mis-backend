var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var cofy = require('cofy');
var knex = require('./knex');
var invoiceDef = require('./models').invoices;
var materialNotesDef = require('./models').material_notes;
var moment = require('moment');
var getAccountTerm = require('./account-term').getObject;
var getInvoiceType = require('./invoice-type').getObject;
var getEntity = require('./entity').getObject;
var getMaterialSubject = require('./material-subject').getObject;
var getUser = require('./user').getObject;
var R = require('ramda');

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex.transaction(function (trx) {
      return co(function *() {
        let invoice = R.pick(Object.keys(invoiceDef), casing.snakeize(req.body));
        invoice.creator_id = req.user.id;
        let materialNotes = req.body.materialNotes;
        let [id] = yield trx
        .insert(casing.snakeize(invoice))
        .returning('id')
        .into('invoices');
        for (var mn of (materialNotes || [])) {
          mn = R.pick(Object.keys(materialNotesDef), casing.snakeize(mn));
          mn.invoice_id = id;
          yield trx.insert(mn).into('material_notes');
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
    obj.materialNotes = yield knex('material_notes').where('invoice_id', obj.id);
    for (var mn of obj.materialNotes) {
      mn.materialSubject = yield getMaterialSubject(mn.materialSubjectId);
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

var fetchList = function (req, res, next) {
  let q = knex('invoices');
  co(function *() {
    let totalCnt = (yield knex('invoices').count('*'))[0].count;
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
    // filters
    for (var it of [ 'invoice_type_id', 'account_term_id', 'vendor_id', 'purchaser_id' ]) {
      req.params[it] && q.where(it, req.params[it]);
    }
    let date_span = req.params.date_span;
    if (date_span) {
      let m = date_span.match(/in_(\d+)_days/);
      if (m) {
        let target = moment().subtract(m[1], 'days').toDate();
        q.where('date', '>=', target);
      }
    }
    let number = req.params.number;
    number && q.where('number', 'like', '%' + number + '%');

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

router.get('/list', loginRequired, restify.queryParser(), fetchList);

module.exports = {
  router,
  getObject,
};
