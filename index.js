var authRouter = require('./auth');
var restify = require('restify');
var logger = require('./logger');
var config = require('./config');
var bunyan = require('bunyan');
 
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
 
server.listen(config.get('port'), function() {
  logger.info('%s listening at %s', server.name, server.url);
});
