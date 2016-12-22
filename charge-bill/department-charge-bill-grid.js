var R = require('ramda');
var { METER_TYPES } = require('../const');
var assert = require('assert-plus');
/* eslint-disable no-unused-vars */
var prettyjson = require('prettyjson');
/* eslint-enable no-unused-vars */

const TAX_RATE_CELL_LABEL = '增值税率';

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

var border = function border(fragment, color) {
  let width = Math.max.apply(null, fragment.map(R.prop('length')));
  let normalize = function (cell) {
    if (cell == void 0) {
      cell = { style: {} };
    } else if (typeof cell == 'string') {
      cell = { val: cell, style: {} };
    } else if (cell.style == void 0) {
      cell.style = {};
    }
    return cell;
  };
  let top = fragment[0];
  for (let i = 0; i < width; i++) {
    (top[i] = normalize(top[i])).style.borderTopColor = color;
  }
  let bottom = R.last(fragment);
  for (let i = 0; i < width; ++i) {
    (bottom[i] = normalize(bottom[i])).style.borderBottomColor = color;
  }
  for (let i = 0; i < fragment.length; ++i) {
    (fragment[i][width - 1] = normalize(fragment[i][width - 1]))
    .style.borderRightColor = color;
  }
  for (let i = 0; i < fragment.length; ++i) {
    (fragment[i][0] = normalize(fragment[i][0])).style.borderLeftColor = color;
  }
  return fragment;
};

var addFragmentHeaderRow = function (fragment, title, style) {
  let width = Math.max.apply(null, fragment.map(R.prop('length')));
  fragment.unshift([{
    val: title,
    style: R.clone(style),
  }].concat(R.range(0, width - 1).map(() => ({ style: R.clone(style) }))));
  return fragment;
};

var stylize = function (part, style) {
  for (var i = 0, len = part.length; i < len; i++) {
    let cell = part[i];
    if (cell === void 0) {
      cell = {};
    }
    if (cell.style == void 0) {
      cell.style = {};
    }
    Object.assign(cell.style, style);
    part[i] = cell;
  }
  return part;
};

var groupNameCell = function (s) {
  return {
    val: s,
    readonly: true,
    style: {
      fontWeight: 'bold',
    }
  };
};

var readonly = s => ({ val: s, readonly: true });


var searchCells = function searchCell(fragment, test) {
  return R.flatten(
    fragment.map(R.filter(test))
  );
};

/**
 * @meterData contains: id, name times, meterReadings
 * */
var meterFragment = function ({
  ns, meterData, 可抵税
}) {
  let timesCell = {
    val: meterData.times,
    readonly: true,
    label: ns + meterData.id + '-' + '倍数'
  };
  let meterReadingRow = function (mr) {
    assert(mr.id && mr.name && mr.price && mr.lastAccountTermValue);
    // mr contains: id, price, lastAccountTermValue, name
    let lastAccountTermValueCell = {
      val: mr.lastAccountTermValue,
      label: ns + mr.id + '-上期读数',
      readonly: true,
    };
    let valueCell = {
      val: mr.value,
      label: ns + mr.id + '-本期读数',
      readonly: true,
    };
    let consumptionSumCell = {
      /* eslint-disable max-len */
      val: `=(@{${valueCell.label}}-@{${lastAccountTermValueCell.label}})*@{${timesCell.label}}`,
      /* eslint-enable max-len */
      label: ns + mr.id + '-度数',
      readonly: true,
      data: {
        tag: '表读数实际度数'
      },
    };
    let unitPriceCell = {
      val: mr.price,
      readonly: true,
      label: ns + mr.id + '-单价',
    };
    let 表读数金额Cell = {
      val: `=@{${consumptionSumCell.label}}*@{${unitPriceCell.label}}`,
      readonly: true,
      label: ns + mr.id + '-金额',
      data: {
        tag: '表读数金额',
      }
    };
    let 表读数可抵税额Cell = R.ifElse(
      R.identity,
      () => ({
        /* eslint-disable max-len */
        val: `=@{${表读数金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}} / (1 + @{${TAX_RATE_CELL_LABEL}})`,
        /* eslint-enable max-len */
        readonly: true,
        data: { tag: '表读数可抵税额' },
        label: ns + mr.id + '-可抵税额',
      }),
      R.always(readonly('0'))
    )(可抵税);
    return [
      readonly(mr.name), lastAccountTermValueCell, valueCell,
      consumptionSumCell, unitPriceCell, 表读数金额Cell, 表读数可抵税额Cell
    ];
  };
  return meterData.meterReadings.map(meterReadingRow)
  .map(function (row, idx) {
    return R.ifElse(
      idx => idx == 0,
        () => [readonly(meterData.name), timesCell],
        () => [void 0, void 0]
    )(idx).concat(row);
  });
};

