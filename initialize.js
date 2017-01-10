#! /usr/bin/env node
var config = require('./config');
var logger = require('./logger');
var knex = require('./knex');
var co = require('co');
var {
  ROLES, ENTITY_TYPES, STORE_SUBJECT_TYPES, STORE_ORDER_DIRECTIONS,
  VOUCHER_SUBJECTS, VOUCHER_TYPES, SETTING_GROUPS, METER_TYPES
} = require('./const');
var R = require('ramda');

var admin = config.get('admin');

var createAdmin = function (trx) {
  return trx.raw(
    `
    INSERT INTO users (username, password, role) VALUES
    (:username, crypt(:password, gen_salt('md5')), :role);
    `,
    {
      username: admin.username,
      password: admin.password,
      role: ROLES.ADMIN
    }
  );
};

var createVoucherTypes = function (trx) {
  return trx.into('voucher_types').insert([{
    name: VOUCHER_TYPES.CASH,
  }, {
    name: VOUCHER_TYPES.BANK_VOUCHER,
  }]);
};

var createVoucherSubjects = function (trx) {
  return trx.batchInsert('voucher_subjects', [
    [VOUCHER_SUBJECTS.PRESET_EXPENSE, 'xtyszc', ENTITY_TYPES.TENANT, null, true,
      '用于初始化账户时，预设的当月支出'],
    [VOUCHER_SUBJECTS.PRESET_INCOME, 'xtyszc', null, ENTITY_TYPES.TENANT, true,
      '用于初始化账户时，预设的当月收入'],
    [ '应收货款', 'yshk', ENTITY_TYPES.CUSTOMER, ENTITY_TYPES.TENANT, true ],
    [ '应付货款', 'yfhk', ENTITY_TYPES.TENANT, ENTITY_TYPES.SUPPLIER, true ],
    [VOUCHER_SUBJECTS.原材料开支, 'yclkz', ENTITY_TYPES.TENANT,
      ENTITY_TYPES.OWNER, false, '承包人原材料开支'],
    [VOUCHER_SUBJECTS.水电煤气开支, 'sdmqkz', ENTITY_TYPES.TENANT,
      ENTITY_TYPES.OWNER, false, '承包人水电煤气开支']
  ].map(function (
    [name, acronym, payer_type, recipient_type, is_public, notes]
  ) {
    return {
      name, acronym, payer_type, recipient_type, is_public, notes
    };
  }));
};

var createInvoiceTypes = function (trx) {
  return Promise.all([
    trx('voucher_subjects').where('name', '应付货款').select('id'),
    trx('voucher_subjects').where('name', '应收货款').select('id'),
  ])
  .then(function (
    [[{ id: voucher_subject_id1 }], [{ id: voucher_subject_id2 }]]
  ) {
    let rows = [
      {
        name: '进项增值税',
        vendor_type: ENTITY_TYPES.SUPPLIER,
        purchaser_type: ENTITY_TYPES.TENANT,
        is_vat: true,
        store_subject_type: STORE_SUBJECT_TYPES.MATERIAL,
        store_order_direction: STORE_ORDER_DIRECTIONS.INBOUND,
        related_voucher_subject_id: voucher_subject_id1,
      }, {
        name: '销项增值税',
        vendor_type: ENTITY_TYPES.TENANT,
        purchaser_type: ENTITY_TYPES.CUSTOMER,
        is_vat: true,
        store_subject_type: STORE_SUBJECT_TYPES.PRODUCT,
        store_order_direction: STORE_ORDER_DIRECTIONS.OUTBOUND,
        related_voucher_subject_id: voucher_subject_id2,
      }, {
        name: '普通发票',
        purchaser_type: ENTITY_TYPES.OWNER,
        is_vat: false,
      }
    ];
    return trx.batchInsert('invoice_types', rows);
  });
};

var createMeterTypes = function(trx) {
  return trx.batchInsert(
    'meter_types', R.values(METER_TYPES).map(function (it) {
      return { name: it };
    })
  );
};

var createMeterReadingTypes = function *(trx) {
  let [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '电表');
  yield trx.batchInsert('meter_reading_types', [{
    name: '平电读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '高峰电价'))[0].id,
  }, {
    name: '谷电读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '低谷电价'))[0].id,
  }, {
    name: '峰电读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '尖峰电价'))[0].id,
  }]);
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '水表');
  yield trx.insert({
    name: '读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '工业水价'))[0].id,
  }).into('meter_reading_types');
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '蒸汽表');
  yield trx.insert({
    name: '读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '蒸汽价'))[0].id,
  }).into('meter_reading_types');
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '生活水表');
  yield trx.insert({
    name: '读数',
    meter_type_id,
    price_setting_id:
      (yield trx('settings').select('id').where('name', '生活水价'))[0].id,
  }).into('meter_reading_types');
};

var createSettings = function (trx) {
  var rows = [
    // 一般
    [ '上浮单价', '0.2' ],
    [ '增值税率', '0.17', '', SETTING_GROUPS.增值税率 ],
    // power
    [ '尖峰电价', '1.123', '元/度', SETTING_GROUPS.电费],
    [ '低谷电价', '0.457', '元/度', SETTING_GROUPS.电费],
    [ '高峰电价', '0.941', '元/度', SETTING_GROUPS.电费],
    [ '基本电费每KV', '30', '元/KV', SETTING_GROUPS.电费],
    [ '线损率', '6', '百分比', SETTING_GROUPS.电费],
    [ '变压器容量', '5200', 'KV', SETTING_GROUPS.电费],
    // water
    [ '工业水价', '3.3', '元/吨', SETTING_GROUPS.水费 ],
    [ '生活水价', '6.92', '元/吨', SETTING_GROUPS.水费 ],
    [ '污水治理价格', '41.0', '元/吨', SETTING_GROUPS.水费 ],
    [ '治理税可地税部分', '41.0', '元/吨', SETTING_GROUPS.水费 ],
    [ '污泥费价格', '0.71', '元/吨', SETTING_GROUPS.水费 ],
    // 蒸汽费用
    [ '蒸汽价', '261.8', '元/吨',  SETTING_GROUPS.蒸汽费 ],
    [ '线损蒸汽价', '226.8', '元/吨', SETTING_GROUPS.蒸汽费 ],
    [ '蒸汽线损', '7', '元/吨', SETTING_GROUPS.蒸汽费 ],
    // 氰化钠
    [ '氰化钠分摊单价', '680', '元/吨', SETTING_GROUPS.氰化钠分摊 ],
  ].map(function ([name, value, comment, group]) {
    return { name, value, comment, group };
  });
  return trx.batchInsert('settings', rows);
};

knex.transaction(function (trx) {
  return co(function *() {
    yield createAdmin(trx);
    yield createVoucherTypes(trx);
    yield createVoucherSubjects(trx);
    yield createInvoiceTypes(trx);
    yield createMeterTypes(trx);
    yield createSettings(trx);
    yield * createMeterReadingTypes(trx);
    yield trx.insert({
      name: '氰化钠',
      unit: 'kg',
      acronym: 'qhn',
      type: STORE_SUBJECT_TYPES.MATERIAL,
    }).into('store_subjects');
  });
})
.then(function () {
  logger.info('initializing done');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
