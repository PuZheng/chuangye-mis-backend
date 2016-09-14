var Router = require('restify-router').Router;
var restify = require('restify');
var knex = require('./knex');
var loginRequired = require('./login-required');
var logger = require('./logger');
var co = require('co');
var casing = require('casing');
var getDepartment = require('./department').getObject;
var electricMeterStatus = require('./const').electricMeterStatus;
var R = require('ramda');
var electricMeterDef = require('./models').electric_meters;

var router = new Router();

var getObject = function getObject(id) {
  return knex('electric_meters') 
  .where('id', id)
  .select('*')
  .then(function ([obj]) {
    return casing.camelize(obj);
  });
};

var fullfill = function *fullfill(obj) {
  if (obj.departmentId) {
    obj.department = yield getDepartment(obj.departmentId);
  }
  if (obj.parentElectricMeterId) {
    obj.parentElectricMeter = yield getObject(obj.parentElectricMeterId);
  }
  return obj;
};

var getHints = function getHints(req, res, next) {
  let kw = req.params.kw;
  knex('electric_meters')
  .where('name', 'like', kw + '%')
  .select('name')
  .then(function (list) {
    res.json({
      data: list.map(function ({ name }) {
        return {
          text: name
        };
      })
    });
    next();
  })
  .catch(function (e) {
    logger.error(e);
    next(e);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

var getList = function getList(req, res, next) {
  return co(function *() {
    let q = knex('electric_meters');
    // filters
    let kw = req.params.kw;
    if (kw) {
      q.where('name', 'like', kw + '%');
    }
    let totalCnt = (yield q.clone().count('*'))[0].count;

    // offset & limit
    let {page, page_size} = req.params;
    if (page && page_size) {
      q.offset((req.params.page - 1) * page_size).limit(page_size);
    }
    let data = yield q.select('*');
    for (var i = 0; i < data.length; ++i) {
      data[i] = yield fullfill(casing.camelize(data[i]));
    }
    res.json({
      totalCnt,
      data,
    });
    next();
  });
};

router.get('/list', loginRequired, restify.queryParser(), getList);

var getStatusList = function getStatusList(req, res, next) {
  res.json({
    data: R.values(electricMeterStatus),
  });
  next();
};

router.get('/status-list', loginRequired, getStatusList);

var create = function (req, res, next) {
  knex('electric_meters')
  .where('name', req.body.name)
  .select('*')
  .then(function ([obj]) {
    if (obj) {
        res.json(403, {
          fields: {
            name: '已经存在该名称',
          }
        });
        return;
    }
    obj = R.pick(Object.keys(electricMeterDef), 
                     casing.snakeize(req.body));
    knex('electric_meters')
    .insert(obj)
    .returning('id')
    .then(function ([id]) {
      res.json({ id });
      next();
    })
    .catch(function (e) {
      logger.error(e);
      next(e);
    }); 
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

module.exports = { router };
