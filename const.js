exports.roles = {
  ADMIN: 'admin',
  ACCOUNTANT: 'accountant',
  CASHIER: 'cashier'
};

exports.entityTypes = {
  SUPPLIER: '供应商',
  CUSTOMER: '客户',
  TENANT: '承包人',
  OWNER: '业主',
};

exports.materialTypes = {
  INBOUND: '入库',
  OUTBOUND: '出库',
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

exports.meterTypes = {
  ELECTRIC: '电表',
  WATER: '水表',
  STEAM: '蒸汽表',
};


var Router = require('restify-router').Router;
var loginRequired = require('./login-required');
var router = new Router();

router.get('/', loginRequired, function (req, res, next) {
  res.json(exports);
  next();
});
exports.router = router;

