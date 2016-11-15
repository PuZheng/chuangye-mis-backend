#! /bin/bash
./clear-schema.js | bunyan
./create-schema.js | bunyan
./initialize.js | bunyan
./make-test-data/accounts.js | bunyan
./make-test-data/account-terms.js | bunyan
./make-test-data/entities.js | bunyan
./make-test-data/store-subjects.js | bunyan
./make-test-data/departments.js | bunyan
./make-test-data/tenants.js | bunyan
./make-test-data/invoices.js | bunyan
./make-test-data/vouchers.js | bunyan
./make-test-data/meters.js | bunyan
./make-test-data/store-orders.js | bunyan
