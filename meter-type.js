var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var R = require('ramda');
var layerify = require('./utils/layerify');
var { meter_reading_types: meterReadingTypeDef, settings: settingsDef }
= require('./models');


var router = new Router();

var list = function (req, res, next) {
  return co(function *() {
    let data = yield knex('meter_types').select('*').then(casing.camelize);
    for (let it of data) {
      it.meterReadingTypes = yield knex
      .join('settings', 'meter_reading_types.price_setting_id', 'settings.id')
      .from('meter_reading_types')
      .where('meter_reading_types.meter_type_id', it.id)
      .select([
        ...Object.keys(meterReadingTypeDef)
        .map(col => 'meter_reading_types.' + col),
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
      let { name, meterReadingTypes } = req.body;
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
      for (let mrt of (meterReadingTypes || [])) {
        yield trx.insert({
          name: mrt.name,
          meter_type_id: meterTypeId,
          price_setting_id: mrt.priceSettingId,
        })
        .into('meter_reading_types');
      }
      res.send({ id: meterTypeId });
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
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
    obj.meterReadingTypes = yield knex('meter_reading_types')
    .join('settings', 'settings.id', 'meter_reading_types.price_setting_id')
    .where('meter_type_id', obj.id)
    .select([
      ...Object.keys(meterReadingTypeDef)
      .map(it => 'meter_reading_types.' + it),
      ...Object.keys(settingsDef)
      .map(it => 'settings.' + it + ' as price_setting__' + it),
    ])
    .then(R.map(layerify))
    .then(R.map(casing.camelize));

    res.json(obj);
    next();
  });
};

var getObject = function (id) {
  return co(function *() {
    let [obj] = yield knex('meter_types')
    .where('id', id)
    .then(casing.camelize);
    obj.meterReadingTypes = yield knex('meter_reading_types')
    .join('settings', 'settings.id', 'meter_reading_types.price_setting_id')
    .where('meter_type_id', obj.id)
    .select([
      ...Object.keys(meterReadingTypeDef)
      .map(it => 'meter_reading_types.' + it),
      ...Object.keys(settingsDef)
      .map(it => 'settings.' + it + ' as price_setting__' + it),
    ])
    .then(R.map(layerify))
    .then(R.map(casing.camelize));
    return obj;
  });
};

router.get('/object/:id', loginRequired, object);

var update = function (req, res, next) {
  let { id }  = req.params;
  knex.transaction(function (trx) {
    return co(function *() {
      let { name, meterReadingTypes=[] } = req.body;
      yield trx('meter_types')
      .update({ name })
      .where({id});
      let oldMeterReadingTypeIds = new Set(yield trx.select('id')
                                           .where('meter_type_id', id)
                                           .from('meter_reading_types')
                                           .then(R.map(R.prop('id'))));
      for (let mrt of meterReadingTypes) {
        if (!mrt.id) {
          yield trx.insert({
            name: mrt.name,
            meter_type_id: id,
            price_setting_id: mrt.priceSettingId,
          })
          .into('meter_reading_types');
        } else {
          oldMeterReadingTypeIds.delete(mrt.id);
        }
      }
      if (oldMeterReadingTypeIds.size) {
        yield trx.whereIn('id', Array.from(oldMeterReadingTypeIds)).delete()
        .from('meter_reading_types');
      }
      res.json({});
      next();
    })
    .catch(function (err) {
      res.log.error({ err });
      next(err);
    });
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

var del = function (req, res, next) {
  let { id } = req.params;
  knex.transaction(function (trx) {
    return co(function *() {
      let [ meterType ] = yield trx.from('meter_types').where('id', id)
      .select('*');
      if (!meterType) {
        res.json(404, {});
        next();
        return;
      }
      let [ { count: meterCnt } ] = yield trx.from('meters')
      .where('meter_type_id', id).count('*');
      if (Number(meterCnt) > 0) {
        res.json(400, {
          reason: '无法删除存在关联表设备的类型',
        });
        next();
        return;
      }
      yield trx.where('meter_type_id', id).del().from('meter_reading_types');
      yield trx.where('id', id).del().from('meter_types');
      res.json({});
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.del('/object/:id', loginRequired, del);

module.exports = { router, getObject };