var 电表Fragment = function ({
  meterTypeData, totalConsumption, totalFee,
  settings
}) {
  assert.array(meterTypeData.meters);
  let ns = '电表-';
  let 线损率Cell = {
    val: Number(settings.线损率) / 100,
    readonly: true,
    label: ns + '线损率'
  };
  let totalConsumptionCell = {
    val: totalConsumption, readonly: true,
    label: ns + '公司当期总电费',
  };
  let totalFeeCell = {
    val: totalFee, readonly: true,
    label: ns + '公司当期总直接电费',
  };
  let 变压器容量Cell = {
    val: settings.变压器容量,
    readonly: true,
    label: ns + '变压器容量',
  };
  let 基本电费每KVCell = {
    val: settings.基本电费每KV,
    readonly: true,
    label: ns + '基本电费每KV',
  };
  let parameterRow = [
    header({
      val: '公司本期实际用电',
      title: '全公司所有车间电表的各项度数之和',
    }),
    totalConsumptionCell,
    header({
      val: '公司本期总(基础)电费',
      title: '全公司所有车间电表度数直接产生费用之和',
    }),
    totalFeeCell,
    header('线损率'),
    线损率Cell,
    header('变压器容量'),
    变压器容量Cell,
    header('基本电费每KV'),
    基本电费每KVCell,
  ];

  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用电'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  let 设备直接费用Fragment = (function() {
    let meterFragments =  meterTypeData.meters.map(function (meterData) {
      return meterFragment({
        ns, meterData, 可抵税: true
      });
    });
    let 电表总计度数Cell = {
      val: '=' + meterTypeData.meters.map(function (meter) {
        return meter.meterReadings.map(it => `@{${ns+it.id}-度数}`).join('+');
      }).join('+'),
      readonly: true,
      label: ns + '电表总计度数'
    };
    let 金额Cell = {
      val: '=' + meterTypeData.meters.map(function (meter) {
        return meter.meterReadings.map(it => `@{${ns+it.id}-金额}`).join('+');
      }).join('+'),
      readonly: true,
      label: ns + '直接费用',
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}} / (1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '直接费用可抵税额',
    };
    let summaryRow = [
      //|表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      readonly('总计'), void 0, void 0, void 0, void 0, 电表总计度数Cell, void 0, 金额Cell, 可抵税额Cell
      /* eslint-enable max-len */
    ];
    return meterFragments
    .reduce(R.concat, []).concat([summaryRow])
    .map(function (row, idx) {
      return [idx == 0? groupNameCell('设备直接费用'): void 0].concat(row);
    });
  }());
  let 上浮Row = function () {
    let 实际度数Cell = {
      val: '=@{' + ns + '电表总计度数}',
      readonly: true,
    };
    let 上浮单价Cell = {
      val: settings.上浮单价,
      label: ns + '上浮单价',
      readonly: true
    };
    let 金额Cell = {
      val: `=@{${ns}上浮单价} * @{${ns}电表总计度数}`,
      readonly: true,
      label: ns + '上浮费用'
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}}/(1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('上浮'), void 0, void 0, void 0, void 0, void 0, 实际度数Cell, 上浮单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let 线损分摊Row = function () {
    let 实际度数Cell = {
      val: `=@{${ns}电表总计度数}`,
      readonly: true,
    };
    let 线损单价Cell = {
      /* eslint-disable max-len */
      val: `=@{${线损率Cell.label}} * (@{${totalFeeCell.label}} + @{${totalConsumptionCell.label}} * 0.1) / @{${totalFeeCell.label}}`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '线损单价',
    };
    let 金额Cell = {
      val: `=@{${ns}电表总计度数} * @{${线损单价Cell.label}}`,
      label: ns + '线损分摊费用',
      readonly: true,
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}}/(1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('线损分摊'), void 0, void 0, void 0, void 0, void 0, 实际度数Cell, 线损单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let 基本电费Row = function () {
    let 实际度数Cell = {
      val: `=@{${ns}电表总计度数}`,
      readonly: true,
    };
    let 单价Cell = {
      /* eslint-disable max-len */
      val: `=@{${变压器容量Cell.label}} * @{${基本电费每KVCell.label}} / @{${totalFeeCell.label}}`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '基本电费单价',
    };
    let 金额Cell = {
      val: `=@{${ns}电表总计度数} * @{${ns}基本电费单价}`,
      label: ns + '基本电费费用',
      readonly: true
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}}/(1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('基本电费'), void 0, void 0, void 0, void 0, void 0, 实际度数Cell, 单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let summaryRow = function () {
    let 金额Cell = {
      val: `=@{${ns}直接费用} + @{${ns}上浮费用} + @{${ns}线损分摊费用} + @{${ns}基本电费费用}`,
      readonly: true,
      label: ns + '总金额',
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}}/(1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '总可抵税额',
    };
    return stylize([
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('总计'), void 0, void 0, void 0, void 0, void 0, void 0, void 0, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ], { fontWeight: 700 });
  }();

  return [
    parameterRow,
    headerRow,
    ...设备直接费用Fragment,
    上浮Row,
    线损分摊Row,
    基本电费Row,
    summaryRow
  ];
};

var 水表Fragment = function ({
  ns, meterTypeData, settings
}) {
  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用量'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  let 污水治理费金额Cell, 污泥费金额Cell, 污水治理可抵税额Cell,
    污泥费可抵税额Cell;
  let 设备直接费用Fragment = meterTypeData.meters.map(function (meterData) {
    return meterFragment({
      ns, meterData, 可抵税: false,
    });
  })
  .reduce(R.concat, [])
  .map(function (row, idx) {
    return [idx == 0? groupNameCell('设备直接费用'): void 0].concat(row);
  });
  let 治理费Row = function () {
    let 实际度数Cell = {
      val: '=' + R.flatten(
        meterTypeData.meters.map(function (meter) {
          return meter.meterReadings.map(function(mr) {
            return '@{' + ns + mr.id + '-度数' + '}';
          });
        })
      ).join('+'),
      readonly: true,
      label: ns + '治理费实际度数',
    };
    let 单价Cell = {
      val: settings.污水治理价格,
      label: ns + '污水治理价格',
      readonly: true
    };
    污水治理费金额Cell = {
      val: `=@{${实际度数Cell.label}} * @{${单价Cell.label}}`,
      readonly: true,
      label: ns + '污水治理费'
    };
    污水治理可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${污水治理费金额Cell.label}} * @{${TAX_RATE_CELL_LABEL}} / (1 + @{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '污水治理可抵税额',
    };
    // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('污水治理费'), void 0, void 0, void 0, void 0, void 0,
      实际度数Cell, 单价Cell, 污水治理费金额Cell, 污水治理可抵税额Cell,
    ];
  }();
  let 污泥费Row = function () {
    let 实际度数Cell = {
      val: '=' + R.flatten(
        meterTypeData.meters.map(function (meter) {
          return meter.meterReadings.map(function(mr) {
            return '@{' + ns + mr.id + '-度数' + '}';
          });
        })
      ).join('+'),
      readonly: true,
      label: ns + '污泥费实际度数',
    };
    let 单价Cell = {
      val: settings.污泥费价格,
      readonly: true,
      label: ns + '污泥费价格',
    };
    污泥费金额Cell = {
      val: `=@{${实际度数Cell.label}} * @{${单价Cell.label}}`,
      readonly: true,
      label: ns + '污泥费金额',
    };
    污泥费可抵税额Cell = {
      val: '0',
      readonly: true,
      label: ns + '污泥费可抵税额',
    };
    // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('污泥费'), void 0, void 0, void 0, void 0, void 0,
      实际度数Cell, 单价Cell, 污泥费金额Cell, 污泥费可抵税额Cell,
    ];
  }();
  let summaryRow = function () {
    let 金额Cell = {
      val: '=' + searchCells(
        设备直接费用Fragment, R.pathEq(['data', 'tag'], '表读数金额')
      )
      .map(({ label }) => '@{' + label + '}').join('+') +
        `@{${污水治理费金额Cell.label}}` + `@{${污泥费金额Cell.label}}`,
      readonly: true,
      label: ns + '总金额',
      style: {
        fontWeight: '700',
      }
    };
    let 可抵税额Cell = {
      val: `=@{${污水治理可抵税额Cell.label}}+@{${污泥费可抵税额Cell.label}}`,
      readonly: true,
      style: {
        fontWeight: '700',
      },
      label: ns + '总可抵税额',
    };
    // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return stylize([
      groupNameCell('总结'), void 0, void 0, void 0, void 0, void 0,
      void 0, void 0, 金额Cell, 可抵税额Cell,
    ], { fontWeight: '700' });
  }();
  return [
    headerRow,
    ...设备直接费用Fragment,
    治理费Row,
    污泥费Row,
    summaryRow,
  ];
};

