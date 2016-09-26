var restify = require('restify');
var Router = require('restify-router').Router;
var logger = require('./logger');
var loginRequired = require('./login-required');
var knex = require('./knex');
var moment = require('moment');
var casing = require('casing');
var co = require('co');
var getStoreSubject = require('./store-subject').getObject;

var router = new  Router();

var fullfill = function (obj) {
  return co(function *() {
    obj.storeSubject = yield getStoreSubject(obj.storeSubjectId); 
    if (obj.invoiceId) {
      [obj.invoice] = yield knex('invoices').select('number').where('id', obj.invoiceId);
    }
    return obj;
  });
};

var list = function (req, res, next) {
  return co(function *() {
    let q = knex('store_orders');

    // filters
    let { date_span, type, direction, subject_id } = req.params;
    if (date_span) {
      let m = date_span.match(/in_(\d+)_days/);
      if (m) {
        let target = moment().subtract(m[1], 'days').toDate();
        q.where('created', '>=', target);
      }
    }
    type && q.where('type', type);
    direction && q.where('direction', direction);
    subject_id && q.where('store_subject_id', subject_id);

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

    let data = yield q.select('*');
    for (let i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
    }
    res.json({
      data,
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

module.exports = { router };
