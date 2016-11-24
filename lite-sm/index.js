
class StateMachine {
  constructor(logger) {
    this.logger = logger;
    this.states = {};
  }
  bundle(arg) {
    if (arg === void 0) {
      return this._bundle;
    }
    this._bundle = arg;
    return this;
  }
  state(label) {
    if (label === void 0) {
      return this._state.label;
    }
    this._state = this.states[label];
    if (!this._state) {
      throw new Error('LITE-SM: unkown state: ' + label);
    }
    return this;
  }
  addState(label, routes, sideEffect) {
    if (this.states[label]) {
      throw new Error(
        'LITE-SM: You can\'t create two states with the same label'
      );
    }
    let state = { label, routes, sideEffect, sm: this };
    this.states[label] = state;
    return this;
  }
  perform(action, ...args) {
    if (!this._state) {
      throw new Error('LITE-SM: You may have forgotten to set state...');
    }
    let nextState = this._state.routes[action];
    if (!nextState) {
      throw {
        code: StateMachine.INVALID_ACTION,
        message: 'action ' + action + ' is not acceptable for state '
        + this._state.label,
      };
    }
    this._state = this.states[nextState];
    if (!this._state) {
      throw new Error('LITE-SM: unkown state: '  + nextState);
    }
    this._state.action = action;
    return this._state.sideEffect &&
      this._state.sideEffect.apply(this._state, args);
  }
  get actions() {
    return Object.keys(this._state.routes || {});
  }
}

StateMachine.INVALID_ACTION = 'INVALID_ACTION';

module.exports = StateMachine;
