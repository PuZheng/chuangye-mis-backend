#! /usr/bin/env node
var config = require('./config');
var logger = require('./logger');
var roles = require('./const').roles;
var knex = require('./knex');
var co = require('co');
var { entityTypes, storeOrderTypes, storeOrderDirections } = require('./const');

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
  }, {
    name: '谷电读数',
    meter_type_id,
  }, {
    name: '峰电读数',
    meter_type_id,
  }]);
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '水表');
  yield trx.insert({
    name: '读数',
    meter_type_id
  }).into('meter_readings');
  [{ id: meter_type_id }] = yield trx('meter_types').select('*')
  .where('name', '蒸汽表');
  yield trx.insert({
    name: '读数',
    meter_type_id
  }).into('meter_readings');
};

knex.transaction(function (trx) {
  return co(function *() {
    yield createAdmin(trx);
    yield createVoucherTypes(trx);
    yield createInvoiceTypes(trx);
    yield createMeterTypes(trx);
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
