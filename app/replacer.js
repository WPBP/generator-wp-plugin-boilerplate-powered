'use strict';

var fs = require('fs');
var readline = require('line-input-stream');
var exec = require('child_process').exec;

var Replacer = module.exports = function Replacer(file, options) {
  var module = {},
          searches = [],
          seds = [];

  module.add = function(search, replace) {
    searches.push({search: search, replace: replace});
  };

  module.rm = function(search) {
    searches.push({search: search, replace: ''});
  };

  module.file = file;

  // Base replacements
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
              return console.log(err);
            }
          });
        });
      }
    });
  };

  module.rmsearch = function(start, end, count_initial, count_end) {
    var stream, _start, _end;
    var i = -1;
    var _file = [];
    start = start.replace(/ /g, '');
    end = end.replace(/ /g, '');
    fs.exists(file, function(exists) {
      if (exists) {
        stream = readline(fs.createReadStream(file, {flags: 'r'}));
        stream.setDelimiter("\n");

        //start reading the file
        stream.addListener('line', function(line) {
          i++;
          // pause stream if a newline char is found
          stream.pause();
          _file.push(line);
          line = line.replace(/(\r\n|\n|\r|\t)/gm, '').replace(/ /g, '');

          if (line === start) {
            _start = i - count_initial;
            if (!end.length) {
              _end = i + count_end;
            }
            stream.resume();
          } else if (line === end && end) {
            _end = i - count_end;
            stream.resume();
          }
        });

        stream.addListener("close", function() {
          if (typeof _start === 'undefined') {
            console.log('Not found start line in' + file + ': ' + _start);
          }

          if (typeof _end === 'undefined') {
            console.log('Not found end line in' + file + ': ' + _end);
          }

          if (_end < _start) {
            console.log('Problem when parsing ' + file);
          }
          
          seds.push({start: _start, end: _end});
          
        });
      }
    });
  };

  module.sed = function() {
    fs.exists(process.cwd() + '/' + file, function(exists) {
      if (exists) {
        var total = seds.length;
        var line = '';
        var i;
        console.log(seds);
        for (i = 0; i < total; i += 1) {
          line += seds[i].start + ',' + seds[i].end + "d;";
        }
        
        console.log("sed -i '" + line + "' " + process.cwd() + '/' + file);
        exec("sed -i '" + line + "' " + process.cwd() + '/' + file, {cwd: process.cwd() + '/'},
        function(err, stdout, stderr) {
          if (stderr.length > 0)
            console.log('stderr: ' + stderr);
          if (err !== null)
            console.log('exec error: ' + err);
        });
      }
    });
  };

  return module;
};