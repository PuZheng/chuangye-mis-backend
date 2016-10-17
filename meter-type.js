var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var logger = require('./logger');
var R = require('ramda');

var router = new Router();

var list = function (req, res, next) {
  knex('meter_types')    
  .select('*')
  .then(casing.camelize)
  .then(function (data) {
    return Promise.all(data.map(function (it) {
      return knex('meter_readings').select('*')
      .where('meter_type_id', it.id)
      .then(casing.camelize)
      .then(function (meterReadings) {
        it.meterReadings = meterReadings;
        return it;
      });
    }));
  }).then(function (data) {
    res.json({
      data,
    });
    next();
  });
};

router.get('/list', loginRequired, list);

var create = function (req, res, next) {
  knex.transaction(function (trx) {
    return co(function *() {
      let { name, meterReadings } = req.body;
      let [meterType] = yield trx.select('*')
      .where('name', name)
      .from('meter_types');
      if (meterType) {
        res.json(400, {
          fields: {
            name: '已经存在该名称',
          }
        });
        return;
      }
      let [meterTypeId] = yield trx.insert({ name })
      .returning('id')
      .into('meter_types');
      for (let mr of (meterReadings || [])) {
        yield trx.insert({
          name: mr.name,
          meter_type_id: meterTypeId,
        })
        .into('meter_readings');
      }
      res.send({ id: meterTypeId });
      next();
    })
    .catch(function (e) {
      logger.error(e.stack);
      next(e);
    });
  });
  
};

router.post('/object', loginRequired, restify.bodyParser(), create);

var object = function (req, res, next) {
  let { id } = req.params;
  return co(function *() {
    let [obj] = yield knex('meter_types')
    .where('id', id)
    .then(casing.camelize);
    obj.meterReadings = yield knex('meter_readings')
    .where('meter_type_id', obj.id)
    .then(casing.camelize);
    res.json(obj);
    next();
  });
};

router.get('/object/:id', loginRequired, object);

var update = function (req, res, next) {
  let { id }  = req.params;
  knex.transaction(function (trx) {
    return co(function *() {
      let { name, meterReadings=[] } = req.body;
      yield trx('meter_types')
      .update({ name });
      let oldMeterReadingIds = new Set(yield trx.select('id')
                                       .where('meter_type_id', id)
                                       .from('meter_readings')
                                       .then(R.map(R.prop('id'))));
      for (let mr of meterReadings) {
        if (!mr.id) {
          yield trx.insert({ name: mr.name, meter_type_id: id })
          .into('meter_readings');
        } else {
          oldMeterReadingIds.delete(mr.id);
        }
      }
      if (oldMeterReadingIds.size) {
        yield trx.whereIn('id', Array.from(oldMeterReadingIds)).delete().from('meter_readings');
      }
      res.json({});
      next();
    })
    .catch(function (e) {
      logger.error(e.stack);
      next(e);
    });
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

var del = function (req, res, next) {
  let { id } = req.params;
  knex.transaction(function (trx) {
    return co(function *() {
      let [ meterType ] = yield trx.from('meter_types').where('id', id).select('*');
      if (!meterType) {
        res.json(404, {});
        next();
        return;
      }
      let [ { count: meterCnt } ] = yield trx.from('meters').where('meter_type_id', id).count('*');
      if (Number(meterCnt) > 0) {
        res.json(400, {
          reason: '无法删除存在关联表设备的类型',
        });
        next();
        return;
      }
      yield trx.where('meter_type_id', id).del().from('meter_readings');
      yield trx.where('id', id).del().from('meter_types');
      res.json({});
      next();
    });
  })
  .catch(function (e) {
    logger.error(e.stack);
    next(e);
  });
};

router.del('/object/:id', loginRequired, del);

module.exports = { router };
