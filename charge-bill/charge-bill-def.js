var knex = require('../knex');
var R = require('ramda');
var layerify = require('../utils/layerify');
var casing = require('casing');
var {
  meters: meterDef,
  departments: departmentDef,
  meter_reading_types: meterReadingTypeDef,
  settings: settingDef
} = require('../models');
var assert = require('assert-plus');

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
 *  meterReadingTypes - 其中每个元素包含字段name
 * */
var headerRow = function headerRow(meterType) {
  (function validateArguments() {
    assert.array(meterType.meterReadingTypes, 'meterReadingTypes必须是Array');
    for (let { name } of meterType.meterReadingTypes) {
      assert.string(name, '必须包含name字段');
    }
  }());
  return [
    header('车间'), header('表设备'), header('倍数'),
    ...meterType.meterReadingTypes.map(({ name }) => header('上期' + name)),
    ...meterType.meterReadingTypes.map(({ name }) => header(name)),
    header('总费用(元)')
  ];
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
  (function validateArguments() {
    assert(
      meter && meter.id && meter.name && meter.times && meter.meterReadings
      && meter.departmentId && meter.department,
      '缺少必要的字段'
    );
    let { id, name } = meter.department;
    assert.number(id, 'department应该包含id字段');
    assert.string(name, 'department应该包含name字段');
  }());
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
  let timesCell = {
    val: meter.times,
    readonly: true,
    label: meter.name + '倍数',
  };
  let sumCell = (function() {
    let sumQuote = R.range(0, meter.meterReadings.length)
    .map(function (idx) {
      let { priceSettingId } = meter.meterReadings[idx];
      /* eslint-disable max-len */
      return `(@{${valueCells[idx].label}} - @{${lastAccountTermValueCells[idx].label}}) * @{setting-${priceSettingId}}`;
      /* eslint-enable max-len */
    }).join('+');
    return {
      val: `=@{${timesCell.label}} * (${sumQuote})`,
      readonly: true,
      label: 'sum-of-' + meter.id,
      data: { tag: 'sum' }
    };
  }());
  return {
    data: {
      tag: 'meter',
      id: meter.id,
      name: meter.name,
      meterTypeId: meter.meterTypeId,
      departmentId: meter.departmentId,
      times: meter.times,
    },
    cells: [
      departmentCell(meter), nameCell(meter),
      timesCell,
      ...lastAccountTermValueCells,
      ...valueCells,
      sumCell,
    ]
  };
};

/**
 * @param meterType 包含如下字段:
 *  meterReadingTypes - 其中每个元素包含字段priceSetting, 其中包含字段id, name,
 *  value
 * */
var settingsRow = function settingsRow(meterType) {
  (function validateArguments() {
    assert.array(meterType.meterReadingTypes, 'meterReadingTypes必须是Array');
    for (let { priceSetting } of meterType.meterReadingTypes) {
      assert(
        priceSetting && priceSetting.name && priceSetting.id
        && priceSetting.value,
        '必须包含priceSetting字段，priceSetting中必须有id, name, value'
      );
    }
  }());
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


var chargeBillDef = function *chargeBillDef() {
  let meters = yield knex('meters')
  .select([
    ...Object.keys(meterDef).map(it => 'meters.' + it),
    /* eslint-disable max-len */
    ...Object.keys(departmentDef).map(it => `departments.${it} as department__${it}`)
    /* eslint-enable max-len */
  ])
  .join('departments', 'departments.id', 'meters.department_id')
  .then(R.map(R.pipe(layerify, casing.camelize)));
  let groups = R.toPairs(R.groupBy(R.prop('meterTypeId'))(meters));
  let sheets = [];
  for (let [meterTypeId, group] of groups) {
    let [meterType] = yield knex('meter_types').where('id', meterTypeId)
    .select('*').then(casing.camelize);
    meterType.meterReadingTypes = yield knex('meter_reading_types')
    .join('settings', 'settings.id', 'meter_reading_types.price_setting_id')
    .select([
      ...Object.keys(meterReadingTypeDef).map(
        it => `meter_reading_types.${it}`
      ),
      ...Object.keys(settingDef).map(
        it => `settings.${it} as price_setting__${it}`
      )
    ])
    .orderBy('meter_reading_types.id')
    .where('meter_reading_types.meter_type_id', meterType.id)
    .then(R.map(R.pipe(layerify, casing.camelize)));
    for (let meter of group) {
      let meterReadings = yield knex('meter_readings')
      .select('*').where('meter_id', meter.id)
      .then(casing.camelize);
      meter.meterReadings = meterType.meterReadingTypes.map(
        function (
          { id: meterReadingTypeId, priceSettingId, priceSetting, name }
        ) {
          let mr = R.find(
            it => it.meterReadingTypeId == meterReadingTypeId
          )(meterReadings);
          if (mr) {
            mr.priceSettingId = priceSettingId;
            mr.price = priceSetting.value;
            mr.typeName = name;
          }
          return mr;
        }
      );
    }
    sheets.push({
      label: meterType.name,
      grid: [
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

module.exports = chargeBillDef;
