#! /usr/bin/env node
var config = require('./config');
var logger = require('./logger');
var roles = require('./const').roles;
var knex = require('./knex');
var co = require('co');
var { materialTypes, entityTypes } = require('./const');

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
      material_type: materialTypes.INBOUND
    }, {
      name: '销项增值税', 
      vendor_type: entityTypes.TENANT, 
      purchaser_type: entityTypes.CUSTOMER, 
      is_vat: true, 
      material_type: materialTypes.OUTBOUND
    }, {
      name: '普通发票', 
      purchaser_type: entityTypes.OWNER, 
      is_vat: false,
    }
  ];
  return trx.batchInsert('invoice_types', rows);
};

knex.transaction(function (trx) {
  return co(function *() {
    yield createAdmin(trx);
    yield createVoucherTypes(trx);
    yield createInvoiceTypes(trx);
  });
})
.then(function () {
  logger.info('completed');
  knex.destroy();
}, function (e) {
  logger.error(e);
  knex.destroy();
});
