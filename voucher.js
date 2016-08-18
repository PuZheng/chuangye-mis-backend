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

var router = new  Router();

var getObject = function getObject(id) {
  return co(function *() {
    let voucher = casing.camelize(
      (yield knex('vouchers').select('*').where('id', id))[0]
    );
    voucher.date = moment(voucher.date).format('YYYY-MM-DD');
    voucher.voucherType = yield getVoucherType(voucher.voucherTypeId);
    voucher.voucherSubject = yield getVoucherSubject(voucher.voucherSubjectId);
    voucher.payer = yield getEntity(voucher.payerId);
    voucher.recipient = yield getEntity(voucher.recipientId);
    return voucher;
  });
};

var newObject = function newObject(req, res, next) {
  knex('vouchers')
  .insert(R.pick(Object.keys(voucherDef), casing.snakeize(req.body)))
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

module.exports = { router, getObject };


