exports.ROLES = {
  ADMIN: '管理员',
  ACCOUNTANT: '会计',
  CASHIER: '出纳'
};

exports.ENTITY_TYPES = {
  SUPPLIER: '供应商',
  CUSTOMER: '客户',
  TENANT: '承包人',
  OWNER: '业主',
};

exports.STORE_ORDER_DIRECTIONS = {
  INBOUND: '入库',
  OUTBOUND: '出库',
};

exports.STORE_SUBJECT_TYPES = {
  MATERIAL: '原材料',
  PRODUCT: '产品',
};

exports.SETTING_GROUPS = {
  一般: '一般',
  电费: '电费',
  水费: '水费',
  蒸汽费: '蒸汽费',
  氰化钠分摊: '氰化钠分摊',
};

exports.METER_TYPES = {
  水表: '水表',
  电表: '电表',
  蒸汽表: '蒸汽表',
  生活水表: '生活水表'
};

exports.METER_STATES = {
  NORMAL: '正常',
  ABNORMAL: '异常',
  IDLE: '闲置',
};

exports.INVOICE_STATES = {
  UNAUTHENTICATED: '未认证',
  AUTHENTICATED: '已认证',
  ABORTED: '已作废',
  DELETED: '已删除',
};

exports.INVOICE_ACTIONS = {
  EDIT: '编辑',
  AUTHENTICATE: '认证',
  ABORT: '作废',
  DELETE: '删除'
};

// 内建的凭证科目
exports.VOUCHER_SUBJECTS = {
  PRESET_INCOME: '系统预设收入',
  PRESET_EXPENSE: '系统预设支出',
};

// 内建的凭证类型
exports.VOUCHER_TYPES = {
  CASH: '现金凭证',
  BANK_VOUCHER: '银行凭证'
};

exports.PAYMENT_RECORD_TYPES = {
  原材料费用: '原材料费用',
  水电煤气: '水电煤气',
};

var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var router = new Router();

router.get('/', loginRequired, function (req, res, next) {
  res.json(exports);
  next();
});
exports.router = router;

