var convict = require('convict');

var conf = convict({
    env: {
        doc: "The applicaton environment.",
        format: ["production", "development", "test"],
        default: "development",
        env: "NODE_ENV"
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
    knexOpts: {
        doc: "options for knex",
        format: function () {

        },
        default: {
            client: 'postgresql',
            connection: {
              host     : 'localhost',
              user     : 'chuangye_mis',
              password : 'foo',
              database : 'chuangye_mis'
            },
            debug: true
        },
        env: "KNEX_OPTS",
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
        default: "private.pem",
    },
    publicKey: {
        doc: 'public key',
        format: String,
        default: "public.pem",
    },
});

var env = conf.get('env');
conf.loadFile(env + '.json');

module.exports = conf;
