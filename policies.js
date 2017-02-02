var { ROLES } = require('./const');
exports[ROLES.ACCOUNTANT] = new Set([
  'view.invoice.list',
  'edit.invoice.object',
]);
exports[ROLES.CASHIER] = new Set([
  'view.voucher.list',
  'view.voucher.object',
  'edit.voucher.object',
  'manage.store',
  'edit.charge_bill',
  'view.invoice.list',
  'edit.invoice.object',
  'view.tenant.list',
  'edit.tenant.object',
  'edit.payment_record',
  'edit.account_term',
  'edit.department',
  'edit.chemical_supplier',
]);
exports[ROLES.ADMIN] = new Set([
  'edit.department',
  'edit.settings',
  'edit.meter',
  'edit.meter_type',
  'edit.account_term',
  'edit.invoice_type',
  'edit.voucher_subject',
  'edit.user',
  'edit.store_subject',
  'edit.partner',
  'edit.meter_reading',
  'edit.payment_record'
]);
