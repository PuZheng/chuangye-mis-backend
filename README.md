# chuangye-mis-backend

This backend uses postgresql, so you should setup postgresql at the beginning, 
and you should [install extension pgcrypto](http://stackoverflow.com/questions/2647158/how-can-i-hash-passwords-in-postgresql)

## quick start

### setup postgresql
* create role/database 
```
$ sudo -i -u postgresql  # login as user postgresql
postgresql$ createuser foo_user # create a postgresql role
postgresql$ createdb foo_db
```
* if no corresponding system user, create it

> Upon installation Postgres is set up to use ident authentication, which means that it associates Postgres roles with a matching Unix/Linux system account. If a role exists within Postgres, a Unix/Linux username with the same name will be able to sign in as that role.

* give the newly create user a password to connect the db
```
$ sudo -i -u foo_user foo_db psql
# enter psql shell
foo_user=# \password
```

* edit configuration dbConnection (in config.js)

### install dependencies

```
$ npm install
```

### generate keys

genreate public, private keys using `generate-key.sh`, refer to http://stackoverflow.com/questions/5244129/use-rsa-private-key-to-generate-public-key

### initialize data

```bash
$ node create-schema.js
$ node setup-admin.js
```

* or for development environment, create test data

```bash
$ node make-test-data.js
```
