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
    port: {
        doc: 'listening port',
        format: 'port',
        default: 5000,
        env: 'PORT'
    },
});

var env = conf.get('env');
conf.loadFile(env + '.json');

module.exports = conf;
