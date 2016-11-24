var test = require('ava');
var StateMachine = require('./index');

test('traffic light', function (t) {
  let obj = {
    color: 'green',
  };
  let sm = new StateMachine();
  sm
  .addState('green', {
    turnYellow: 'yellow'
  }, function () {
    this.sm.bundle().color = 'green';
  })
  .addState('yellow', {
    turnRed: 'red'
  }, function () {
    this.sm.bundle().color = 'yellow';
  })
  .addState('red', {
    turnGreen: 'green'
  }, function () {
    this.sm.bundle().color = 'red';
  });

  sm.bundle(obj).state('green');
  t.is(sm.state(), 'green');
  t.is(obj.color, 'green');
  t.deepEqual(sm.actions, ['turnYellow']);

  let e = t.throws(function () {
    sm.perform('turnRed');
  });
  t.is(e.code, StateMachine.INVALID_ACTION);

  sm.perform('turnYellow');
  t.is(sm.state(), 'yellow');
  t.is(obj.color, 'yellow');
  t.deepEqual(sm.actions, ['turnRed']);

  sm.perform('turnRed');
  t.is(sm.state(), 'red');
  t.is(obj.color, 'red');
  t.deepEqual(sm.actions, ['turnGreen']);
});

test('exception', function (t) {
  let sm = new StateMachine();
  sm.addState('A', {
    action1: 'FOO',
  });
  t.throws(function () {
    sm.state('FOO');
  }, 'LITE-SM: unkown state: FOO');
  sm.state('A');
  t.throws(function () {
    sm.perform('action1');
  }, 'LITE-SM: unkown state: FOO');
});
