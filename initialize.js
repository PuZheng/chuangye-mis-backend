#! /usr/bin/env node
var config = require('./config');
var logger = require('./logger');
var roles = require('./const').roles;
var knex = require('./knex');
var co = require('co');
var { entityTypes, storeOrderTypes, storeOrderDirections } = require('./const');
var settingGroups = require('./const').settingGroups;

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
      role: roles.ADMIN
    } 
  );
};

var createVoucherTypes = function (trx) {
  return trx.into('voucher_types').insert([{
    name: '现金凭证'
  }, {
    name: '银行凭证'
  }]);
};

var createInvoiceTypes = function (trx) {
  let rows = [
    { 
      name: '进项增值税', 
      vendor_type: entityTypes.SUPPLIER,
      purchaser_type: entityTypes.TENANT,
      is_vat: true,
      store_order_type: storeOrderTypes.MATERIAL,
      store_order_direction: storeOrderDirections.INBOUND,
    }, {
      name: '销项增值税', 
      vendor_type: entityTypes.TENANT, 
      purchaser_type: entityTypes.CUSTOMER, 
      is_vat: true, 
      store_order_type: storeOrderTypes.PRODUCT,
      store_order_direction: storeOrderDirections.OUTBOUND,
    }, {
      name: '普通发票', 
      purchaser_type: entityTypes.OWNER, 
      is_vat: false,
    }
  ];
  return trx.batchInsert('invoice_types', rows);
};

var createMeterTypes = function(trx) {
  return trx.batchInsert('meter_types', [{ name: '电表' }, { name: '水表' }, { name: '蒸汽表' }]);
};

var createMeterReadings = function *(trx) {
  let [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '电表');
  yield trx.batchInsert('meter_readings', [{
    name: '平电读数',
    meter_type_id,
    price_setting_id: (yield trx('settings').select('id').where('name', '基本电价'))[0].id,
  }, {
    name: '谷电读数',
    meter_type_id,
    price_setting_id: (yield trx('settings').select('id').where('name', '低谷电价'))[0].id,
  }, {
    name: '峰电读数',
    meter_type_id,
    price_setting_id: (yield trx('settings').select('id').where('name', '高峰电价'))[0].id,
  }]);
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '水表');
  yield trx.insert({
    name: '读数',
    meter_type_id,
    price_setting_id: (yield trx('settings').select('id').where('name', '工业水价'))[0].id,
  }).into('meter_readings');
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '蒸汽表');
  yield trx.insert({
    name: '读数',
    meter_type_id,
    price_setting_id: (yield trx('settings').select('id').where('name', '工业水价'))[0].id,
  }).into('meter_readings');
};

var createSettings = function (trx) {
  var rows = [
    // power
    { name: '尖峰电价', value: '1.123', comment: '元/度', group: settingGroups.电费},
    { name: '低谷电价', value: '0.457', comment: '元/度', group: settingGroups.电费},
    { name: '高峰电价', value: '0.941', comment: '元/度', group: settingGroups.电费},
    { name: '基本电价', value: '30', comment: '元/KV', group: settingGroups.电费},
    { name: '线损率', value: '6', comment: '百分比', group: settingGroups.电费},
    { name: '变压器容量', value: '5200', comment: 'KV', group: settingGroups.电费},
    // water
    { name: '工业水价', value: '3.3', comment: '元/吨', group: settingGroups.水费 },
    { name: '生活水价', value: '6.92', comment: '元/吨', group: settingGroups.水费 },
    { name: '污水治理费', value: '41.0', comment: '元/吨', group: settingGroups.水费 },
    { name: '治理税可地税部分', value: '41.0', comment: '元/吨', group: settingGroups.水费 },
    { name: '污泥费', value: '0.71', comment: '元/吨', group: settingGroups.水费 },
    // 蒸汽费用
    { name: '蒸汽价', value: '261.8', comment: '元/吨',  group: settingGroups.蒸汽费 },
    { name: '线损蒸汽价', value: '226.8', comment: '元/吨', group: settingGroups.蒸汽费 },
    { name: '蒸汽线损', value: '7', comment: '元/吨', group: settingGroups.蒸汽费 },
    // 氰化钠
    { name: '氰化钠分摊', value: '680', comment: '元/吨', group: settingGroups.氰化钠分摊 },
  ];
  return trx.batchInsert('settings', rows);
};

knex.transaction(function (trx) {
  return co(function *() {
    yield createAdmin(trx);
    yield createVoucherTypes(trx);
    yield createInvoiceTypes(trx);
    yield createMeterTypes(trx);
    yield createSettings(trx);
    yield * createMeterReadings(trx);
  });
})
.then(function () {
  logger.info('completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
