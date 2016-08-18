var knex = require('./knex');
var CONST = require('./const');
var R = require('ramda');

exports.users = {
  id: t => t.increments('id'),
  username: t => t.string('username').unique(),
  password: t => t.string('password'),
  role: t => t.enum('role', R.values(CONST.roles)).notNullable(),
  created: t => t.timestamp('created').defaultTo(knex.fn.now())
};

exports.invoice_types = {
  id: t => t.increments('id'),
  name: t => t.string('name').unique().notNullable(),
  vendor_type: t => t.enum('vendor_type', R.values(CONST.entityTypes).concat('')),
  purchaser_type: t => t.enum('purchaser_type', R.values(CONST.entityTypes).concat('')),
  is_vat: t => t.boolean('is_vat'),
  material_type: t => t.enum('material_type', R.values(CONST.materialTypes).concat('')),
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
};

exports.material_subjects = {
  id: t => t.increments(),
  name: t => t.string('name').unique().notNullable(),
  unit: t => t.string('unit', 8).notNullable(),
  type: t => t.enum('type', R.values(CONST.materialTypes)).notNullable,
};


exports.material_notes = {
  id: t => t.increments(),
  material_subject_id: t => t.integer('material_subject_id').references('material_subjects.id'),
  quantity: t => t.float('quantity'),
  unit_price: t => t.float('unit_price', 2),
  tax_rate: t => t.float('tax_rate'),
  invoice_id: t => t.integer('invoice_id').references('invoices.id'),
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


