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

exports.voucher_subjects = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  acronym: t => t.string('acronym'),
  payer_type: t => t.string('payer_type', R.values(CONST.entityTypes)),
  recipient_type: t => t.string('recipient_type', R.values(CONST.entityTypes)),
  is_public: t => t.boolean('is_public'),
  notes: t => t.string('notes'),
};


exports.invoice_types = {
  id: t => t.increments('id'),
  name: t => t.string('name').unique().notNullable(),
  vendor_type: t => t.enum('vendor_type', R.values(CONST.entityTypes)),
  purchaser_type: t => t.enum('purchaser_type', R.values(CONST.entityTypes)),
  is_vat: t => t.boolean('is_vat'),
  store_order_type: t => t.enum('store_order_type',
                                R.values(CONST.STORE_SUBJECT_TYPES)),
  store_order_direction: t => t.enum('store_order_direction',
                                    R.values(CONST.storeOrderDirections)),
  // 相关凭证科目， 用于基于发票去生成凭证
  related_voucher_subject_id: t => t.integer('related_voucher_subject_id')
  .references('voucher_subjects.id'),
};

exports.account_terms = {
  id: t => t.increments('id'),
  name: t => t.string('name').unique().notNullable(),
  created: t => t.timestamp('created').defaultTo(knex.fn.now()),
  closed: t => t.boolean('closed').defaultTo(false),
};

exports.entities = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  type: t => t.enum('type', R.values(CONST.entityTypes)).notNullable(),
  acronym: t => t.string('acronym'),
  created: t => t.timestamp('created').defaultTo(knex.fn.now())
};

exports.partners = {
  id: t => t.increments(),
  entity_id: t => t.integer('entity_id').references('entities.id')
  .notNullable(),
  tax_number: t => t.string('tax_number'),
  address: t => t.string('address'),
  bank: t => t.string('bank'), // 开户银行
  account: t => t.string('account'), // 银行账号
  contact: t => t.string('contact'), // 联系电话
  enabled: t => t.boolean('enabled').defaultTo(true),
};

exports.invoices = {
  id: t => t.increments('id'),
  invoice_type_id: t => t.integer('invoice_type_id')
  .references('invoice_types.id').notNullable(),
  date: t => t.date('date'),
  number: t => t.string('number').notNullable(),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable(),
  is_vat: t => t.boolean('is_vat'),
  vendor_id: t => t.integer('vendor_id').references('entities.id'),
  purchaser_id: t => t.integer('purchaser_id').references('entities.id'),
  notes: t => t.string('notes'),
  creator_id: t => t.integer('creator_id').references('users.id'),
  amount: t => t.integer('amount').notNullable(), // 金额
  tax_rate: t => t.integer('tax_rate'), // 有可能不牵扯到税额
  status: t => t.string('status').defaultTo(CONST.invoiceStatus.UNAUTHENTICATED)
};

exports.store_subjects = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  unit: t => t.string('unit', 8).notNullable(),
  acronym: t => t.string('acronym'),
  type: t => t.enum('type', R.values(CONST.STORE_SUBJECT_TYPES)).notNullable(),
};


exports.voucher_types = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
};

exports.vouchers = {
  id: t => t.increments(),
  number: t => t.string('number').notNullable().unique(),
  amount: t => t.integer('amount').notNullable(),
  date: t => t.date('date'),
  voucher_type_id: t => t.integer('voucher_type_id')
  .references('voucher_types.id'),
  voucher_subject_id: t => t.integer('voucher_subject_id')
  .references('voucher_subjects.id'),
  payer_id: t => t.integer('payer_id').references('entities.id'),
  recipient_id: t => t.integer('recipient_id').references('entities.id'),
  notes: t => t.string('notes'),
  creator_id: t => t.integer('creator_id').references('users.id'),
  created: t => t.timestamp('created').defaultTo(knex.fn.now()),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable(),
};

exports.departments = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  acronym: t => t.string('acronym'),
};

exports.tenants = {
  id: t => t.increments(),
  entity_id: t => t.integer('entity_id').references('entities.id')
  .notNullable(),
  contact: t => t.string('contact'),
  department_id: t => t.integer('department_id').references('departments.id')
};

exports.store_orders = {
  id: t => t.increments(),
  store_subject_id: t => t.integer('store_subject_id')
  .references('store_subjects.id'),
  quantity: t => t.float('quantity'),
  unit_price: t => t.float('unit_price', 2),
  invoice_id: t => t.integer('invoice_id').references('invoices.id'),
  direction: t => t.enum('direction', R.values(CONST.storeOrderDirections))
  .notNullable(),
  department_id: t => t.integer('department_id').references('departments.id'),
  date: t => t.date('date').notNullable(),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable(),
};


exports.settings = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  comment: t => t.string('comment'),
  value: t => t.string('value'),
  group: t => t.string('group'),
};

exports.meter_types = {
  id: t => t.increments(),
  name: t => t.string('name').notNullable().unique(),
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
  status: t => t.enum('status', R.values(CONST.meterStatus)).notNullable()
  .defaultTo(CONST.meterStatus.NORMAL),
  meter_type_id: t => t.integer('meter_type_id').references('meter_types.id'),
};

// 不同种类的设备可能有多个计数种类。例如电表有"高峰读数"，"峰谷读数"，"一般读数"
exports.meter_reading_types = {
  id: t => t.increments(),
  name: t => t.string('name').notNullable(),
  meter_type_id: t => t.integer('meter_type_id').references('meter_types.id'),
  // 相关价格配置项， 用于和读数一起生成计费表单
  price_setting_id: t => t.integer('price_setting_id').notNullable()
  .references('settings.id'),
};

exports.meter_readings = {
  id: t => t.increments(),
  value: t => t.float('value').notNullable(),
  meter_id: t => t.integer('meter_id').references('meters.id').notNullable(),
  meter_reading_type_id: t => t.integer('meter_reading_type_id')
  .references('meter_reading_types.id').notNullable(),
  '': t => t.unique(['meter_id', 'meter_reading_type_id']),
};


// 费用清单
exports.charge_bills = {
  id: t => t.increments(),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable().unique(),
  def: t => t.jsonb('def'),
  closed: t => t.boolean('closed').defaultTo(false),
};

// 承包人费用清单
exports.department_charge_bills = {
  id: t => t.increments(),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable(),
  department_id: t => t.integer('department_id').references('departments.id'),
  def: t => t.jsonb('def'),
  '': t => t.unique(['department_id', 'account_term_id'])
};

// 收支清单
exports.account_books = {
  id: t => t.increments(),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable(),
  entity_id: t => t.integer('entity_id').references('entities.id'),
  def: t => t.jsonb('def'),
  '': t => t.unique(['account_term_id', 'entity_id']),
};

exports.payment_records = {
  id: t => t.increments(),
  department_id: t => t.integer('department_id').references('departments.id'),
  account_term_id: t => t.integer('account_term_id')
  .references('account_terms.id').notNullable().unique(),
  finished: t => t.boolean('finished'),
  created: t => t.timestamp('created').defaultTo(knex.fn.now()),
  amount: t => t.timestamp('amount'),
  reason: t => t.string('reason')
};

exports.accounts = {
  id: t => t.increments(),
  entity_id: t => t.integer('entity_id').references('entities.id')
  .notNullable(),
  income: t => t.integer('income').notNullable(),
  expense: t => t.integer('expense').notNullable()
};
