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
  voucher_types: voucherTypeDef,
  accounts: accountDef,
  tenants: tenantDef,
} = require('./models');
var co = require('co');
var { INVOICE_ACTIONS, PAYMENT_RECORD_STATES } =
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

// 创建承包人收支明细表
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

var authenticateInvoices = function *(trx, accountTermId) {
  let invoices = yield trx('invoices').where({ account_term_id: accountTermId })
  .select('*');
  for (let invoice of invoices) {
    if (~sm.state(invoice.status).actions.indexOf(INVOICE_ACTIONS.AUTHENTICATE)) {
      yield sm.perform(INVOICE_ACTIONS.AUTHENTICATE, invoice.id);
    }
  }
};

// 为每个承包人生成账簿, 并更新累计收入/支出
var makeAccountBooks = function *(trx, accountTermId) {
  let tenants = yield trx('tenants').select('*');
  for (let tenant of tenants) {
    let [account] = yield knex('accounts').where('tenant_id', tenant.id)
    .select('*').then(casing.camelize);
    let vouchers = yield knex.where('vouchers.account_term_id', accountTermId)
    .where(function () {
      this.where('vouchers.payer_id', tenant.entityId)
      .orWhere('vouchers.recipient_id', tenant.entityId);
    })
    .join('voucher_subjects', 'vouchers.voucher_subject_id', 'voucher_subjects.id')
    .join('voucher_types', 'vouchers.voucher_type_id', 'voucher_types.id')
    .join('entities as payers', 'payers.id', 'vouchers.payer_id')
    .join('entities as recipients', 'recipients.id', 'vouchers.recipient_id')
    .orderBy('vouchers.date', 'desc')
    .select([
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
      account_term_id: accountTermId,
      tenant_id: tenant.id,
      def: JSON.stringify(makeAccountBook(
        { account: account, vouchers, entityId: tenant.entityId }
      ))
    });
    let thisMonthExpense = 0;
    let thisMonthIncome = 0;
    for (let voucher of vouchers) {
      if (voucher.payerId == tenant.entityId) {
        thisMonthExpense += voucher.amount;
      } else if (voucher.recipientId == tenant.entityId) {
        thisMonthIncome += voucher.amount;
      }
    }
    yield trx('accounts').where('tenant_id', tenant.id)
    .increment('income', thisMonthIncome)
    .increment('expense', thisMonthExpense);
  }
};


// 生成经营报告， 并且修改用户抵税结转额
var makeOperatingReports = function *(trx, accountTermId) {
  let header = {
    readonly: true,
    style: {
      background: 'teal',
      color: 'yellow',
      fontWeight: 'bold',
    }
  };
  let invoices = yield trx('invoices').where({ account_term_id: accountTermId })
  .select('*').then(casing.camelize);
  let [{ value: 当前税率}] = yield trx('settings').where('name', '增值税率')
  .select('value');
  let taxRateCell = {
    val: 当前税率,
    label: '当前税率',
    readonly: true
  };
  let row0 = [Object.assign({
    val: '当前税率',
  }, header), taxRateCell];
  let row1 = [
    '车间', '销售额', '应抵', '上月结转', '经营费用发生', '进项发生', '差额'
  ]
  .map(it => Object.assign({
    val: it
  }, header));
  let grid = [
    row0, row1
  ];
  let tenants = yield trx('tenants')
  .join('accounts', 'accounts.tenant_id', 'tenants.id')
  .select(
    ...Object.keys(tenantDef).map(it => 'tenants.' + it),
    ...Object.keys(accountDef).map(it => `accounts.${it} as account__${it}`)
  )
  .then(R.map(R.pipe(layerify, casing.camelize)));
  let paymentRecords = yield trx('payment_records')
  .where({ account_term_id: accountTermId }).select('*').then(casing.camelize);
  for (let tenant of tenants) {
    let nameCell = {
      val: tenant.name,
      readonly: true,
    };
    // 销售额是当期销项发票之和
    let 销售额 = R.sum(
      R.find(
        R.and(R.propEq('vendorId', tenant.entityId), R.prop('isVat'))
      )(invoices).map(R.prop('amount'))
    );
    let 销售额Cell = {
      val: 销售额,
      readonly: true,
      label: tenant.id + '-销售额',
    };
    let 应抵 = 销售额 * 当前税率 / (1 + 当前税率);
    let 应抵Cell = {
      readonly: true,
      val: `=@{${销售额Cell.label}} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
      format: '%.2f',
      label: tenant.id + '-应抵',
    };
    let 上月结转Cell = {
      readonly: true,
      val: tenant.account.taxOffsetBalance,
      label: tenant.id + '-上月结转',
    };
    let 经营费用发生 = R.sum(R.find(
      R.and(R.propEq('status', PAYMENT_RECORD_STATES.PASSED),
            R.propEq('departmentId', tenant.departmentId))
    )(paymentRecords).map(R.prop('tax')));
    let 经营费用发生Cell = {
      readonly: true,
      val: 经营费用发生,
      format: '%.2f',
      label: tenant.id + '-经营费用发生',
    };
    // 进项额是当期进项发票之和
    let 进项额 = R.sum(R.find(
      R.and(R.prop('isVat'), R.propEq('purchaserId', tenant.id))
    )(invoices).map(R.prop('amount')));
    let 进项发生 = 进项额 * 当前税率 / (1 + 当前税率);
    let 进项发生Cell = {
      readonly: true,
      val: `=${进项额} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
      format: '%.2f',
      label: tenant.id + '-进项发生',
    };
    let 差额 = tenant.account.taxOffsetBalance + 进项发生 + 经营费用发生 - 应抵;
    let 差额Cell = {
      readonly: true,
      /* eslint-disable max-len */
      val: `=(@{${上月结转Cell.label}} + @{${进项发生Cell.label}} + @{${经营费用发生Cell.label}}) - @{${应抵Cell.label}}`,
      /* eslint-enable max-len */
      format: '%.2f'
    };
    grid.push([
      nameCell, 销售额Cell, 应抵Cell, 上月结转Cell, 经营费用发生Cell, 进项发生Cell, 差额Cell,
    ]);
    yield trx('accounts').where('tenant_id', tenant.id).update({ taxOffsetBalance: 差额 });
  }
  let def = { sheets: [{ grid }] };
  yield trx('operating_reports').insert({
    account_term_id: accountTermId,
    def,
  });
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
          yield *authenticateInvoices(trx);
          yield *makeAccountBooks(trx, id);
          yield *makeOperatingReports(trx, id);
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
  makeAccountBooks,
  makeOperatingReports
};
