var R = require('ramda');

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
    fragment[i][width - 1] = normalize(fragment[i][width - 1])
    .style.borderRightColor = color;
  }
  for (let i = 0; i < fragment.length; ++i) {
    fragment[i][0] = normalize(fragment[i][0]).style.borderLeftColor = color;
  }
  return fragment;
};

var addFragmentHeaderRow = function (fragment, title, style) {
  let width = Math.max.apply(null, fragment.map(R.prop('length')));
  fragment.unshift([{
    val: title,
    style,
  }].concat(R.repeat(style, width - 1)));
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

var taxRateCell = taxRate => ({
  val: taxRate,
  label: '增值税率',
  readonly: true,
});

var searchCells = function searchCell(fragment, test) {
  return R.flatten(
    fragment.map(R.filter(test))
  );
};

var meterFragment = function ({
  ns, meterData, meterReadingTypeMap, 可抵税
}) {
  let timesCell = {
    val: meterData.times,
    readonly: true,
    label: ns + meterData.id + '-' + '倍数'
  };
  let meterReadingRow = function (mr) {
    let lastAccountTermValueCell = {
      val: mr.lastAccountTermValueCell,
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
      val: `(@{${lastAccountTermValueCell.label}}-@{${valueCell.label}})*@{${timesCell.label}}`,
      /* eslint-enable max-len */
      label: ns + mr.id + '-度数',
      readonly: true,
      'data-tag': '表读数实际度数',
    };
    let unitPriceCell = {
      val: meterReadingTypeMap[mr.meterReadingTypeId].priceSetting.value,
      readonly: true,
      label: ns + mr.id + '-单价',
    };
    let 表读数金额Cell = {
      val: `@{${consumptionSumCell.label}}*@{${unitPriceCell.label}}`,
      readonly: true,
      label: ns + mr.id + '-金额',
      'data-tag': '表读数金额',
    };
    let 表读数可抵税额Cell = R.ifElse(
      R.identity,
      () => ({
        /* eslint-disable max-len */
        val: `@{${表读数金额Cell}} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
        /* eslint-enable max-len */
        readonly: true,
        label: ns + '表读数可抵税额Cell',
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
  meterTypeData, totalConsumption, totalFee, meterReadingTypeMap,
  上浮单价, 线损率, 变压器容量, 基本电费每KV
}) {
  let ns = '电表-';
  let 线损率Cell = {
    val: 线损率,
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
    val: 变压器容量,
    readonly: true,
    label: ns + '变压器容量',
  };
  let 基本电费每KVCell = {
    val: 基本电费每KV,
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
  ];

  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用电'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  let 设备直接费用Fragment = (function() {
    let meterFragments =  meterTypeData.meters.map(function (meterData) {
      return meterFragment({
        ns: '电表',
        meterData,
        meterReadingTypeMap,
        可抵税: true
      });
    });
    let 电表总计度数Cell = {
      val: meterTypeData.meters.map(function (meter) {
        return meter.meterReadings.map(it => `@{${it.id}-度数}`).join('+');
      }).join('+'),
      readonly: true,
      label: ns + '电表总计度数'
    };
    let 金额Cell = {
      val: meterTypeData.meters.map(function (meter) {
        return meter.meterReadings.map(it => `@{${it.id}-金额}`).join('+');
      }).join('+'),
      readonly: true,
      label: ns + '直接费用',
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${金额Cell}} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
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
      val: '@{电表总计度数}',
      readonly: true,
    };
    let 上浮单价Cell = {
      val: 上浮单价,
      label: ns + '上浮单价',
      readonly: true
    };
    let 金额Cell = {
      val: '@{上浮单价} * @{电表总计度数}',
      readonly: true,
      label: ns + '上浮费用'
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${金额Cell.label}} * @{${taxRateCell.label}}/(1 + @{taxRateCell.label})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('上浮'), void 0, void 0, void 0, void 0, 实际度数Cell, 上浮单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let 线损分摊Row = function () {
    let 实际度数Cell = {
      val: '@{电表总计度数}',
      readonly: true,
    };
    let 线损单价Cell = {
      /* eslint-disable max-len */
      val: `@{线损率} * (@{${totalFeeCell.label}} + @{${totalConsumptionCell.label}} * 0.1) / @{${totalFeeCell.label}}`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '线损单价',
    };
    let 金额Cell = {
      val: '@{电表总计度数} * @{线损单价}',
      label: ns + '线损分摊费用'
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${金额Cell.label}} * @{${taxRateCell.label}}/(1 + @{${taxRateCell.label}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('线损分摊'), void 0, void 0, void 0, void 0, 实际度数Cell, 线损单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let 基本电费Row = function () {
    let 实际度数Cell = {
      val: '@{电表总计度数}',
      readonly: true,
    };
    let 单价Cell = {
      /* eslint-disable max-len */
      val: `@{${变压器容量Cell.label}} * @{${基本电费每KVCell.label}} / @{${totalFeeCell.label}}`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '基本电费单价',
    };
    let 金额Cell = {
      val: '@{电表总计度数} * @{基本电费单价}',
      label: ns + '基本电费费用'
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${金额Cell.label}} * @{${taxRateCell.label}}/(1 + @{${taxRateCell.label}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    return [
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('基本电费'), void 0, void 0, void 0, void 0, 实际度数Cell, 单价Cell, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ];
  }();
  let summaryRow = function () {
    let 金额Cell = {
      val: '@{直接费用} + @{上浮费用} + @{线损分摊费用} + @{基本电费费用}',
      readonly: true,
      label: ns + '总金额',
    };
    let 可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${金额Cell.label}} * @{${taxRateCell.label}}/(1 + @{${taxRateCell.label}})`,
      /* eslint-enable max-len */
      readonly: true,
      label: ns + '总可抵税额',
    };
    return stylize([
      // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
      /* eslint-disable max-len */
      groupNameCell('总计'), void 0, void 0, void 0, void 0, void 0, void 0, 金额Cell, 可抵税额Cell,
      /* eslint-enable max-len */
    ], { backgroundColor: 'darkslateblue' });
  }();

  return [
    parameterRow,
    headerRow,
    ...设备直接费用Fragment,
    上浮Row(),
    线损分摊Row(),
    基本电费Row(),
    summaryRow
  ];
};

var 水表Fragment = function ({
  ns, meterTypeData, meterReadingTypeMap, 污水治理价格, 污泥费价格
}) {
  let headerRow = [
    header('项目'), header('表设备'), header('倍数'), header('读数'),
    header('上期读数'), header('本期读数'), header('实际用电'), header('单价'),
    header('金额'), header('可抵税额')
  ];
  let 污水治理费金额Cell, 污泥费金额Cell, 污水治理可抵税额Cell,
    污泥费可抵税额Cell;
  let 设备直接费用Fragment = meterTypeData.meters.map(function (meterData) {
    return meterFragment({
      ns, meterData, meterReadingTypeMap,
      可抵税: false,
    });
  })
  .reduce(R.concat, [])
  .map(function (row, idx) {
    return [idx == 0? groupNameCell('设备直接费用'): void 0].concat(row);
  });
  let 治理费Row = function () {
    let 实际度数Cell = {
      val: R.flatten(
        meterTypeData.meters.map(function (meter) {
          return meter.meterReadings.map(function(mr) {
            return '@{' + ns + mr.id + '-金额' + '}';
          });
        })
      ).join('+'),
      readonly: true,
      label: ns + '水表总计度数',
    };
    let 单价Cell = {
      val: 污水治理价格,
      label: ns + '污水治理价格',
      realonly: true
    };
    污水治理费金额Cell = {
      val: `@{${实际度数Cell.label}} * @{{单价Cell.label}}`,
      readonly: true,
      label: ns + '污水治理费'
    };
    污水治理可抵税额Cell = {
      /* eslint-disable max-len */
      val: `@{${污水治理费金额Cell.label}} * @{${taxRateCell.label}} / (1 + @{${taxRateCell.label}})`,
      /* eslint-enable max-len */
      readonly: true,
    };
    // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('污水治理费'), void 0, void 0, void 0, void 0, void 0,
      实际度数Cell, 单价Cell, 污水治理费金额Cell, 污水治理可抵税额Cell,
    ];
  };
  let 污泥费Row = function () {
    let 实际度数Cell = {
      val: R.flatten(
        meterTypeData.meters.map(function (meter) {
          return meter.meterReadings.map(function(mr) {
            return '@{' + ns + mr.id + '-金额' + '}';
          });
        })
      ).join('+'),
      readonly: true,
      label: ns + '水表总计度数',
    };
    let 单价Cell = {
      val: 污泥费价格,
      readonly: true,
      label: ns + '污泥费价格',
    };
    污泥费金额Cell = {
      val: `@{${实际度数Cell.label}} * @{${单价Cell.label}}`,
      readonly: true,
      label: ns + '污泥费价格',
    };
    污泥费可抵税额Cell = {
      val: 0,
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
      val: '=' + searchCells(设备直接费用Fragment, R.propEq('data-tag', '表读数金额'))
      .map(function (it) {
        return `@{${it.label}}`;
      }).join('+') + `@{${污水治理费金额Cell.label}}` + `@{${污泥费金额Cell.label}}`,
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
      label: ns + '总可抵税金额',
    };
    // 表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('总结'), void 0, void 0, void 0, void 0, void 0,
      void 0, void 0, 金额Cell, 可抵税额Cell,
    ];
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
  meterTypeData,
  蒸汽线损,
  meterReadingTypeMap,
  线损蒸汽价
}) {
  let ns = '蒸汽表';
  let 线损金额Cell, 线损可抵税额Cell;
  let 蒸汽线损Cell = {
    val: 蒸汽线损,
    readonly: true,
    label: ns + '整齐线损',
  };
  let parameterRow = [
    header('蒸汽线损'),
    蒸汽线损Cell,
  ];
  let 设备直接费用Fragment = meterTypeData.meters.map(function (meter) {
    return meterFragment({
      ns, meter, meterReadingTypeMap,
      可抵税: true,
    });
  })
  .reduce(R.concat, [])
  .map(function (row, idx) {
    return [idx == 0? groupNameCell('设备直接费用'): void 0].concat(row);
  });
  let 损耗Row = (function() {
    let 实际度数Cell = {
      val: '=(' + searchCells(设备直接费用Fragment, R.propEq('data-tag', '表读数实际度数'))
      .map(function ({ label }) {
        return `@{${label}}`;
      })
      .join('+') + ')*@{${线损蒸汽Cell.label}}',
      readonly: true,
      label: ns + '实际度数',
    };
    let 单价Cell = {
      val: 线损蒸汽价,
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
      val: `=@{${线损金额Cell.label}}*@{${taxRateCell.label}}/(1+@{${taxRateCell.label}})`,
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
      val: '=' + searchCells(设备直接费用Fragment, R.propEq('data-tag', '表读数金额'))
      .map(function ({ label }) {
        return `@{${label}}`;
      }).join('+') + '+@{${线损金额Cell.label}}',
      readonly: true,
      label: ns + '总金额',
    };
    let 可抵税额Cell = {
      val: '=' + searchCells(设备直接费用Fragment, R.propEq('data-tag', '表读数可抵税额'))
      .map(function ({ label }) {
        return `@{${label}}`;
      }).join('+') + '+@{${线损可抵税额Cell.label}}',
      readonly: true,
      label: ns + '总可抵税金额',
    };
    // groupName|表设备|倍数|读数|上期|当期|实际度数|单价|金额|可抵税额
    return [
      groupNameCell('总结'), void 0, void 0, void 0, void 0, void 0,
      void 0, void 0, 金额Cell, 可抵税额Cell,
    ];
  }());
  return [
    parameterRow,
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
}();

module.exports = function () {
  return [
    ['电表费用', '#3f1634', 电表Fragment],
    ['水表费用', '#0b1c1f', 水表Fragment({
      ns: '水表',
    })],
    ['生活水表费用', '#200d29', 水表Fragment({
      ns: '生活水表'
    })],
    ['蒸汽表费用', '#0c0605', 蒸汽表Fragment],
    ['总结', '#2b1139', 总结Fragment],
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
  .reduce(R.concat, []);
};