var 蒸汽表Fragment = function ({
  meterTypeData, settings,
}) {
  let ns = '蒸汽表-';
  let 线损金额Cell, 线损可抵税额Cell;
  let 蒸汽线损Cell = {
    val: Number(settings.蒸汽线损) / 100,
    readonly: true,
    label: ns + '蒸汽线损',
  };
  let parameterRow = [
    header('蒸汽线损'),
    蒸汽线损Cell,
  ];
  let 设备直接费用Fragment = meterTypeData.meters.map(function (meterData) {
    return meterFragment({
      ns, meterData, 可抵税: true,
    });
  })
  .reduce(R.concat, [])
  .map(function (row, idx) {
    return [idx == 0? groupNameCell('设备直接费用'): void 0].concat(row);
  });
  let 损耗Row = (function() {
    let 实际度数Cell = {
      val: '=(' + searchCells(
        设备直接费用Fragment, R.pathEq(['data', 'tag'], '表读数实际度数')
      )
      .map(({ label }) => '${' + label + '}')
      .join('+') + `)*@{${蒸汽线损Cell.label}}`,
      readonly: true,
      label: ns + '实际度数',
    };
    let 单价Cell = {
      val: settings.线损蒸汽价,
      readonly: true,
      label: ns + '单价'
    };
    线损金额Cell = {
      val: `=@{${单价Cell.label}}*@{${实际度数Cell.label}}`,
      readonly: true,
      label: ns + '线损金额',
    };
    线损可抵税额Cell = {
      /* eslint-disable max-len */
      val: `=@{${线损金额Cell.label}}*@{${TAX_RATE_CELL_LABEL}}/(1+@{${TAX_RATE_CELL_LABEL}})`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '线损可抵税额',
    };
    // groupName|表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('损耗'), void 0, void 0, void 0, void 0, void 0,
      实际度数Cell, 单价Cell, 线损金额Cell, 线损可抵税额Cell,
    ];
  }());
  let summaryRow = (function() {
    let 金额Cell = {
      val: '=' + searchCells(
        设备直接费用Fragment, R.pathEq(['data', 'tag'], '表读数金额')
      )
      .map(({ label }) => '@{' + label + '}').join('+') +
        `+@{${线损金额Cell.label}}`,
      readonly: true,
      label: ns + '总金额',
    };
    let 可抵税额Cell = {
      val: '=' + searchCells(
        设备直接费用Fragment, R.pathEq(['data', 'tag'], '表读数可抵税额')
      )
      .map(({ label }) => '@{' + label + '}').join('+') +
        `+@{${线损可抵税额Cell.label}}`,
      readonly: true,
      label: ns + '总可抵税额',
    };
    // groupName|表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('总结'), void 0, void 0, void 0, void 0, void 0,
      void 0, void 0, 金额Cell, 可抵税额Cell,
    ];
  }());
  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用量'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  return [
    parameterRow,
    headerRow,
    ...设备直接费用Fragment,
    损耗Row,
    summaryRow,
  ];
};

