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
  vouchers: voucherDef,
  account_terms: accountTermDef
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
        return co(function* () {
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
          return yield trx('payment_records').where({ id })
          .update({ status: REJECTED, voucher_id: voucherId })
          .returning('*')
          .then(casing.camelize);
        });
      })
    )],
    [R.equals('REJECT'), R.always(knex('payment_records')
                                  .where({ id })
                                  .update({ status: REJECTED })
                                  .returning('*')
                                  .then(casing.camelize)
                                 )]
  ])(action);
});

var router = new Router();

var list = function list(req, res, next) {
  return co(function* () {
    let q = knex('payment_records')
    .leftOuterJoin(
      'departments', 'departments.id', 'payment_records.department_id'
    )
    .leftOuterJoin('vouchers', 'vouchers.id', 'payment_records.voucher_id')
    .leftOuterJoin(
      'account_terms', 'account_terms.id', 'payment_records.account_term_id'
    );

    //filters
    let { account_term_id, department_id, type } = req.params;
    account_term_id && q.where(
      'payment_records.account_term_id', account_term_id
    );
    department_id && q.where(
      'payment_records.department_id', department_id
    );
    type && q.where('payment_records.type', type);
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
      ),
      ...Object.keys(accountTermDef).map(
        it => `account_terms.${it} as account_term__${it}`
      )
    )
    .then(R.map(layerify))
    .then(R.map(function (paymentRecord) {
      return Object.assign(paymentRecord, {
        actions: sm.state(paymentRecord.status).actions
      });
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

router.post('/object/:id/:action', loginRequired, function (req, res, next) {
  return co(function *() {
    let { id, action } = req.params;
    let [obj] = knex('payment_records').where({ id }).select('*')
    .then(casing.camelize);
    if (!obj) {
      res.send(404, {});
      next();
      return;
    }
    if (action != PASS || action != REJECT) {
      res.send(400, 'unknown ation: ' + action);
      next();
      return;
    }
    obj = yield sm.bundle(obj).perform(action, req.user.id);
    res.json(obj);
    next();
  });
});

module.exports = { router };
