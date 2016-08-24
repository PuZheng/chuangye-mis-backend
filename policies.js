var roles = require('./roles');
exports[roles.ACCOUNTANT] = new Set([
  'view.invoice.list',
  'edit.invoice.object',
]);
exports[roles.CASHIER] = new Set([
  'view.voucher.list',
  'view.voucher.object',
  'edit.voucher.object',
]);
exports[roles.ADMIN] = new Set([
  'edit.department',
  'view.tenant.list',
]);
