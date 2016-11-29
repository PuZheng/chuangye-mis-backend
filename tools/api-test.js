var inquirer = require('inquirer');
var co = require('co');
var chalk = require('chalk');
var config = require('../config');
var axios = require('axios');
var R = require('ramda');


var login = function login(backend) {
  let questions = [{
    type: 'input',
    name: 'username',
    message: 'please specify username: ',
    validate: function (input) {
      if (!input.length) {
        return 'you should provide a username';
      }
      return true;
    }
  }, {
    type: 'password',
    name: 'password',
    message: 'please speicfy password:',
    validate: function (input) {
      if (!input.length) {
        return 'you should provice a password';
      }
      return true;
    }
  }];
  return inquirer.prompt(questions).then(function ({
    username,
    password
  }) {
    return axios.post(backend + '/auth/login', {
      username,
      password
    })
    .catch(function (error) {
      throw error;
    })
    .then(R.path(['data', 'token']));
  });
};

var getBackend = function getHost() {
  console.log(chalk.yellow('specify the backend: '));
  let questions = [{
    type: 'input',
    name: 'ip',
    default: 'localhost',
    message: 'please specify the ip'
  }, {
    type: 'input',
    name: 'port',
    default: config.get('port'),
    message: 'please specify the port'
  }];
  return inquirer.prompt(questions).then(
    function ({
      ip,
      port
    }) {
      let ret = `http://${ip}:${port}`;
      console.log(chalk.green('backend is: ' + ret));
      return ret;
    }
  );
};

co(function* () {
  let backend = yield getBackend();
  let token = yield login(backend);
  var requestPattern = /^((GET|PUT|POST|DELETE)\s+)?(\S+)$/i;
  var request;
  for (;;) {
    request = (yield inquirer.prompt({
      type: 'input',
      name: 'request',
      message: 'please input request:',
      default: request,
      validate: function (input) {
        if (!input.match(requestPattern)) {
          return 'a request should like "[METHOD] URL"';
        }
        return true;
      },
    })).request;
    if (request == 'exit') {
      break;
    }
    let m = request.match(requestPattern);
    let method = (m[2] || 'GET').toLowerCase();
    let url = m[3];
    if (!url.startsWith('/')) {
      url = '/' + url;
    }
    try {
      let {
        data
      } = yield axios[method].apply(axios, [
        backend + url, {
          headers: {
            Authorization: 'Bearer ' + token
          }
        }
      ]);
      console.log(JSON.stringify(data, null, 4));
    } catch (error) {
      console.log(chalk.red(error));
    }
  }
});
