# chuangye-mis-backend

    This backend uses postgresql, so you should setup postgresql at the beginning, and you should [install extension pgcrypto](http://stackoverflow.com/questions/2647158/how-can-i-hash-passwords-in-postgresql)

## first round
```
$ npm install
```
* create tables, and create superuser account.

```bash
$ node create-schema.js
$ node init-db.js
```

* or for development environment, create test data

```bash
$ node make-test-data.js
```


