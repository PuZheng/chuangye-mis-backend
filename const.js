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

exports.storeOrderTypes = {
  MATERIAL: '原材料',
  PRODUCT: '产品',
};

exports.settingGroups = {
  电费: '电费',
  水费: '水费',
  蒸汽费: '蒸汽费',
  氰化钠分摊: '氰化钠分摊',
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
