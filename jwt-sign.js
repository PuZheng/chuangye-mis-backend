var fs = require('mz/fs');
var config = require('./config.js');
var jwt = require('koa-jwt');
var privateKey;

exports.sign = function *(obj) {
	privateKey = privateKey || (yield fs.readFile(config.get('privateKey'))).toString();
	return jwt.sign(obj, privateKey, {
		algorithm: 'RS256'
	});
};
