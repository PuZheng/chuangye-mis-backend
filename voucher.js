var moment = require('moment');
var Router = require('restify-router').Router;
var knex = require('./knex');
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var restify = require('restify');
var R = require('ramda');
var voucherDef = require('./models').vouchers;
var co = require('co');
var getVoucherType = require('./voucher-type').getObject;
var getVoucherSubject = require('./voucher-subject').getObject;
var getEntity = require('./entity').getObject;
var getUser = require('./user').getObject;

var router = new  Router();

var getObject = function getObject(id) {
  return co(function *() {
    let voucher = casing.camelize(
      (yield knex('vouchers').select('*').where('id', id))[0]
    );
    voucher.date = moment(voucher.date).format('YYYY-MM-DD');
    return fullfill(voucher);
  });
};

var fullfill = function (obj) {
  return co(function *() {
    obj.voucherType = yield getVoucherType(obj.voucherTypeId);
    obj.voucherSubject = yield getVoucherSubject(obj.voucherSubjectId);
    obj.payer = yield getEntity(obj.payerId);
    obj.recipient = yield getEntity(obj.recipientId);
    obj.creator = yield getUser(obj.creatorId);
    return obj;
  });
};

var newObject = function newObject(req, res, next) {
  let voucher = R.pick(Object.keys(voucherDef), casing.snakeize(req.body));
  voucher.creator_id = req.user.id;
  knex('vouchers')
  .insert(voucher)
  .returning('id')
  .then(function ([id]) {
    res.send({ id });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.post('/object', loginRequired, restify.bodyParser(), newObject);

router.get('/object/:id', loginRequired, function (req, res, next) {
  getObject(req.params.id).then(function (o) {
    res.json(o);
    next();
  }).catch(function (e) {
    logger.error(e);
    next(e);
  });
});


var fetchList = function (req, res, next) {
  co(function *() {
    let q = knex('vouchers');
    // filters
    for (var col of [
      'voucher_type_id', 'voucher_subject_id', 'payer_id', 'recipient_id'
    ]) {
      let v = req.params[col];
      if (v) {
        q.where(col, '=', v);
      }
    }
    var numberLike = req.params['number__like'];
    if (numberLike) {
      q.whereRaw('UPPER(number) like ?', numberLike.toUpperCase() + '%');
    }
    var dateSpan = req.params['date_span'];
    if (dateSpan) {
      let m = dateSpan.match(/in_(\d+)_days/);
      if (m) {
        let target = moment().subtract(m[1], 'days').toDate();
        q.where('date', '>=', target);
      }
    }
    let totalCnt = (yield q.clone().count('*'))[0].count;

    // sort by
    if (req.params.sort_by) {
      let [col, order] = req.params.sort_by.split('.');
      q.orderBy(col, order || 'asc');
    }

    // offset & limit
    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select('vouchers.*');
    for (var i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
      data[i].date = moment(data[i].date).format('YYYY-MM-DD');
    }
    res.json({
      totalCnt,
      data,
    });
    next();
  });
};

router.get('/list', loginRequired, restify.queryParser(), fetchList);

router.get('/hints/:kw', loginRequired, function getHints(req, res, next) {
  knex('vouchers').whereRaw('UPPER(number) like ?', req.params.kw.toUpperCase() + '%')
  .then(function (list) {
    res.json({ data: list.map(it => it.number) });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
});


module.exports = { router, getObject };
