var koa = require('koa');
var error = require('koa-error');
var cors = require('koa-cors');
var config = require('./config.js');
var koaLogger = require('koa-bunyan');
var logger = require('./logger.js');
var mount = require('koa-mount');
var slow = require('koa-slow');

if (config.get('env') !== 'production'){
    require('longjohn');
}
var app = koa();
app.use(error())
.use(koaLogger(logger, {
  // which level you want to use for logging?
  // default is info
  level: 'info',
  // this is optional. Here you can provide request time in ms,
  // and all requests longer than specified time will have level 'warn'
  timeLimit: 100
}));
// .use(cors())
// .use(mount('/auth', require('./auth.js').app));
if (config.get('env') === 'development') {
  // app.use(slow({ delay: 200 }));
}
app.listen(config.get('port'));
