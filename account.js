var Router = require('restify-router').Router;
var restify = require('restify');
var knex = require('./knex');
var loginRequired = require('./login-required');
var co = require('co');
var moment = require('moment');
var { voucherSubjects, voucherTypes } = require('./const');

var router = new Router();

var get = function get(req, res, next) {
  let { entity_id } = req.params;
  if (!entity_id) {
    throw new Error('lack parameter entity_id');
  }
  return co(function *() {
    let [accountTerm] = yield knex('account_terms')
    .where('name', moment().format('YYYY-MM')).select('*');
    let thisMonthIncome = 0;
    let thisMonthExpense = 0;
    if (accountTerm) {
      [{ sum: thisMonthIncome }] = yield knex('vouchers')
      .where('recipient_id', entity_id)
      .andWhere('account_term_id', accountTerm.id)
      .select(knex.raw('SUM(amount)'));
      [{ sum: thisMonthExpense }] = yield knex('vouchers')
      .where('payer_id', entity_id)
      .andWhere('account_term_id', accountTerm.id)
      .select(knex.raw('SUM(amount)'));
    }
    yield knex('accounts')
    .where({ entity_id })
    .then(function ([account]) {
      if (!account) {
        res.json(404, {});
      } else {
        res.json({
          id: account.id,
          thisYearIncome: account.income,
          thisYearExpense: account.expense,
          thisMonthIncome,
          thisMonthExpense,
        });
      }
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/object', loginRequired, restify.queryParser(), get);

var create = function (req, res, next) {
  // 这里对当月的收入/支出做特殊处理， 即增加一条特殊的收入/支出凭证,
  // 实际上并没有保存当月的收入/支出
  let { thisMonthIncome, thisMonthExpense, thisYearIncome,
    thisYearExpense, entityId } = req.body;
  return knex.transaction(function (trx) {
    return co(function *() {
      let [accountTerm] = yield trx('account_terms')
      .where('name', moment().format('YYYY-MM')).select('*');
      if (!accountTerm) {
        res.json(400, {
          reason: '当月账期' + moment().format('YYYY-MM') + '尚未创建',
        });
        next();
      }
      let [voucherSubjectPresetExpense] = yield knex('voucher_subjects')
      .where('name', voucherSubjects.PRESET_EXPENSE).select('*');
      let [ voucherSubjectPresetIncome ] = yield knex('voucher_subjects')
      .where('name', voucherSubjects.PRESET_INCOME).select('*');
      let [ voucherTypeCash ] = yield knex('voucher_types')
      .where('name', voucherTypes.CASH).select('*');
      let [ entity ] = yield knex('entities').where('id', entityId).select('*');
      yield trx('vouchers').insert({
        number: entityId + '-' + voucherSubjects.PRESET_EXPENSE,
        amount: thisMonthExpense,
        date: new Date(),
        voucher_type_id: voucherTypeCash.id,
        voucher_subject_id: voucherSubjectPresetExpense.id,
        payer_id: entityId,
        notes: `承包人${entity.name}的初始当月支出`,
        creator_id: req.user.id,
        account_term_id: accountTerm.id,
      });
      yield trx('vouchers').insert({
        number: entityId + '-' + voucherSubjects.PRESET_INCOME,
        amount: thisMonthIncome,
        date: new Date(),
        voucher_type_id: voucherTypeCash.id,
        voucher_subject_id: voucherSubjectPresetIncome.id,
        recipient_id: entityId,
        notes: `承包人${entity.name}的初始当月收入`,
        creator_id: req.user.id,
        account_term_id: accountTerm.id,
      });
      yield knex('accounts')
      .insert({
        income: thisYearIncome, expense: thisYearExpense,
        entity_id: entityId
      })
      .returning('id')
      .then(function ([id]) {
        res.json({ id });
        next();
      });
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

module.exports = { router };
