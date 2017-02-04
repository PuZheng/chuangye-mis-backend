var nodemon = require('gulp-nodemon');
var gulp = require('gulp');
var eslint = require('gulp-eslint');
var rollup = require('rollup').rollup;
var babel = require('rollup-plugin-babel');
var includePaths = require('rollup-plugin-includepaths');
var inquirer = require('inquirer');
var conflict = require('gulp-conflict');
var template = require('gulp-template');
var rename = require('gulp-rename');

gulp.task('serve', function() {
  var options = {
    script: './index.js',
    execMap: {
      js: 'node'
    },
    delayTime: 1,
    watch: ['./']
  };
  return nodemon(options);
});

gulp.task('lint', function() {
  return gulp.src(['**/*.js','!node_modules/**'])
  // eslint() attaches the lint output to the "eslint" property
  // of the file object so it can be used by other modules.
  .pipe(eslint())
  // eslint.format() outputs the lint results to the console.
  // Alternatively use eslint.formatEach() (see Docs).
  .pipe(eslint.format())
  // To have the process exit with an error code (1) on
  // lint error, return the stream and pipe to failAfterError last.
  .pipe(eslint.failAfterError());
});

gulp.task('rollup', function () {
  var plugins = [
    includePaths({
      paths: ['chuangye-mis/js/'],
      include: {
        slot: 'chuangye-mis/js/slot/index.js',
      }
    }),
  ];
  if (process.env.NODE_ENV === 'production') {
    plugins.push(babel({
      presets: [['es2015', { modules: false }]],
      plugins: [
        'external-helpers'
      ],
      exclude: ['node_modules/**']
    }));
  }
  return Promise.all(
    [
      rollup({
        entry: 'chuangye-mis/js/slot/index.js',
        plugins,
      })
      .then(function (bundle) {
        return bundle.write({
          format: 'cjs',
          dest: 'frontend/slot.js',
        });
      }),
      rollup({
        entry: 'chuangye-mis/js/smart-grid/data-slot-manager.js',
        plugins,
      })
      .then(function (bundle) {
        return bundle.write({
          format: 'cjs',
          dest: 'frontend/smart-grid/data-slot-manager.js',
        });
      }),
      rollup({
        entry: 'chuangye-mis/js/smart-grid/analyzer.js',
        plugins,
      })
      .then(function (bundle) {
        return bundle.write({
          format: 'cjs',
          dest: 'frontend/smart-grid/analyzer.js',
        });
      }),
    ]
  );
});

gulp.task('gen-app', function (done) {
  inquirer.prompt([
    {
      type: 'input',
      name: '模块名称',
      message: '输入模块名称, 形如"foo-bar"',
    },
  ]).then(function (answers) {
    gulp.src(__dirname + '/templates/app.js')
    .pipe(template(answers))
    .pipe(rename(function (path) {
      path.basename = answers.模块名称;
    }))
    .pipe(conflict('./'))
    .pipe(gulp.dest('./'))
    .on('end', function () {
      done();
    })
    .resume();
  });
});

gulp.task('default', ['serve']);
