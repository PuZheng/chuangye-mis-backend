var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('../knex');
var loginRequired = require('../login-required');
var co = require('co');
var casing = require('casing');
var R = require('ramda');
var departmentChargeBillGrid = require('./department-charge-bill-grid');
var { METER_TYPES } = require('../const');

var router = new Router();

var create = function (req, res, next) {
  let {accountTermId, def} = req.body;
  return co(function *() {
    let [{ count }] = yield knex('charge_bills')
    .where('account_term_id', accountTermId)
    .count();
    if (count > 0) {
      res.json(403, {
        reason: '一个帐期只能对应一个费用清单',
      });
    }
    yield knex('charge_bills').insert({
      account_term_id: accountTermId,
      def,
    })
    .returning('id')
    .then(function ([id]) {
      res.json({ id });
      next();
    });
  })
  .catch(function (err) {
    res.log.error({ err });
    next(err);
  });
};

router.post('/object/', loginRequired, restify.bodyParser(), create);

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
        yield *createDepartmentChargeBills();
        // create charge bills for each department
        let { sheets }  = chargeBill.def;
        let settings = yield knex('settings').select('*')
        .then(casing.camelize);
        // 计算(公司)总实际用电和总直接电费
        // 表读数类型id -> 该类型下所有表实际读数之和
        let totalElectricFee = 0;
        let totalElectricConsumption = 0;
        let 电表Sheet = R.find(R.propEq('label', METER_TYPES.电表))(sheets);
        // 表id -> 表倍数
        let meterTimesMap = R.fromPairs(
          meters.map(it => [it.id, it.times])
        );
        for (let row of 电表Sheet.grids) {
          for (let cell of row) {
            if (R.path(['data', 'tag'])(cell) == 'meter-reading') {
              let { lastAccountTermValue, meterId, price } = cell.data;
              let consumption =
                (cell.val - lastAccountTermValue) * meterTimesMap[meterId];
              totalElectricConsumption += consumption;
              totalElectricFee += consumption * price;
            }
          }
        }

        let meters = yield knex('meters').select(['id', 'times'])
        .then(casing.camelize);
        // 车间ID -> ( 表类型 -> (表 -> 表读数) )
        let data = {};
        for (let sheet of sheets) {
          for (let row of sheet.grids) {
            if (!Array.isArray(row)) {
              let tag = R.path(['data', 'tag'])(row);
              if (tag == 'meter') {
                let { id, name, departmentId, times } = row.data;
                if (!data[departmentId]) {
                  data[departmentId] = {};
                }
                let meterTypeId = R.path(['data', 'meterTypeId'])(row);
                if (!data[departmentId][meterTypeId]) {
                  data[departmentId][meterTypeId] = [];
                }
                let meterData = {
                  id,
                  name,
                  times,
                  meterReadings: row.cells
                  .filter(R.path(['data', 'tag'], 'meter-reading'))
                  .map(R.prop('data'))
                };
                data[departmentId][meterTypeId].push(meterData);
              }
            }
          }
        }
        for (let department_id in data) {
          yield trx('department_charge_bills').insert({
            account_term_id: chargeBill.accountTermId,
            department_id,
            def: departmentChargeBillGrid({
              meterTypes: R.values(data[department_id]),
              totalElectricConsumption,
              totalElectricFee,
              settings: R.fromPairs(settings.map(it => [it.name, it.value])),
            })
          });
        }
        // modify each meter reading's value
        for (let sheet of sheets) {
          for (let row of sheet.grids) {
            for (let cell of row) {
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

module.exports = {
  router,
  createDepartmentChargeBills,
};
