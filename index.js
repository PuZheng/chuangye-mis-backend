var restify = require('restify');
var logger = require('./logger');
var config = require('./config');
var bunyan = require('bunyan');

if (config.get('env') === 'production') {
  require('longjohn');
}

var server = restify.createServer({
  name: 'chuangye-mis api',
  log: logger,
});
server.opts(/\.*/, function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Headers',
    /* eslint-disable max-len */
    'Origin, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, X-Response-Time, X-PINGOTHER, X-CSRF-Token, authorization'
    /* eslint-enable max-len */
  );
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, PUT, DELETE');
  res.setHeader('Access-Control-Expose-Headers',
                'X-Api-Version, X-Request-Id, X-Response-Time');
  res.setHeader('Access-Control-Max-Age', '1000');
  res.send(200);
  next();
});
server.use(restify.CORS());
let apps = [
  'const', 'auth', 'invoice-type', 'account-term', 'entity', 'invoice',
  'store-subject', 'voucher-type', 'voucher-subject', 'voucher',
  'department', 'tenant', 'settings', 'meter', 'user', 'store-order',
  'meter-type', 'charge-bill', 'partner', 'account', 'account-book',
  'department-charge-bill', 'meter-reading', 'payment-record', 'operating-report',
  'chemical-supplier', 'plant'
];
for (let app of apps) {
  require('./' + app).router.applyRoutes(server, '/' + app);
}
if (config.get('audit')) {
  server.on('after', restify.auditLogger({
    log: bunyan.createLogger({
      name: 'audit',
    }),
    body: true
  }));
}
server.pre(function (req, res, next) {
  req.log.info({ req }, 'start');
  return next();
});

server.on('uncaughtException', function (req, res, route, err) {
  logger.error(err);
  res.send(err);
});

server.listen(config.get('port'), function() {
  logger.info('%s listening at %s', server.name, server.url);
});
