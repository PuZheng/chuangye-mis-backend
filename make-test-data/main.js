#!/usr/bin/env node
var { exec } = require('shelljs');
var { argv } = require('yargs');

exec('./clear-schema.js');
exec('./create-schema.js');
exec('./initialize.js');
exec('./make-test-data/users.js');
exec('./make-test-data/account-terms.js');
exec('./make-test-data/entities.js');
exec('./make-test-data/store-subjects.js');
exec('./make-test-data/plants.js' + (argv.q? ' -n 1': ''));
exec('./make-test-data/departments.js' + (argv.q? ' -n 1': ''));
exec('./make-test-data/tenants.js');
exec('./make-test-data/invoices.js' + (argv.q? ' -n 16': ''));
exec('./make-test-data/vouchers.js' + (argv.q? ' -n 16': ''));
exec('./make-test-data/meters.js');
exec('./make-test-data/meter-readings.js');
exec('./make-test-data/store-orders.js');
exec('./make-test-data/partners.js');
exec('./make-test-data/chemical-suppliers.js' + (argv.q? ' -n 16': ''));
