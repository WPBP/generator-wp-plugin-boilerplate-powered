'use strict';

var fs = require('fs');
var readline = require('line-input-stream');
var exec = require('child_process').exec;
var args = process.argv.slice(2);
var colors = require('colors');
var verbose = false;
if (args[1] === 'verbose' || args[2] === 'verbose') {
  verbose = true;
}
var Replacer = module.exports = function Replacer(file, options) {
  var module = {},
          searches = [],
          seds = [];
  /*
   * Add string for the replace
   * 
   * @param string search
   * @param string replace
   */
  module.add = function(search, replace) {
    searches.push({search: search, replace: replace});
  };

  /*
   * Remove the string with a blank line
   * 
   * @param string search
   */
  module.rm = function(search) {
    searches.push({search: search, replace: ''});
  };

  /*
   * The rows for sed
   * 
   * @param number _start
   * @param number _end
   */
  module.addsed = function(_start, _end) {
    seds.push({start: _start, end: _end});
  };

  module.file = file;

  Base replacements
  module.add(/plugin-name/g, options.pluginSlug);
  module.add(/Plugin_Name_Admin/g, options.pluginClassName + '_Admin');
  module.add(/Plugin_Name/g, options.pluginClassName);
  module.add(/Plugin Name\./g, options.pluginName);
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
  module.replace = function() {
    fs.exists(file, function(exists) {
      if (exists) {
        fs.readFile(file, 'utf8', function(err, data) {
          var i, total;
          if (err) {
            return console.log(err);
          }

          total = searches.length;
          for (i = 0; i < total; i += 1) {
            data = data.replace(searches[i].search, searches[i].replace);
          }

          fs.writeFile(file, data, 'utf8', function(err) {
            if (err) {
              return console.log((err).red);
            }
            if(verbose){
              console.log(('Replace ' + file).italic);
            }
          });
        });
      }
    });
  };

  /*
   * Search the block of rows for sed
   * 
   * @param number start
   * @param number end
   * @param number count_initial
   * @param number count_end
   */
  module.rmsearch = function(start, end, count_initial, count_end) {
    var stream, _start, _end;
    var i = -1;
    start = start.replace(/ /g, '');
    end = end.replace(/ /g, '');
    fs.exists(file, function(exists) {
      if (exists) {
        stream = readline(fs.createReadStream(file, {flags: 'r'}));
        stream.setDelimiter("\n");

        //start reading the file
        stream.on('line', function(line) {
          i++;
          line = line.replace(/(\r\n|\n|\r|\t)/gm, '').replace(/ /g, '');

          if (line === start) {
            _start = i - count_initial;
            if (!end.length) {
              _end = i + count_end;
            }
          } else if (line === end && end && (i - count_end > _start)) {
            _end = i - count_end;
          }
        });

        stream.on("end", function() {
          if (typeof _start === 'undefined') {
            console.log(('Not found start line in ' + file + ': ' + _start).red);
          }

          if (typeof _end === 'undefined') {
            console.log(('Not found end line in ' + file + ': ' + _end).red);
          }

          if (_start > _end) {
            console.log(('Problem when parsing ' + file).red);
          }

          module.addsed(_start, _end);
        });
      }
    });
  };

  /*
   * Call sed command and replace method
   * 
   */
  module.sed = function() {
    fs.exists(process.cwd() + '/' + file, function(exists) {
      if (exists) {
        if (seds.length !== 0) {
          var total = seds.length;
          var line = '';
          var i;

          for (i = 0; i < total; i += 1) {
            line += seds[i].start + ',' + seds[i].end + "d;";
          }

          exec("sed -i '" + line + "' " + process.cwd() + '/' + file, {cwd: process.cwd() + '/'},
          function(err, stdout, stderr) {
            if (stderr.length > 0) {
              console.log(('stderr: ' + stderr).red);
            }
            if (err !== null) {
              console.log(('exec error: ' + err).red);
            }
            if(verbose){
              console.log(('Sed ' + file).italic);
            }
            module.replace();
          });
        } else {
          module.replace();
        }
      }
    });
  };

  return module;
};