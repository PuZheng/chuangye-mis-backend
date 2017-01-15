var restify = require('restify');
var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var casing = require('casing');
var knex = require('./knex');
var R = require('ramda');
var {
  account_terms: objDef,
  vouchers: voucherDef,
  voucher_subjects: voucherSubjectDef,
  voucher_types: voucherTypeDef
} = require('./models');
var co = require('co');
var { INVOICE_ACTIONS, ENTITY_TYPES, PAYMENT_RECORD_STATES } =
  require('./const');
var { sm } = require('./invoice');
var layerify = require('./utils/layerify');
var moment = require('moment');

var router = new Router();

var getObject = function getObject(id) {
  return knex('account_terms')
  .select('*')
  .where('id', id)
  .then(function ([o]) {
    return casing.camelize(o);
  });
};

router.get(
  '/list', loginRequired,
  function (req, res, next) {
    return knex('account_terms')
    .select('*')
    .orderBy('name', 'desc')
    .then(function (list) {
      res.json({ data: casing.camelize(list) });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex('account_terms')
    .insert(R.pick(Object.keys(objDef), req.body))
    .returning('id')
    .then(function ([id]) {
      res.json({id});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

// 创建收支明细表
var makeAccountBook = function ({ vouchers, account, entityId }) {
  let header = {
    readonly: true,
    style: {
      background: 'teal',
      color: 'yellow',
      fontWeight: 'bold',
    }
  };
  let row0 = [
    Object.assign({
      val: '截至上月累计收入(元)'
    }, header),
    account.income,
    Object.assign({
      val: '截至上月累计支出(元)',
    }, header),
    account.expense,
    Object.assign({
      val: '上月结存',
    }, header),
    account.income - account.expense,
  ];
  let row1 = [
    '日期', '凭证号', '科目', '类型', '备注', '收入方', '支付方', '收入(元)', '支出(元)',
  ].map(function (it) {
    return Object.assign({
      val: it,
    }, header);
  });
  let thisMonthExpense = 0;
  let thisMonthIncome = 0;
  let voucherRows = [];
  vouchers.forEach(function (it) {
    let income = it.recipientId == entityId? it.amount: 0;
    let expense = it.payerId == entityId? it.amount: 0;
    thisMonthIncome += income;
    thisMonthExpense += expense;
    voucherRows.push([
      moment(it.date).format('YYYY-MM'), it.number, it.voucherSubject.name,
      it.voucherType.name, it.notes,
      it.recipient.name, it.payer.name,
      income, expense
    ]);
  });
  let summaryRow = [
    '总计', void 0, void 0, void 0, void 0, void 0, void 0,
    thisMonthIncome, thisMonthExpense
  ].map(function (it) {
    return Object.assign({
      val: it
    }, header);
  });
  let lastRow = [
    Object.assign({
      val: '本月底累计收入(元)',
    }, header),
    account.income + thisMonthIncome,
    Object.assign({
      val: '本月底累计支出(元)',
    }, header),
    account.expense + thisMonthExpense,
    Object.assign({
      val: '本月结存(元)',
    }, header),
    account.income + thisMonthIncome - (account.expense + thisMonthExpense)
  ];
  return {
    sheets: [
      {
        grid: [
          row0,
          row1,
          ...voucherRows,
          summaryRow,
          lastRow
        ]
      }
    ]
  };
};

router.post(
  '/object/:id/:action', loginRequired,
  function (req, res, next) {
    let { id, action } = req.params;
    action = action.toUpperCase();
    knex.transaction(function (trx) {
      return co(function *() {
        if (action === 'CLOSE') {
          let [chargeBill] = yield knex('charge_bills')
          .where({ account_term_id: id })
          .select(['id', 'closed']);
          if (!chargeBill || !chargeBill.closed) {
            res.json(400, {
              reason: '本账期费用清单尚未创建或关闭!',
            });
            next();
            return;
          }
          let [ { count: unprocessedPaymentRecordCnt } ] =
            yield knex('payment_records').where({ account_term_id: id })
          .andWhere({ status: PAYMENT_RECORD_STATES.UNPROCESSED })
          .count();
          if (Number(unprocessedPaymentRecordCnt) > 0) {
            res.json(400, {
              reason: '请先处理本账期内所有的预扣记录!',
            });
            next();
            return;
          }
          // 认证所有的发票
          let invoices = yield trx('invoices').where({ account_term_id: id })
          .select('*');
          for (let invoice of invoices) {
            if (~sm.state(invoice.status).actions
                .indexOf(INVOICE_ACTIONS.AUTHENTICATE)) {
              yield sm.perform(INVOICE_ACTIONS.AUTHENTICATE, invoice.id);
            }
          }
          let entities = yield trx('entities')
          .where({ type: ENTITY_TYPES.TENANT }).select('*');
          // 为每个承包人生成账簿, 并更新累计收入/支出
          for (let entity of entities) {
            let [account] = yield knex('accounts').where('entity_id', entity.id)
            .select('*').then(casing.camelize);
            if (!account) {
              res.json(400, {
                reason: `承包人${entity.name}账户尚未初始化`,
              });
              next();
              return;
            }
            let vouchers = yield knex.where('vouchers.account_term_id', id)
            .where(function () {
              this.where('vouchers.payer_id', entity.id)
              .orWhere('vouchers.recipient_id', entity.id);
            })
            .join('voucher_subjects', 'vouchers.voucher_subject_id',
                  'voucher_subjects.id')
            .join('voucher_types', 'vouchers.voucher_type_id',
                  'voucher_types.id')
            .join('entities as payers', 'payers.id', 'vouchers.payer_id')
            .join('entities as recipients', 'recipients.id',
                  'vouchers.recipient_id')
            .orderBy('vouchers.date', 'desc').select([
              ...Object.keys(voucherDef).map(it => 'vouchers.' + it),
              ...Object.keys(voucherSubjectDef)
              .map(it => `voucher_subjects.${it} as voucher_subject__${it}`),
              ...Object.keys(voucherTypeDef)
              .map(it => `voucher_types.${it} as voucher_type__${it}`),
              'payers.name as payer__name', 'recipients.name as recipient__name'
            ])
            .from('vouchers')
            .then(R.map(R.pipe(layerify, casing.camelize)));
            yield trx('account_books').insert({
              account_term_id: id,
              entity_id: entity.id,
              def: JSON.stringify(makeAccountBook(
                { account: account, vouchers, entityId: entity.id }
              ))
            });
            let thisMonthExpense = 0;
            let thisMonthIncome = 0;
            for (let voucher of vouchers) {
              if (voucher.payerId == entity.id) {
                thisMonthExpense += voucher.amount;
              } else if (voucher.recipientId == entity.id) {
                thisMonthIncome += voucher.amount;
              }
            }
            yield trx('accounts').where('entity_id', entity.id)
            .increment('income', thisMonthIncome)
            .increment('expense', thisMonthExpense);
          }
          yield trx('account_terms').update({ closed: true })
          .where({ id });
        }
        res.json({});
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  }
);

module.exports = {
  router,
  getObject,
};
