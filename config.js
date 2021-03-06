var convict = require('convict');

var conf = convict({
  env: {
    doc: 'The applicaton environment.',
    format: ['production', 'development', 'test'],
    default: 'development',
    env: 'NODE_ENV'
  },
  dbConnection: {
    format: String,
    doc: 'db connection string',
    default: 'postgres://foo_user:foo_pwd@localhost:5432/foo_db'
  },
  knex: {
    debug: {
      doc: 'if debug knex',
      format: Boolean,
      env: 'KNEX_DEBUG',
      default: false
    }
  },
  admin: {
    doc: 'system admin account information',
    format: function () {

    },
    default: {
      username: 'admin',
      password: 'admin'
    }
  },
  port: {
    doc: 'listening port',
    format: 'port',
    default: 5000,
    env: 'PORT'
  },
  privateKey: {
    doc: 'private key',
    format: String,
    default: 'private.pem',
  },
  publicKey: {
    doc: 'public key',
    format: String,
    default: 'public.pem',
  },
  showReqHeaders: {
    doc: 'if show request headers',
    format: Boolean,
    default: false,
    env: 'SHOW_REQ_HEADERS'
  },
  audit: {
    doc: 'if audit the response',
    format: Boolean,
    default: false,
    env: 'AUDIT'
  },
});

var env = conf.get('env');
conf.loadFile(env + '.json');

module.exports = conf;
