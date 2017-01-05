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
var StateMachine = require('./lite-sm');
var {
  ENTITY_TYPES,
  PAYMENT_RECORD_STATES: {
    UNPROCESSED,
    REJECTED,
    PASSED
  },
  PAYMENT_RECORD_ACTIONS: {
    PASS,
    REJECT
  },
  PAYMENT_RECORD_TYPE_VOUCHER_SUBJECT_MAP,
  VOUCHER_TYPES
} = require('./const');
var moment = require('moment');

var makeInternalVoucherNumber = function makeInternalVoucherNumber() {
  return '内' + moment().format('YYYYMMDDHHmmssSSS');
};

var sm = new StateMachine();

sm.addState(UNPROCESSED, {
  [PASS]: PASSED,
  [REJECT]: REJECTED
}, function (obj, creatorId) {
  let { id, amount, paymentRecordTypeId, accountTermId, departmentId } = obj;
  let { action } = this;
  return R.cond([
    [R.equals('PASS'), R.always(
      knex.transaction(function (trx) {
        return co(function *() {
          let [paymentRecordType] = yield trx('payment_record_types')
          .where('id', paymentRecordTypeId).select('*');
          let voucherSubjectName =
            PAYMENT_RECORD_TYPE_VOUCHER_SUBJECT_MAP[paymentRecordType.name];
          let [voucherSubject] = yield trx('voucher_subjects')
          .where('name', voucherSubjectName).select('*');
          let [payer] = yield trx('entities')
          .join('tenants', 'tenants.entity_id', 'entities.id')
          .join('departments', 'tenants.department_id', 'departments.id')
          .where('departments.id', departmentId)
          .select('*');
          let [recipient] = yield trx('entities')
          .where('type', ENTITY_TYPES.OWNER);
          let [voucherId] = yield trx('vouchers').insert({
            number: makeInternalVoucherNumber(),
            amount,
            date: new Date(),
            voucher_type_id: VOUCHER_TYPES.CASH,
            voucherSubjectId: voucherSubject.id,
            payer_id: payer.id,
            recipient_id: recipient.id,
            account_term_id: accountTermId,
            creator_id: creatorId,
          })
          .returning('id');
          yield trx('payment_records').where({ id })
          .update({ status: REJECTED, voucher_id: voucherId });
        });
      })
    )],
    [R.equals('REJECT'), R.always(knex('payment_records')
                                  .where({ id })
                                  .update({ status: REJECTED }))]
  ])(action);
});

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
    .then(R.map(function (paymentRecord) {
      paymentRecord.actions = sm.state(paymentRecord.status).actions;
    }))
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
