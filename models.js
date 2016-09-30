var knex = require('./knex');
var CONST = require('./const');
var R = require('ramda');

exports.users = {
  id: t => t.increments('id'),
  username: t => t.string('username').unique(),
  password: t => t.string('password'),
  role: t => t.enum('role', R.values(CONST.roles)).notNullable(),
  created: t => t.timestamp('created').defaultTo(knex.fn.now()),
  enabled: t => t.boolean('enabled').defaultTo(true),
};

exports.invoice_types = {
  id: t => t.increments('id'),
  name: t => t.string('name').unique().notNullable(),
  vendor_type: t => t.enum('vendor_type', R.values(CONST.entityTypes)),
  purchaser_type: t => t.enum('purchaser_type', R.values(CONST.entityTypes)),
  is_vat: t => t.boolean('is_vat'),
  store_order_type: t => t.enum('store_order_type', 
                                R.values(CONST.storeOrderTypes)),
  store_order_direction: t => t.enum('store_order_direction',
                                    R.values(CONST.storeOrderDirections)),
};

exports.account_terms = {
  id: t => t.increments('id'),
  name: t => t.string('name').unique().notNullable(),
  created: t => t.timestamp('created').defaultTo(knex.fn.now())
};

exports.entities = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  type: t => t.enum('type', R.values(CONST.entityTypes)).notNullable(),
  acronym: t => t.string('acronym'),
  created: t => t.timestamp('created').defaultTo(knex.fn.now())
};

exports.invoices = {
  id: t => t.increments('id'),
  invoice_type_id: t => t.integer('invoice_type_id').references('invoice_types.id').notNullable(),
  date: t => t.date('date'),
  number: t => t.string('number').notNullable(),
  account_term_id: t => t.integer('account_term_id').references('account_terms.id').notNullable(),
  is_vat: t => t.boolean('is_vat'),
  vendor_id: t => t.integer('vendor_id').references('entities.id'),
  purchaser_id: t => t.integer('purchaser_id').references('entities.id'),
  notes: t => t.string('notes'),
  creator_id: t => t.integer('creator_id').references('users.id'),
  amount: t => t.integer('amount').notNullable(), // 金额
  tax_rate: t => t.integer('tax_rate'), // 有可能不牵扯到税额
};

exports.store_subjects = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  unit: t => t.string('unit', 8).notNullable(),
  acronym: t => t.string('acronym'),
};


exports.voucher_types = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
};

exports.voucher_subjects = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  acronym: t => t.string('acronym'),
  payer_type: t => t.string('payer_type', R.values(CONST.entityTypes)),
  recipient_type: t => t.string('recipient_type', R.values(CONST.entityTypes)),
  notes: t => t.string('notes'),
  is_public: t => t.boolean('is_public'),
};

exports.vouchers = {
  id: t => t.increments(),
  number: t => t.string('number').notNullable(),
  date: t => t.date('date'),
  voucher_type_id: t => t.integer('voucher_type_id').references('voucher_types.id'),
  voucher_subject_id: t => t.integer('voucher_subject_id').references('voucher_subjects.id'),
  is_public: t => t.boolean('is_public'),
  payer_id: t => t.integer('payer_id').references('entities.id'),
  recipient_id: t => t.integer('recipient_id').references('entities.id'),
  notes: t => t.string('notes'),
  creator_id: t => t.integer('creator_id').references('users.id'),
};

exports.departments = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  acronym: t => t.string('acronym'),
};

exports.tenants = {
  id: t => t.increments(),
  entity_id: t => t.integer('entity_id').references('entities.id').notNullable(),
  contact: t => t.string('contact'),
  department_id: t => t.integer('department_id').references('departments.id')
};

exports.store_orders = {
  id: t => t.increments(),
  store_subject_id: t => t.integer('store_subject_id').references('store_subjects.id'),
  quantity: t => t.float('quantity'),
  unit_price: t => t.float('unit_price', 2),
  invoice_id: t => t.integer('invoice_id').references('invoices.id'),
  direction: t => t.enum('direction', R.values(CONST.storeOrderDirections)).notNullable(),
  type: t => t.enum('type', R.values(CONST.storeOrderTypes)).notNullable(),
  created: t => t.timestamp('created').defaultTo(knex.fn.now()),
  tenant_id: t => t.integer('tenant_id').references('tenants.id'),
};


exports.settings = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  comment: t => t.string('comment'),
  value: t => t.string('value'),
  group: t => t.string('group'),
};

exports.meters = {
  id: t => t.increments(),
  name: t => t.string('name').notNullable(),
  // 是否是总表
  is_total: t => t.boolean('is_total'),
  department_id: t => t.integer('department_id').references('departments.id'),
  // 倍数
  times: t => t.integer('times').notNullable().defaultTo(1),
  parent_meter_id: t => t.integer('parent_meter_id').references('meters.id'),
  status: t => t.enum('status', R.values(CONST.meterStatus)).notNullable().defaultTo(CONST.meterStatus.NORMAL),
  type: t => t.enum('type', R.values(CONST.meterTypes)).notNullable()
};
