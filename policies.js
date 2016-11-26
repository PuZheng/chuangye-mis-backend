var roles = require('./const').roles;
exports[roles.ACCOUNTANT] = new Set([
  'view.invoice.list',
  'edit.invoice.object',
]);
exports[roles.CASHIER] = new Set([
  'view.voucher.list',
  'view.voucher.object',
  'edit.voucher.object',
  'manage.store',
  'edit.charge_bill',
  'view.invoice.list',
  'edit.invoice.object',
]);
exports[roles.ADMIN] = new Set([
  'edit.department',
  'view.tenant.list',
  'edit.tenant.object',
  'edit.settings',
  'edit.meter',
  'edit.meter_type',
  'edit.account_term',
  'edit.invoice_type',
  'edit.voucher_subject',
  'edit.user',
  'edit.store_subject',
  'edit.partner',
]);
