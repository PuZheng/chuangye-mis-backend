var Router = require('restify-router').Router;
var restify = require('restify');
var knex = require('./knex');
var loginRequired = require('./login-required');
var co = require('co');
var casing = require('casing');
var getDepartment = require('./department').getObject;
var getMeterType = require('./meter-type').getObject;
var R = require('ramda');
var meterDef = require('./models').meters;

var router = new Router();

var getObject = function getObject(id) {
  return knex('meters')
  .where('id', id)
  .select('*')
  .then(function ([obj]) {
    return casing.camelize(obj);
  });
};

var fullfill = function fullfill(obj) {
  return co(function *() {
    if (obj.departmentId) {
      obj.department = yield getDepartment(obj.departmentId);
    }
    if (obj.parentMeterId) {
      obj.parentMeter = yield getObject(obj.parentMeterId);
    }
    obj.meterType = yield getMeterType(obj.meterTypeId);
    obj.meterReadings = yield knex('meter_readings').where('meter_id', obj.id)
    .orderBy('id').select('*').then(casing.camelize);
    return obj;
  });
};

router.get(
  '/object/:id',
  loginRequired,
  function (req, res, next) {
    return getObject(req.params.id)
    .then(fullfill)
    .then(function (obj) {
      res.json(obj);
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  }
);

var getHints = function getHints(req, res, next) {
  let kw = req.params.kw;
  knex('meters')
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
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/hints/:kw', loginRequired, getHints);

var list = function getList(req, res, next) {
  return co(function *() {
    let q = knex('meters');
    // filters
    let { kw, type, department } = req.params;
    kw && q.where('name', 'like', kw + '%');
    type && q.where('meter_type_id', type);
    department && q.where('department_id', department);

    let [{ count: totalCnt }] = yield q.clone().count('*');
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

router.get('/list', loginRequired, restify.queryParser(), list);

var create = function (req, res, next) {
  knex('meters')
  .where('name', req.body.name)
  .select('*')
  .then(function ([obj]) {
    if (obj) {
      res.json(400, {
        fields: {
          name: '已经存在该名称',
        }
      });
      return;
    }
    obj = R.pick(Object.keys(meterDef),
                 casing.snakeize(req.body));
    knex('meters')
    .insert(obj)
    .returning('id')
    .then(function ([id]) {
      res.json({ id });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  });
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var update = function update(req, res, next) {
  return co(function *() {
    let [{ count }] = yield knex('meters')
    .where('name', req.body.name)
    .whereNot('id', req.params.id)
    .count();
    if (Number(count) > 0) {
      res.json(400, {
        fields: {
          name: '已经存在该名称',
        }
      });
      next();
      return;
    }
    let data = R.pick(Object.keys(meterDef), casing.snakeize(req.body));
    yield knex('meters')
    .update(data)
    .where('id', req.params.id);
    res.json({});
    next();
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);
module.exports = { router, fullfill, getObject };