var 总结Fragment = function () {
  let 总金额Cell = {
    val: '=' + ['电表', '水表', '生活水表', '蒸汽表'].map(it => '@{' + it + '-总金额}')
    .join('+'),
    readonly: true,
  };
  let 可抵税额Cell = {
    val: '=' + ['电表', '水表', '生活水表', '蒸汽表'].map(it => '@{' + it + '-总可抵税额}')
    .join('+'),
    readonly: true
  };
  return [
    [header('总金额'), 总金额Cell],
    [header('可抵税额'), 可抵税额Cell]
  ];
};

module.exports = function departmentChargeBillGrid({
  meterTypes, totalElectricConsumption, totalElectricFee,
  settings
}) {
  var taxRateCell = {
    val: settings.增值税率,
    label: TAX_RATE_CELL_LABEL,
    readonly: true,
  };
  return [[readonly('公司税率'), taxRateCell]].concat(
    [
      ['电表费用', 'red', 电表Fragment({
        meterTypeData: R.find(R.propEq('name', METER_TYPES.电表))(meterTypes),
        totalConsumption: totalElectricConsumption,
        totalFee: totalElectricFee,
        settings
      })],
      ['水表费用', 'orange', 水表Fragment({
        ns: '水表-',
        meterTypeData: R.find(R.propEq('name', METER_TYPES.水表))(meterTypes),
        settings
      })],
      ['生活水表费用', 'cyan', 水表Fragment({
        ns: '生活水表-',
        meterTypeData: R.find(R.propEq('name', METER_TYPES.生活水表))(meterTypes),
        settings
      })],
      ['蒸汽表费用', 'purple', 蒸汽表Fragment({
        meterTypeData: R.find(R.propEq('name', METER_TYPES.蒸汽表))(meterTypes),
        settings
      })],
      ['总结', 'wheat', 总结Fragment()],
    ]
    .map(function ([title, color, fragment]) {
      return border(
        addFragmentHeaderRow(fragment, title, {
          color: 'white',
          backgroundColor: color
        }),
        color
      );
    })
    .reduce(R.concat, [])
  );
};
