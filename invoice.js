var restify = require('restify');
var Router = require('restify-router').Router;
var router = new  Router();
var logger = require('./logger');
var loginRequired = require('./login-required');
var casing = require('casing');
var co = require('co');
var cofy = require('cofy');
var knex = require('./knex');
var invoiceDef = require('./models').invoices;
var materialNotesDef = require('./models').materialNotes;
var moment = require('moment');
var getAccountTerm = require('./account-term').getObject;
var getInvoiceType = require('./account-term').getObject;
var getEntity = require('./entity').getObject;
var getMaterialSubject = require('./material-subject').getObject;
var R = require('ramda');

router.post(
  '/object', loginRequired, restify.bodyParser(),
  function (req, res, next) {
    knex.transaction(function (trx) {
      return co(function *() {
        let invoice = R.pick(Object.keys(invoiceDef), req.body);
        let materialNotes = req.body.materialNotes;
        let [id] = yield trx
        .insert(casing.snakeize(invoice))
        .returning('id')
        .into('invoices');
        for (var mn of (materialNotes || [])) {
          mn = R.pick(Object.keys(materialNotesDef), mn);
          mn.invoice_id = id;
          yield trx.insert(casing.snakeize(mn)).into('material_notes');
        }
        res.send({id});
        next();
      });
    })
    .catch(function (e) {
      logger.error(e.stack);
      next(e);
    });
  }
);

var getObject = function (id) {
  return co(function *() {
    let invoice = casing.camelize((yield knex('invoices').select('*').where('id', id))[0]);
    invoice.date = moment(invoice.date).format('YYYY-MM-DD');
    invoice.invoiceType = casing.camelize(yield getInvoiceType(invoice.invoiceTypeId));
    invoice.accountTerm = casing.camelize(yield getAccountTerm(invoice.accountTermId));
    invoice.vendor = casing.camelize(yield getEntity(invoice.vendorId));
    invoice.purchaser = casing.camelize(yield getEntity(invoice.purchaserId));
    invoice.materialNotes = casing.camelize(yield knex('material_notes').where('invoice_id', invoice.id));
    for (var mn of invoice.materialNotes) {
      mn.materialSubject = casing.camelize(yield getMaterialSubject(mn.materialSubjectId));
    }
    return invoice;
  });
};

router.get('/object/:id', loginRequired, function (req, res, next) {
  getObject(req.params.id).then(function (invoice) {
    res.json(invoice);
    next();
  }).catch(function (e) {
    logger.error(e);
    next(e);
  });
});

module.exports = {
  router,
  getObject,
};
