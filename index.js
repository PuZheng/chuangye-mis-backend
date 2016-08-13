var authRouter = require('./auth');
var restify = require('restify');
var logger = require('./logger');
var config = require('./config');
var bunyan = require('bunyan');

if (config.get('env') === 'production') {
  require('longjohn');
}
 
var server = restify.createServer();
server.use(restify.CORS());
authRouter.applyRoutes(server, '/auth');
server.on('after', restify.auditLogger({
  log: bunyan.createLogger({
    name: 'audit',
    stream: process.stdout,
  }),
  body: true
}));
// server.on('uncaughtException', function uncaughtException(req, res, route, err) {
//   logger.error(err.stack);
//   res.send(err);
// });
 
server.listen(config.get('port'), function() {
  logger.info('%s listening at %s', server.name, server.url);
});
