var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('../knex');
var loginRequired = require('../login-required');
var co = require('co');
var casing = require('casing');
var R = require('ramda');
var departmentChargeBillGrid = require('./department-charge-bill-grid');
var { METER_TYPES, storeOrderDirections, STORE_SUBJECT_TYPES } =
  require('../const');
var chargeBillDef = require('./charge-bill-def');
var logger = require('../logger');
var layerify = require('../utils/layerify');
/* eslint-disable no-unused-vars */
var prettyjson = require('prettyjson');
/* eslint-enable no-unused-vars */
var { store_orders: storeOrderDef, store_subjects: storeSubjectDef } =
  require('../models');

var router = new Router();

var getOrCreate = function (req, res, next) {
  let { accountTermId } = req.body;
  return co(function *() {
    let [ obj ] = yield knex('charge_bills')
    .where('account_term_id', accountTermId)
    .select('*');
    if (obj) {
      res.json(casing.camelize(obj));
      next();
      return;
    }
    yield knex('charge_bills').insert({
      account_term_id: accountTermId,
      def: yield chargeBillDef(),
    })
    .returning('*')
    .then(function ([obj]) {
      res.json(casing.camelize(obj));
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.post('/object/', loginRequired, restify.bodyParser(), getOrCreate);

router.post(
  '/object/:id/:action', loginRequired,
  function (req, res, next) {
    let { id, action } = req.params;
    action = action.toUpperCase();
    return knex.transaction(function (trx) {
      return co(function *() {
        if (['CLOSE'].indexOf(action) == -1) {
          res.json(400, {
            reason: '非法的操作: ' + action,
          });
          next();
          return;
        }
        let [chargeBill] = yield trx('charge_bills')
        .where({ id }).then(casing.camelize);
        if (!chargeBill) {
          res.json(400, {
            reason: '费用清单不存在',
          });
          next();
          return;
        }
        yield createDepartmentChargeBills(trx, chargeBill);
        // modify each meter reading's value
        for (let sheet of chargeBill.def.sheets) {
          for (let row of sheet.grid.filter(
            it => !R.isArrayLike(it) && it.data.tag == 'meter'
          )) {
            for (let cell of row.cells) {
              if (R.path(['data', 'tag'])(cell) == 'meter-reading') {
                yield trx('meter_readings').update({ value: cell.val })
                .where({ id: cell.data.id });
              }
            }
          }
        }
        yield trx('charge_bills').update('closed', true).where({id});
        res.json({});
        next();
      })
      .catch(function (err) {
        res.log.error({ err });
        next(err);
      });
    });
  }
);

var list = function (req, res, next) {
  let q = knex('charge_bills');
  let { account_term_id } = req.params;
  if (account_term_id) {
    q.where('account_term_id', account_term_id);
  }
  q.select('*')
  .then(function (data) {
    res.json({ data, });
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.get('/list', loginRequired, restify.queryParser(), list);

var update = function (req, res, next) {
  let {def} = req.body;
  return knex('charge_bills').update({
    def,
  })
  .where('id', req.params.id)
  .then(function () {
    res.json({});
    next();
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.put('/object/:id', loginRequired, restify.bodyParser(), update);

var calcTotalElectricConsumptionAndFee = function (sheet) {
  let totalElectricFee = 0;
  let totalElectricConsumption = 0;
  for (let row of sheet.grid.filter(R.pathEq(['data', 'tag'], 'meter'))) {
    for (let cell of row.cells) {
      if (R.path(['data', 'tag'])(cell) == 'meter-reading') {
        let { lastAccountTermValue, price } = cell.data;
        let consumption =
          (cell.val - lastAccountTermValue) * Number(row.data.times);
        totalElectricConsumption += consumption;
        totalElectricFee += consumption * Number(price);
      }
    }
  }
  totalElectricFee = totalElectricFee.toFixed(2);
  return {
    totalElectricFee,
    totalElectricConsumption,
  };
};

var createDepartmentChargeBills = function *(trx, chargeBill) {
  let { def: { sheets }, accountTermId } = chargeBill;
  let 电表Sheet = R.find(R.propEq('label', METER_TYPES.电表))(sheets);
  let {
    totalElectricConsumption,
    totalElectricFee
  } = calcTotalElectricConsumptionAndFee(电表Sheet);
  /* eslint-disable max-len */
  logger.info(`公司总直接用电量: ${totalElectricConsumption}, 公司总直接电费: ${totalElectricFee}`);
  /* eslint-enable max-len */
  let settings = yield knex('settings').select('*')
  .then(casing.camelize);
  let storeOrders = yield knex('store_orders')
  .where('account_term_id', accountTermId)
  .where('direction', storeOrderDirections.OUTBOUND)
  .where('store_subjects.type', STORE_SUBJECT_TYPES.MATERIAL)
  .join('store_subjects', 'store_subjects.id', 'store_orders.store_subject_id')
  .select([
    ...Object.keys(storeOrderDef).map(it => 'store_orders.' + it),
    ...Object.keys(storeSubjectDef).map(
      it => 'store_subjects.' + it + ' as store_subject__' + it
    )
  ])
  .then(R.map(layerify))
  .then(casing.camelize);
  let data = {};
  let meterTypes = yield knex('meter_types').select('*').then(casing.camelize);
  for (let sheet of sheets) {
    let meterType = R.find(R.propEq('name', sheet.label))(meterTypes);
    for (let row of sheet.grid.filter(R.pathEq(['data', 'tag'], 'meter'))) {
      let { id, name, departmentId, times } = row.data;
      if (!data[departmentId]) {
        data[departmentId] = {};
      }
      if (!data[departmentId][meterType.id]) {
        data[departmentId][meterType.id] = R.clone(meterType);
        data[departmentId][meterType.id].meters = [];
      }

      let meterData = {
        id,
        name,
        times,
        meterReadings: row.cells
        .filter(R.pathEq(['data', 'tag'], 'meter-reading'))
        .map(function (cell) {
          let value = cell.val;
          return Object.assign(R.clone(cell.data), { value });
        })
      };
      data[departmentId][meterType.id].meters.push(meterData);
    }
  }
  for (let department_id in data) {
    let grid = departmentChargeBillGrid({
      meterTypes: R.values(data[department_id]),
      totalElectricConsumption,
      totalElectricFee,
      storeOrders: storeOrders.filter(so => so.departmentId == department_id),
      settings: R.fromPairs(settings.map(it => [it.name, it.value])),
    });
    logger.debug(prettyjson.render(grid.map(function (row) {
      if (Array.isArray(row)) {
        return row.map(function (cell) { return cell || ''; });
      }
      return { cells: row.cells.map(it => it || '') };
    })));
    yield trx('department_charge_bills').insert({
      account_term_id: accountTermId,
      department_id,
      def: { sheets: [ { grid } ] },
    });
  }
};

module.exports = {
  router,
  createDepartmentChargeBills,
};
