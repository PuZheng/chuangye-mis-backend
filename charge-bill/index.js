var restify = require('restify');
var Router = require('restify-router').Router;
var knex = require('./knex');
var loginRequired = require('./login-required');
var co = require('co');
var casing = require('casing');
var R = require('ramda');
var { METER_TYPES } = require('./const');

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

var header = function header(s) {
  let cellDef = {
    readonly: true,
    style: {
      background: 'teal',
      color: 'yellow',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
    }
  };
  if (typeof s == 'string') {
    cellDef.val = s;
  } else {
    cellDef = Object.assign(cellDef, s);
  }
  return cellDef;
};

var meterTypeFragmentMap = {};

meterTypeFragmentMap[METER_TYPES.电表] = function (
  meterTypeData, totalConsumption, totalFee, meterReadingTypeMap, taxRate
) {
  let taxRateCell = {
    val: taxRate,
    readonly: true,
    label: '税率',
  };
  let parameterRow = [
    header({
      val: '公司本期实际用电',
      title: '全公司所有车间电表的各项度数之和',
    }),
    {
      val: totalConsumption, readonly: true
    },
    header({
      val: '公司本期总(基础)电费',
      title: '全公司所有车间电表度数直接产生费用之和',
    }),
    {
      val: totalFee, readonly: true
    },
    header('增值税率'),
    taxRateCell,
  ];
  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用电'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  let meterFragment = function makeMeterFragment(meterData) {
    let timesCell = {
      val: meterData.times,
      reaonly: true,
      label: meterData.id + '-' + '倍数'
    };
    let rows = meterData.meterReadings.map(function (mr) {
      let lastAccountTermValueCell = {
        val: mr.lastAccountTermValueCell,
        label: mr.id + '-上期读数',
        readonly: true,
      };
      let valueCell = {
        val: mr.value,
        label: mr.id + '-本期读数',
        readonly: true,
      };
      let consumptionSumCell = {
        /* eslint-disable max-len */
        val: `(@{${lastAccountTermValueCell.label}}-@{${valueCell.label}})*@{${timesCell.label}}`,
        /* eslint-enable max-len */
        label: mr.id + '-度数',
        readonly: true
      };
      let unitPriceCell = {
        val: meterReadingTypeMap[mr.meterReadingTypeId].priceSetting.value,
        readonly: true,
        label: mr.id + '-单价',
      };
      let feeSumCell = {
        val: `@{${consumptionSumCell.label}}*@{${unitPriceCell.label}}`,
        readonly: true,
        label: mr.id + '-金额',
      };
      let 可抵税额Cell = {
        /* eslint-disable max-len */
        val: `@{${feeSumCell.label}}*@{${taxRateCell.label}}/(1 + @{${taxRateCell.label}})`,
        /* eslint-enable max-len */
        readonly: true,
        label: mr.id + '-可抵税额',
      };
      return [
        readonly(mr.name), lastAccountTermValueCell, valueCell,
        consumptionSumCell, unitPriceCell, feeSumCell, 可抵税额Cell,
      ];
    });
    return rows.map(function (row, idx) {
      return R.ifElse(
        idx => idx == 0,
        () => [readonly(meterData.name), timesCell],
        () => [void 0, void 0]
      )(idx)
      .concat(row);
    });
  };
  let 上浮Row = function () {
    return [
      groupNameCell('上浮'),
    ];
  };
  let 线损分摊Row = function () {

  };
  let 基本电费Row = function () {

  };
  let summaryRow = function () {
  };
  return border(addFragmentHeaderRow([
    parameterRow,
    headerRow,
    ...meterTypeData.meters.map(function (meterData) {
      return meterFragment(meterData);
    }).map(function (row, idx) {
      return [idx == 0? groupNameCell('设备读数'): void 0].concat(row);
    }),
    上浮Row(),
    线损分摊Row(),
    基本电费Row(),
    summaryRow()
  ]), 'cyan');
};

var meterTypeFragment = function meterTypeFragment(meterTypeData) {
  let func = meterTypeFragmentMap[meterTypeData.name];
  if (!func) {
    return [];
  }
  return func(meterTypeData);
};

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
        // create charge bills for each department
        let { sheets }  = chargeBill.def;
        let meterReadingTypes = yield knex('meter_reading_types').select('*')
        .then(casing.camelize);
        // 计算各类表读数的(公司)总实际用电
        // 表读数类型id -> 该类型下所有表实际读数之和
        let meterReadingTypeSumMap = R.fromPairs(
          meterReadingTypes.map(it => [it.id, 0])
        );
        let meters = yield knex('meters').select(['id', 'times'])
        .then(casing.camelize);
        // 表id -> 表倍数
        let meterTimesMap = R.fromPairs(
          meters.map(it => [it.id, it.times])
        );
        for (let sheet of sheets) {
          for (let row of sheet.grids) {
            for (let cell of row) {
              if (R.path(['data', 'tag'])(cell) == 'meter-reading') {
                let { meterReadingTypeId, lastAccountTermValue, meterId }
                = cell.data;
                meterReadingTypeSumMap[meterReadingTypeId] +=
                  (cell.val - lastAccountTermValue) * meterTimesMap[meterId];
              }
            }
          }
        }
        // 车间ID -> ( 表类型 -> (表 -> 表读数) )
        let data = {};
        for (let departmentId in data) {
          let departmentData = data[departmentId];
          let grids = [
            ...data[departmentData].map(function (meterTypeData) {
              return meterTypeFragment(meterTypeData);
            })
          ];
          yield trx('department_charge_bills').insert({
            account_term_id: chargeBill.accountTermId,
            department_id: departmentId,
            def: { sheets: [ { grids } ] }
          });
        }

        // 计算公司总电费
        // TODO 缺少化学原材料部分
        // let data = {};
        // for (let sheet of sheets) {
        //   let meterType = R.find(R.propEq('name', sheet.label))(meterTypes);
        //   for (let row of sheet.grids) {
        //     let meterId = R.path([0, 'data-meter-id']);
        //     if (meterId) {
        //       if (!data[meterId]) {
        //         data[meterId] = {};
        //       }
        //       for (let cell of row.slice(1)) {
        //       }
        //     }
        //   }
        // }
        // for (let meterId in data) {
        //   let grids = [
        //     ...electricGroup(data[meterId]),
        //     ...waterGroup(data[meterId]),
        //     ...meterTypes.map(function (meterType) {
        //       return [
        //         [groupNameCell(meterType.name + '费用')],
        //         [
        //           header('项目名称'), header('上月读数'), header('本月读数'),
        //           header('发生额'), header('倍数'), header('实际读数'),
        //           header('单价'), header('金额'), header('可抵税额'),
        //         ]
        //       ]
        //     })
        //   ]
        // }
        // yield trx('department_charge_bills').insert({
        //   account_term_id: chargeBill.accountTermId,
        //   department_id,
        // });
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
};
