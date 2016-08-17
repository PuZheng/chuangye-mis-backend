var authRouter = require('./auth');
var invoiceTypeRouter = require('./invoice-type').router;
var accountTermRouter = require('./account-term').router;
var entityRouter = require('./entity').router;
var invoiceRouter = require('./invoice').router;
var materialSubjectRouter = require('./material-subject').router;
var restify = require('restify');
var logger = require('./logger');
var config = require('./config');
var bunyan = require('bunyan');

if (config.get('env') === 'production') {
  require('longjohn');
}
 
var server = restify.createServer();
server.opts(/\.*/, function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, authorization');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Expose-Headers', 'X-Api-Version, X-Request-Id, X-Response-Time');
  res.setHeader('Access-Control-Max-Age', '1000');
  res.send(200);
  next();
});
server.use(restify.CORS());
authRouter.applyRoutes(server, '/auth');
invoiceTypeRouter.applyRoutes(server, '/invoice-type');
accountTermRouter.applyRoutes(server, '/account-term');
entityRouter.applyRoutes(server, '/entity');
invoiceRouter.applyRoutes(server, '/invoice');
materialSubjectRouter.applyRoutes(server, '/material-subject');
// server.on('after', restify.auditLogger({
//   log: bunyan.createLogger({
//     name: 'audit',
//     stream: process.stdout,
//   }),
//   body: true
// }));
server.on('uncaughtException', function uncaughtException(req, res, route, err) {
  logger.error(err.stack);
  res.send(err);
});
 
server.listen(config.get('port'), function() {
  logger.info('%s listening at %s', server.name, server.url);
});
