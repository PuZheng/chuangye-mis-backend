var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var co = require('co');
var casing = require('casing');
var getEntity = require('./entity').getObject;
var getDepartment = require('./department').getObject;
var { ENTITY_TYPES } = require('./const');
var R = require('ramda');
var moment = require('moment');
var { VOUCHER_SUBJECTS, VOUCHER_TYPES } = require('./const');
var {
  tenants: tenantDef,
  entities: entityDef,
  accounts: accountDef,
} = require('./models');
var layerify = require('./utils/layerify');

var router = new Router();

var getObject = function (id) {
  return knex('tenants')
  .where('id', id)
  .select('*')
  .then(casing.camelize)
  .then(function ([obj]) {
    return fullfill(obj);
  });
};

var fullfill = function (obj) {
  return co(function *() {
    obj.entity = yield getEntity(obj.entityId);
    obj.department = yield getDepartment(obj.departmentId);
    [obj.account] = yield knex('accounts').where({ tenant_id: obj.id })
    .select('*').then(casing.camelize);
    return obj;
  });
};

router.get('/object/:id', loginRequired, function (req, res, next) {
  return co(function *() {
    let [obj] = yield knex('tenants')
    .join('entities', 'entities.id', 'tenants.entity_id')
    .join('accounts', 'accounts.tenant_id', 'tenants.id')
    .where('tenants.id', req.params.id)
    .select(
      ...Object.keys(tenantDef).map(function (k) {
        return `tenants.${k} as ${k}`;
      }),
      ...Object.keys(entityDef).map(function (k) {
        return `entities.${k} as entity__${k}`;
      }),
      ...Object.keys(accountDef).map(function (k) {
        return `accounts.${k} as account__${k}`;
      })
    )
    .then(R.map(layerify))
    .then(casing.camelize);
    [{ sum: obj.account.thisMonthIncome }] = yield knex('vouchers')
    .join('account_terms', 'vouchers.account_term_id', 'account_terms.id')
    .where('vouchers.recipient_id', obj.entity.id)
    .andWhere('account_terms.name', moment().format('YYYY-MM'))
    .sum('amount');
    [{ sum: obj.account.thisMonthExpense }] = yield knex('vouchers')
    .join('account_terms', 'vouchers.account_term_id', 'account_terms.id')
    .where('vouchers.payer_id', obj.entity.id)
    .andWhere('account_terms.name', moment().format('YYYY-MM'))
    .sum('amount');
    res.json(obj);
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

router.get('/hints/:kw', loginRequired, function(req, res, next) {
  let kw = req.params.kw;
  knex('tenants')
  .join('entities', 'tenants.entity_id', '=', 'entities.id')
  .where('entities.name', 'like', kw + '%')
  .orWhere(knex.raw('UPPER(entities.acronym) like ?', kw.toUpperCase() + '%'))
  .select('entities.name', 'entities.acronym')
  .then(function (list) {
    res.json({
      data: list.map(function (i) {
        return {
          text: i.name,
          acronym: i.acronym
        };
      })
    });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

var fetchList = function (req, res, next) {
  co(function *() {
    let q = knex('tenants');
    let { kw, only_account_uninitialized } = req.params;

    if (kw) {
      kw = kw.toUpperCase();
      q
      .join('entities', 'tenants.entity_id', '=', 'entities.id')
      .whereRaw('UPPER(entities.name) like ?', kw + '%')
      .orWhere(knex.raw('UPPER(entities.acronym) like ?', kw + '%'));
    }

    if (only_account_uninitialized == '1') {
      q
      .whereNotExists(
        knex.select('id').from('accounts')
        .whereRaw('tenants.id = accounts.tenant_id')
      );
    }

    let totalCnt = (yield q.clone().count('*'))[0].count;

    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select('tenants.*');
    for (var i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
    }
    res.json({
      totalCnt,
      data,
    });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), fetchList);

var create = function (req, res, next) {
  knex.transaction(function (trx) {
    let {
      entity: {
        name,
        acronym,
      },
      departmentId,
      contact,
      account: {
        thisMonthIncome,
        thisMonthExpense,
        income,
        expense,
        taxOffsetBalance
      }
    } = req.body;
    return co(function *() {
      let [accountTerm] = yield trx('account_terms')
      .where('name', moment().format('YYYY-MM')).select('*');
      if (!accountTerm) {
        res.json(400, {
          reason: '当月账期' + moment().format('YYYY-MM') + '尚未创建',
        });
        next();
        return;
      }
      let entity = (yield knex('entities')
                    .where('name', name)
                   .select('*'))[0];
      if (entity) {
        res.json(400, {
          fields: {
            entity: {
              name: '已经存在该名称',
            }
          }
        });
        return;
      }
      let [entityId] = yield trx.insert({
        name,
        acronym,
        type: ENTITY_TYPES.TENANT,
      })
      .into('entities')
      .returning('id');
      let [id] = yield trx
      .insert({
        entity_id: entityId,
        department_id: departmentId,
        contact: contact,
      })
      .into('tenants')
      .returning('id');
      yield trx.insert({
        tenant_id: id,
        income,
        expense,
        tax_offset_balance: taxOffsetBalance,
      }).into('accounts');
      // 创建两条特殊凭证
      let [voucherSubjectPresetExpense] = yield trx('voucher_subjects')
      .where('name', VOUCHER_SUBJECTS.PRESET_EXPENSE).select('*');
      let [ voucherSubjectPresetIncome ] = yield trx('voucher_subjects')
      .where('name', VOUCHER_SUBJECTS.PRESET_INCOME).select('*');
      let [ voucherTypeCash ] = yield trx('voucher_types')
      .where('name', VOUCHER_TYPES.CASH).select('*');
      yield trx('vouchers').insert({
        number: VOUCHER_SUBJECTS.PRESET_EXPENSE + '-承包人ID' + id,
        amount: thisMonthExpense,
        date: new Date(),
        voucher_type_id: voucherTypeCash.id,
        voucher_subject_id: voucherSubjectPresetExpense.id,
        payer_id: entityId,
        notes: `承包人${name}的初始当月支出`,
        creator_id: req.user.id,
        account_term_id: accountTerm.id,
      });
      yield trx('vouchers').insert({
        number: VOUCHER_SUBJECTS.PRESET_INCOME + '-承包人ID' + id,
        amount: thisMonthIncome,
        date: new Date(),
        voucher_type_id: voucherTypeCash.id,
        voucher_subject_id: voucherSubjectPresetIncome.id,
        recipient_id: entityId,
        notes: `承包人${name}的初始当月收入`,
        creator_id: req.user.id,
        account_term_id: accountTerm.id,
      });
      res.json({ id });
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var updateObject = function (req, res, next) {
  co(function *() {
    let { id } = req.params;
    let [tenant] = yield knex('tenants').where('id', id).select('*');
    if (!tenant) {
      res.json(400, {
        message: '不存在该承包人',
      });
      next();
      return;
    }

    let {
      entity: {
        name,
        acronym,
      } = {},
      contact,
      departmentId
    } = req.body;
    if (name) {
      let [{ count }] = yield knex('tenants')
      .join('entities', 'tenants.entity_id', '=', 'entities.id')
      .where('entities.name', name)
      .whereNot('tenants.id', id)
      .count();
      if (Number(count) > 0) {
        res.json(400, {
          fields: {
            name: '已经存在该名称',
          }
        });
        next();
        return;
      }
    }
    yield knex.transaction(function (trx) {
      return co(function *(){
        if (name || acronym)  {
          let data = {};
          if (name != undefined) {
            data.name = name;
          }
          if (acronym != undefined) {
            data.acronym = acronym;
          }
          if (!R.isEmpty(data)) {
            yield trx('entities')
            .update(data)
            .where('id', tenant.entity_id);
          }
        }
        let data = {};
        if (contact) {
          data.contact = contact;
        }
        if (departmentId) {
          data.department_id = departmentId;
        }
        if (!R.isEmpty(data)) {
          yield trx('tenants')
          .update(data)
          .where('id', req.params.id);
        }
      });
    });
  })
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), updateObject);

router.post('/object/:id/:action', loginRequired, function (req, res, next) {
  let { id, action } = req.params;
  return knex.transaction(function (trx) {
    return co(function *() {
      let [obj] = yield trx('tenants')
      .where({ id }).then(casing.camelize);
      if (!obj) {
        res.json(404, {});
        next();
        return;
      }
      if (action == '补足抵税') {
        let accountTermName = moment().format('YYYY-MM');
        let [accountTerm] = yield trx('account_terms')
        .where({ name: accountTermName });
        if (!accountTerm) {
          res.json(400, {
            reason: '帐期' + accountTermName + '尚未创建!'
          });
          next();
          return;
        }
        let [account] = yield trx('accounts').where('tenant_id', id)
        .then(casing.camelize);
        let [{ id: voucher_type_id }] = yield trx('voucher_types')
        .where('name', VOUCHER_TYPES.BANK_VOUCHER);
        let [{ id: voucher_subject_id }] = yield trx('voucher_subjects')
        .where('name', VOUCHER_SUBJECTS.强制补足抵税);
        let [{ id: recipient_id }] = yield trx('entities')
        .where('name', ENTITY_TYPES.OWNER);
        yield trx('vouchers').insert({
          number: VOUCHER_SUBJECTS.强制补足抵税 + '-' + moment().format('YYYYMMDDHHmmSS'),
          amount: -account.taxOffsetBalance,
          date: new Date(),
          voucher_type_id,
          voucher_subject_id,
          payer_id: obj.entityId,
          recipient_id,
          notes: '强制补足抵税差额',
          creator_id: req.user.id,
          account_term_id: accountTerm.id
        });
        yield trx('accounts').update({ tax_offset_balance: 0 }).where({
          tenant_id: id
        });
        res.send('');
        next();
      }
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
});

module.exports = { router, getObject, fullfill };
