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
  entities: entityDef,
  departments: departmentDef
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
    .then(function (list) {
      list = R.sort(R.descend(it => moment(it.name, 'YYYY-MM')), list);
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
  let makeHeader = function (s) {
    return Object.assign({ val: s }, header);
  };
  let 上月底累计收入Cell = {
    val: account.income,
    readonly: true,
    label: '上月底累计收入',
  };
  let 上月底累计支出Cell = {
    val: account.expense,
    readonly: true,
    label: '上月底累计支出',
  };
  let 上月底结存Cell = {
    val: `=@{${上月底累计收入Cell.label}} - @{${上月底累计支出Cell.label}}`,
    readonly: true,
  };
  let row0 = [
    makeHeader('截至上月累计收入(元)'), 上月底累计收入Cell, makeHeader('截至上月累计支出(元)'),
    上月底累计支出Cell, makeHeader('上月结存'), 上月底结存Cell,
  ];
  let row1 = [
    '日期', '凭证号', '科目', '类型', '收入方', '支付方', '收入(元)', '支出(元)', '备注',
  ].map(makeHeader);
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
      it.voucherType.name,
      it.recipient.name, it.payer.name,
      income, expense, it.notes,
    ].map(it => ({
      val: it,
      readonly: true,
    })));
  });
  let 本月总收入Cell = {
    val: thisMonthIncome,
    readonly: true,
    label: '本月总收入',
  };
  let 本月总支出Cell = {
    val: thisMonthExpense,
    readonly: true,
    label: '本月总支出',
  };
  let summaryRow = [
    makeHeader('总计'), void 0, void 0, void 0, void 0, void 0, 本月总收入Cell, 本月总支出Cell
  ];
  let 本月底累计收入Cell = {
    val: `=@{${上月底累计收入Cell.label}}+@{${本月总收入Cell.label}}`,
    readonly: true,
    label: '本月底累计收入',
  };
  let 本月底累计支出Cell = {
    val: `=@{${上月底累计支出Cell.label}}+@{${本月总支出Cell.label}}`,
    readonly: true,
    label: '本月底累计支出',
  };
  let 本月结存Cell = {
    val: `=@{${本月底累计收入Cell.label}}-@{${本月底累计支出Cell.label}}`,
    readonly: true,
  };
  let lastRow = [
    makeHeader('本月底累计收入(元)'), 本月底累计收入Cell, makeHeader('本月底累计支出(元)'),
    本月底累计支出Cell, makeHeader('本月结存(元)'), 本月结存Cell,
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
  let tenants = yield trx('tenants').select('*').then(casing.camelize);
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
    '承包人', '车间', '上月结转', '销项', '应抵', '进项', '进项发生', '经营费用发生', '差额'
  ]
  .map(it => Object.assign({
    val: it
  }, header));
  let grid = [
    row0, row1
  ];
  let tenants = yield trx('tenants')
  .join('entities', 'entities.id', 'tenants.entity_id')
  .join('accounts', 'accounts.tenant_id', 'tenants.id')
  .join('departments', 'departments.id', 'tenants.department_id')
  .select(
    ...Object.keys(tenantDef).map(it => 'tenants.' + it),
    ...Object.keys(entityDef).map(it => `entities.${it} as entity__${it}`),
    ...Object.keys(accountDef).map(it => `accounts.${it} as account__${it}`),
    ...Object.keys(departmentDef).map(it => `departments.${it} as department__${it}`)
  )
  .then(R.map(R.pipe(layerify, casing.camelize)));
  let paymentRecords = yield trx('payment_records')
  .where({ account_term_id: accountTermId }).select('*').then(casing.camelize);
  for (let tenant of tenants) {
    let tenantNameCell = {
      val: tenant.entity.name,
      readonly: true,
    };
    let deparmentNameCell = {
      val: tenant.department.name,
      readonly: true,
    };
    // 销售额是当期销项发票之和
    let 销售额 = R.sum(
      R.filter(
        R.and(R.propEq('vendorId', tenant.entityId), R.prop('isVat'))
      )(invoices).map(R.prop('amount'))
    );
    let 销售额Cell = {
      val: String(销售额),
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
    let 经营费用发生 = R.sum(R.filter(
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
    let 进项额 = R.sum(R.filter(
      R.and(R.prop('isVat'), R.propEq('purchaserId', tenant.entityId))
    )(invoices).map(R.prop('amount')));
    let 进项Cell = {
      val: String(进项额),
      readonly: true,
      label: tenant.id + '-进项额',
    };
    let 进项发生 = 进项额 * 当前税率 / (1 + 当前税率);
    let 进项发生Cell = {
      readonly: true,
      val: `=@{${进项Cell.label}} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
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
      tenantNameCell, deparmentNameCell, 上月结转Cell, 销售额Cell, 应抵Cell,
      进项Cell, 进项发生Cell, 经营费用发生Cell, 差额Cell,
    ]);
    yield trx('accounts').where('tenant_id', tenant.id).update({ tax_offset_balance: 差额 });
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
