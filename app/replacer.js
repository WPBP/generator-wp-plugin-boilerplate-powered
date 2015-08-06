'use strict';

var fs = require('fs');
var readline = require('line-input-stream');
var exec = require('child_process').exec;
var execSync = require('sync-exec');
var args = process.argv.slice(2);
var colors = require('colors');
var verbose = false;
if (args[1] === 'verbose' || args[2] === 'verbose') {
  verbose = true;
}
var Replacer = module.exports = function Replacer(file, options) {
  var module = {},
          searches = [],
          seds = [],
          countLines = 0;
  /*
   * Add string for the replace
   * 
   * @param string search
   * @param string replace
   */
  module.add = function (search, replace) {
    searches.push({search: search, replace: replace});
  };

  /*
   * Remove the string with a blank line
   * 
   * @param string search
   */
  module.rm = function (search) {
    searches.push({search: "        " + search, replace: ''});
    searches.push({search: search, replace: ''});
  };

  /*
   * The rows for sed
   * 
   * @param number startok
   * @param number _end
   */
  module.addsed = function (startok, endok) {
    seds.push({start: startok, end: endok});
  };

  /*
   * Workaround count the line of a file
   * 
   * @param string file
   */
  module.getlines = function (file) {
    if (countLines === 0) {
      var wc = execSync("wc -l < " + process.cwd() + '/' + file);
      if (wc.stderr !== undefined) {
        console.log((wc.stderr).red);
      }
      countLines = parseInt(wc.stdout) - 1;
    }
  };

  module.file = file;

  //Base replacements
  module.add(/plugin-name/g, options.pluginSlug);
  module.add(/Plugin_Name_Admin/g, options.pluginClassName + '_Admin');
  module.add(/Plugin_Name/g, options.pluginClassName);
  module.add(/Plugin Name\./g, options.pluginName);
  module.add(/Plugin Name/g, options.pluginName);
  module.add(new RegExp(options.pluginName + ':', 'g'), 'Plugin Name:');
  module.add(/$plugin_name = 'Plugin Name';/g, '$plugin_name = ' + options.pluginName + '\';');
  module.add(/Plugin Name:( {7})@TODO/g, 'Plugin Name:       ' + options.pluginName);
  module.add(/Your Name <email@example\.com>/g, options.author + ' <' + options.authorEmail + '>');
  module.add(/1\.0\.0/g, options.pluginVersion);
  module.add(/Your Name or Company Name/g, options.pluginCopyright);
  module.add(new RegExp('http://example.com', 'g'), options.authorURI);
  module.add(/pn_/g, options.pluginName.match(/\b(\w)/g).join('').toLowerCase() + '_');
  module.add(/pn-/g, options.pluginName.match(/\b(\w)/g).join('').toLowerCase() + '-');

  /*
   * Replace the strings
   * 
   */
  module.replace = function () {
    file = module.file;
    var exists = fs.readFileSync(process.cwd() + '/' + file);
    if (exists) {
      var data = exists;
      data = data.toString();
      module.add(/\n\n\n/g, "\n");
      var i, total;

      total = searches.length;
      for (i = 0; i < total; i += 1) {
        data = data.replace(searches[i].search, searches[i].replace);
      }

      fs.writeFileSync(process.cwd() + '/' + file, data);
      if (verbose) {
        console.log(('Replace ' + file).italic);
      }
    } else {
      console.log(('File not exist: ' + file).red);
    }
  };

  /*
   * Search the block of rows for sed
   * 
   * @param number start
   * @param number end
   * @param number count_initial
   * @param number count_end
   */
  module.rmsearch = function (start, end, count_initial, count_end) {
    var stream_, startok, endok;
    var i = -1;
    var startspace = start;
    start = start.replace(/ /g, '');
    var endspace = end;
    if (end.length > 0) {
      end = end.replace(/ /g, '');
    }
    var exists = fs.readFileSync(process.cwd() + '/' + file);
    if (exists) {
      stream_ = readline(fs.createReadStream(file, {flags: 'r'}));
      stream_.setDelimiter("\n");
      module.getlines(file);

      //start reading the file
      stream_.on('line', function (line) {
        i++;
        line = line.replace(/(\r\n|\n|\r|\t)/gm, '').replace(/ /g, '');

        if (line === start) {
          startok = i - count_initial;
          if (!end.length) {
            endok = i + count_end;
          }
        } else if (line === end && end && (i - count_end > startok)) {
          endok = i - count_end;
        }

        //Fallback when end event is not emitted
        // Check the line number if is the last
        if (countLines === i) {
          if (typeof startok === 'undefined' || isNaN(startok)) {
            return console.log(('Not found start line: ' + startspace + ' in ' + file).yellow);
          }

          if (typeof endok === 'undefined' || isNaN(endok)) {
            return console.log(('Not found end line: ' + endspace + ' in ' + file).yellow);
          }

          if (endok !== '' && startok > endok) {
            return console.log(('Problem when parsing ' + file).red);
          }

          module.addsed(startok, endok);
        }

      });

      stream_.on("end", function () {
        if (typeof startok === 'undefined' || isNaN(startok)) {
          return console.log(('Not found start line <<' + startspace + '>> in ' + file).red);
        }

        if (typeof endok === 'undefined' || isNaN(endok)) {
          return console.log(('Not found end line <<' + endspace + '>> in ' + file).red);
        }

        if (endok !== '' && startok > endok) {
          return console.log(('Problem when parsing ' + file).red);
        }

        module.addsed(startok, endok);
      });

    } else {
      console.log(('File not exist: ' + file).red);
    }
  };

  /*
   * Call sed command and replace method
   * 
   */
  module.sed = function () {
    file = module.file;
    try {
      var exists = fs.readFileSync(process.cwd() + '/' + file);
      if (exists) {
        if (seds.length !== 0) {
          var total = seds.length;
          var line = '';
          var i;

          for (i = 0; i < total; i += 1) {
            line += seds[i].start + ',' + seds[i].end + "d;";
          }
          exec("sed -i '" + line + "' " + process.cwd() + '/' + file, {cwd: process.cwd() + '/'},
          function (err, stdout, stderr) {
            if (stderr.length > 0) {
              console.log(("sed -i '" + line + "' " + process.cwd() + '/' + file).red);
              return console.log(('stderr: ' + stderr).red);
            }
            if (err !== null) {
              return console.log(('exec error: ' + err).red);
            }
            if (verbose) {
              console.log(('Sed ' + file).italic);
            }
            module.replace();
          });
        } else {
          module.replace();
        }
      } else {
        console.log(('File not exist: ' + file).red);
      }
    } catch (err) {
      
    }
  };

  return module;
};
