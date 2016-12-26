exports.roles = {
  ADMIN: '管理员',
  ACCOUNTANT: '会计',
  CASHIER: '出纳'
};

exports.entityTypes = {
  SUPPLIER: '供应商',
  CUSTOMER: '客户',
  TENANT: '承包人',
  OWNER: '业主',
};

exports.storeOrderDirections = {
  INBOUND: '入库',
  OUTBOUND: '出库',
};

exports.STORE_SUBJECT_TYPES = {
  MATERIAL: '原材料',
  PRODUCT: '产品',
};

exports.settingGroups = {
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

exports.meterStatus = {
  NORMAL: '正常',
  ABNORMAL: '异常',
  IDLE: '闲置',
};

var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var router = new Router();

router.get('/', loginRequired, function (req, res, next) {
  res.json(exports);
  next();
});
exports.router = router;

exports.invoiceStatus = {
  UNAUTHENTICATED: '未认证',
  AUTHENTICATED: '已认证',
  ABORTED: '已作废',
  DELETED: '已删除',
};

exports.invoiceActions = {
  EDIT: '编辑',
  AUTHENTICATE: '认证',
  ABORT: '作废',
  DELETE: '删除'
};

// 内建的凭证科目
exports.voucherSubjects = {
  PRESET_INCOME: '系统预设收入',
  PRESET_EXPENSE: '系统预设支出',
};

// 内建的凭证类型
exports.voucherTypes = {
  CASH: '现金凭证',
  BANK_VOUCHER: '银行凭证'
};
