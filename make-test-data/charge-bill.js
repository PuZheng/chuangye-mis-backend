#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var casing = require('casing');
var R = require('ramda');
var chance = require('chance');
var { fullfill: fullfillMeter } = require('../meter');
var { fullfill: fullfillTenant } = require('../tenant');

var C = new chance();

if (!argv.t) {
  console.log('请指定指定的账期');
}

var header = function header(s) {
  return {
    val: s,
    readonly: true,
    style: {
      background: 'teal',
      color: 'yellow',
      fontWeight: 'bold',
      whiteSpace: 'nowrap',
    }
  };
};

var settingsRow = function settingsRow(meterType) {
  let settingCell = function settingCell({ name, value }) {
    return {
      readonly: true,
      val: value,
      label: 'setting-' + name,
      style: {
        border: '1px solid red',
      }
    };
  };
  return R.flatten(meterType.meterReadingTypes.map(function ({ priceSetting }) {
    return [header(priceSetting.name + '(元)'), settingCell(priceSetting)];
  }));
};

var headerRow = function headerRow(meterType) {
  return [
    header('车间'), header('承包人'), header('表设备'), header('倍数'),
    ...meterType.meterReadingTypes.map(({ name }) => header('上期' + name)),
    ...meterType.meterReadingTypes.map(({ name }) => header(name)),
    header('总费用(元)')
  ];
};


var makeGridDef = function (meters, tenants) {
  let groups = R.toPairs(R.groupBy(R.prop('meterTypeId'))(meters));
  let sheets = groups.map(function ([, group]) {
    let meterType = group[0].meterType;
    return {
      label: meterType.name,
      grids: [
        settingsRow(meterType),
        headerRow(meterType),
        ...group.filter(it => it.parentMeterId).map(
          it => meterRow(it, tenants)
        ),
      ]
    };
  });
  return { sheets };
};

var meterRow = function meterRow(meter, tenants) {
  let departmentCell = (({ department: { name } }) =>
                        ({ val: name, readonly: true }));
  let entityCell = function ({ departmentId }, tenants) {
    return {
      val: R.find(R.propEq('departmentId', departmentId))(tenants).entity.name,
      readonly: true
    };
  };
  let nameCell = ({ name }) => ({ val: name, readonly: true });
  let lastAccountTermValueCell = function (meter, meterReadingType) {
    let meterReading = R.find(
      it => it.meterReadingTypeId == meterReadingType.id
    )(meter.meterReadings);
    let { value } =  meterReading;
    return {
      label: meter.name + '-上期' + meterReadingType.name,
      val: value,
      readonly: true
    };
  };
  let valueCell = function valueCell(meter, meterReadingType) {
    let meterReading = R.find(
      it => it.meterReadingTypeId == meterReadingType.id
    )(meter.meterReadings);
    let { value: lastAccountTermValue, id } = meterReading;
    return {
      label: meter.name + '-' + meterReadingType.name,
      data: {
        id,
        tag: 'meter-reading',
        name: meterReadingType.name,
        price: meterReadingType.priceSetting.value,
        lastAccountTermValue,
      },
      val: lastAccountTermValue + C.natural({ min: 10, max: 200 }),
    };
  };
  let sumCell = function (meter, meterReadingTypes) {
    let readingSumQuote = meterReadingTypes.map(
      function ({ name, priceSetting }) {
        let lastValueQuote = '${' + meter.name + '-上期' + name + '}';
        let valueQuote = '${' + meter.name + '-' + name + '}';
        let settingQuote = '${' + 'setting-' + priceSetting.name + '}';
        return `(${valueQuote} - ${lastValueQuote}) * ${settingQuote}`;
      }
    ).join('+');
    let timesQuote = '${' + meter.name + '倍数}';
    return {
      val: `=(${readingSumQuote}) * ${timesQuote}`,
      readonly: true,
      label: 'sum-of-' + meter.department.id,
    };
  };
  let { meterType } = meter;
  let { meterReadingTypes } = meterType;
  let timesCell = ({ times, name }) => ({
    val: times,
    readonly: true,
    label: name + '倍数',
  });
  return {
    data: {
      tag: 'meter',
      id: meter.id,
      name: meter.name,
      departmentId: meter.departmentId,
      times: meter.times,
    },
    cells: [
      departmentCell(meter), entityCell(meter, tenants), nameCell(meter),
      timesCell(meter),
      ...meterReadingTypes.map(function (meterReadingType) {
        return lastAccountTermValueCell(meter, meterReadingType);
      }),
      ...meterReadingTypes.map(function (meterReadingType) {
        return valueCell(meter, meterReadingType);
      }),
      sumCell(meter, meterReadingTypes),
    ]
  };
};

co(function *() {
  let [accountTerm] = yield knex('account_terms').where({ name: argv.t })
  .select('*');
  if (!accountTerm) {
    console.log('账期不存在');
  }
  let tenants = yield knex('tenants').select('*').then(casing.camelize);
  for (let tenant of tenants) {
    yield fullfillTenant(tenant);
  }
  let meters = yield knex('meters').select('*').then(casing.camelize);
  for (let meter of meters) {
    yield fullfillMeter(meter);
  }
  let def = makeGridDef(meters, tenants);
  yield knex('charge_bills').insert({
    account_term_id: accountTerm.id,
    def,
  });
  console.log('账期' + argv.t + '创建完毕');
  knex.destroy();
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
