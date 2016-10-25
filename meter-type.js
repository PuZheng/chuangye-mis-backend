var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var logger = require('./logger');
var R = require('ramda');
var layerify = require('./utils/layerify');
var { meter_readings: meterReadingDef, settings: settingsDef } = require('./models');


var router = new Router();

var list = function (req, res, next) {
  return co(function *() {
    let data = yield knex('meter_types').select('*').then(casing.camelize);
    for (let it of data) {
      it.meterReadings = yield knex
      .join('settings', 'meter_readings.price_setting_id', 'settings.id')
      .from('meter_readings')
      .where('meter_readings.meter_type_id', it.id)
      .select([
        ...Object.keys(meterReadingDef)
        .map(col => 'meter_readings.' + col), 
        ...Object.keys(settingsDef)
        .map(col => 'settings.' + col + ' as price_setting__' + col),
      ])
      .then(R.map(layerify))
      .then(R.map(casing.camelize));
    }
    res.json({ data });
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
          price_setting_id: mr.priceSettingId,
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
    .join('settings', 'settings.id', 'meter_readings.price_setting_id')
    .where('meter_type_id', obj.id)
    .select([
      ...Object.keys(meterReadingDef)
      .map(it => 'meter_readings.' + it),
      ...Object.keys(settingsDef)
      .map(it => 'settings.' + it + ' as price_setting__' + it),
    ])
    .then(R.map(layerify))
    .then(R.map(casing.camelize));

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
      .update({ name })
      .where({id});
      let oldMeterReadingIds = new Set(yield trx.select('id')
                                       .where('meter_type_id', id)
                                       .from('meter_readings')
                                       .then(R.map(R.prop('id'))));
      for (let mr of meterReadings) {
        if (!mr.id) {
          yield trx.insert({ 
            name: mr.name, 
            meter_type_id: id,
            price_setting_id: mr.priceSettingId,
          })
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
