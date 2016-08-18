var nodemon = require('gulp-nodemon');
var gulp = require('gulp');
var config = require('./config.js');
var eslint = require('gulp-eslint');

gulp.task('serve', function() {
    var options = {
        script: './index.js',
        execMap: {
            "js": "node"
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

gulp.task('default', ['serve']);
