var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var R = require('ramda');
var layerify = require('./utils/layerify');
var {
  payment_records: paymentRecordDef,
  departments: departmentDef,
  vouchers: voucherDef
} = require('./models');

var router = new  Router();

var list = function list(req, res, next) {
  let q = knex('payment_records')
  .leftOuterJoin('departments', 'departments.id',
                 'payment_records.department_id')
  .leftOuterJoin('vouchers', 'vouchers.id', 'payment_records.voucher_id');

  return co(function *() {
    //filters
    //
    let totalCnt = (yield q.clone().count('*'))[0].count;
    // sort by
    //
    // offset & limit
    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select(
      ...Object.keys(paymentRecordDef).map(
        it => `payment_records.${it} as ${it}`
      ),
      ...Object.keys(departmentDef).map(
        it => `departments.${it} as department__${it}`
      ),
      ...Object.keys(voucherDef).map(
        it => `vouchers.${it} as voucher__${it}`
      )
    )
    .then(R.map(layerify))
    .then(casing.camelize);
    res.json({
      data,
      totalCnt,
    });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });

};

router.get('/list', loginRequired, restify.queryParser(), list);

module.exports = { router };
