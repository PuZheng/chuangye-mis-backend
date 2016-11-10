var bunyan = require('bunyan');
var config = require('./config');

module.exports = bunyan.createLogger({
  name: 'chuangye-mis',
  serializers: {
    req: function reqSerializer(req) {
      let ret = {
        method: req.method,
        url: req.url,
      };
      if (config.get('showReqHeaders')) {
        ret.headers = req.headers;
      }
      return ret;
    },
    err: bunyan.stdSerializers.err,
  }
});
