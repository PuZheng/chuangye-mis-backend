#!/usr/bin/env node
/**
 * 注意本脚本需要针对某账期进行单独调用, 不能放在make_test_data.sh中
 * */
var argv = require('yargs').argv;
var knex = require('../knex');
var co = require('co');
var casing = require('casing');
var R = require('ramda');
var { fullfill: fullfillMeter } = require('../meter');

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

/**
 * @param meterType 包含如下字段:
 *  meterReadingTypes - 其中每个元素包含字段priceSetting, 包含字段id, name, value
 * */
var settingsRow = function settingsRow(meterType) {
  let settingCell = function settingCell({ id, value }) {
    return {
      readonly: true,
      val: value,
      label: 'setting-' + id,
      style: {
        border: '1px solid red',
      }
    };
  };
  return R.flatten(meterType.meterReadingTypes.map(function ({ priceSetting }) {
    return [header(priceSetting.name + '(元)'), settingCell(priceSetting)];
  }));
};

/**
 * @param meterType 包含如下字段:
 *  meterReadingTypes - 其中每个元素包含字段priceSetting, 包含字段id, name, value
 * */
var headerRow = function headerRow(meterType) {
  return [
    header('车间'), header('表设备'), header('倍数'),
    ...meterType.meterReadingTypes.map(({ name }) => header('上期' + name)),
    ...meterType.meterReadingTypes.map(({ name }) => header(name)),
    header('总费用(元)')
  ];
};


var makeGridDef = function *makeGridDef() {
  let meters = yield knex('meters').select('*').then(casing.camelize);
  for (let meter of meters) {
    yield fullfillMeter(meter);
  }
  let groups = R.toPairs(R.groupBy(R.prop('meterTypeId'))(meters));
  let sheets = [];
  for (let [meterTypeId, group] of groups) {
    let meterType = yield knex('meter_types').where('id', meterTypeId)
    .select('*').then(casing.camelize);
    sheets.push({
      label: meterType.name,
      grids: [
        settingsRow(meterType),
        headerRow(meterType),
        ...group.filter(it => it.parentMeterId).map(
          it => meterRow(it)
        ),
      ]
    });
  }
  return { sheets };
};

/**
 *@param meter 包含如下字段:
 *  id,
 *  name,
 *  times,
 *  meterReadings, 表读数列表，按对应读数类型ID进行排序, 并且保证和表所属类型对应的
 *    表读数数量相等, 例如：表1属于电表类型，电表类型包含3个表读数"尖峰"，"高峰"，
 *    "低谷", 对应的ID分别是1, 2, 3. 但表1只包含两个表读数, 所属类型是"高峰", "低谷",
 *    那么， meterReadings包含3个元素，第一个元素是空， 后两个表读数分别是"高峰"
 *    类型的表读数和"低谷"类型的表读数. 每个表读数包含字段:
 *      id
 *      value
 *      typeName - 表读数类型的名称
 *      price - 表读数类型对应的价格
 *      priceSettingId - 表读数类型对应的价格配置项Id
 *  departmentId,
 *  department, 包含id, name字段
 * */
var meterRow = function meterRow(meter) {
  let departmentCell = (({ department: { name } }) =>
                        ({ val: name, readonly: true }));
  let nameCell = ({ name }) => ({ val: name, readonly: true });
  let lastAccountTermValueCell = function (meterReading) {
    let { id, value } = meterReading;
    return {
      label: '表读数' + id + '-上期读数',
      val: value,
      readonly: true
    };
  };
  let valueCell = function valueCell(meterReading) {
    let { value: lastAccountTermValue, id, typeName, price, priceSettingId } =
      meterReading;
    return {
      label: '表读数' + id + '-读数',
      data: {
        id,
        tag: 'meter-reading',
        name: typeName,
        price: price,
        priceSettingId,
        lastAccountTermValue,
      },
    };
  };
  let lastAccountTermValueCells = meter.meterReadings.map(function (mr) {
    return mr? lastAccountTermValueCell(mr): void 0;
  });
  let valueCells = meter.meterReadings.map(function (mr) {
    return mr? valueCell(mr): void 0;
  });
  let timesCell = ({ times, name }) => ({
    val: times,
    readonly: true,
    label: name + '倍数',
  });
  let sumCell = (function() {
    let sumQuote = R.range(0, meter.meterReadings.length)
    .map(function (idx) {
      let { priceSettingId } = meter.meterReadings[idx];
      /* eslint-disable max-len */
      return `(@{${valueCells[idx].label}} - @{${lastAccountTermValueCells[idx].label}}) * @{setting-${priceSettingId}}`;
      /* eslint-enable max-len */
    }).join('+');
    return {
      val: `=@{${timesCell.label}} * (@{${sumQuote}})`,
      readonly: true,
      label: 'sum-of-' + meter.id,
    };
  }());
  return {
    data: {
      tag: 'meter',
      id: meter.id,
      name: meter.name,
      departmentId: meter.departmentId,
      times: meter.times,
    },
    cells: [
      departmentCell(meter), nameCell(meter),
      timesCell(meter),
      ...lastAccountTermValueCells,
      ...valueCells,
      sumCell,
    ]
  };
};

co(function *() {
  let [accountTerm] = yield knex('account_terms').where({ name: argv.t })
  .select('*');
  if (!accountTerm) {
    console.log('账期不存在');
  }
  yield knex('charge_bills').insert({
    account_term_id: accountTerm.id,
    def: yield *makeGridDef(),
  });
  console.log('账期' + argv.t + '创建完毕');
  knex.destroy();
})
.catch(function (e) {
  console.error(e);
  knex.destroy();
});
