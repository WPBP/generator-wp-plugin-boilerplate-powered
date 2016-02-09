'use strict';
/*jslint node: true */
var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var yosay = require('yosay');
var fs = require('fs');
var request = require('request');
var Admzip = require('adm-zip');
var rmdir = require('rimraf');
var s = require('underscore.string');
var spawn = require('child_process').spawnSync || require('spawn-sync');
var Replacer = require('./replacer');
require('colors');

var cleanfolder = false;
var args = process.argv.slice(2);
var version = '1.1.7';
var is_default = false;
var verbose = false;
var removeGit = false;
var os = require('os');
if (args[1] === 'dev') {
  version = 'master';
}
if (args[1] === 'verbose' || args[2] === 'verbose') {
  verbose = true;
}

/**
 * Checks whether a path starts with or contains a hidden file or a folder.
 * @param {string} path - The path of the file that needs to be validated.
 * returns {boolean} - `true` if the source is blacklisted and otherwise `false`.
 */
var isUnixHiddenPath = function (path) {
  return (/(^|.\/)\.+[^\/\.]/g).test(path);
};

/*
 * Remove in loop the unuseful file and folder, insert the index.php in the folders
 * 
 * @param string path
 * @param {array} excluded - List of files excluded from clean operation
 */
function cleanFolder(path, excluded) {
  // Provide default value for excluded files
  if (excluded === undefined) {
    excluded = [];
  }
  cleanParsing(path, excluded);
  //Recursive scanning for the subfolder
  var list = fs.readdirSync(path);
  list.forEach(function (file) {
    var pathrec = path + '/' + file;
    var i = pathrec.lastIndexOf('.');
    var ext = (i < 0) ? '' : pathrec.substr(i);
    if (!isUnixHiddenPath(pathrec) && ext === '') {
      var stat = fs.statSync(pathrec);
      if (stat && stat.isDirectory()) {
        if (verbose) {
          console.log(('  Parsing ' + pathrec).italic);
        }
        cleanParsing(path, excluded);
        cleanFolder(pathrec, excluded);
      }
    }
  });
}

/*
 * Remove the unuseful file and folder, insert the index.php in the folders
 * 
 * @param string pathrec
 * @param {array} excluded - List of files excluded from clean operation
 */
function cleanParsing(pathrec, excluded) {
  // Provide default value for excluded files
  if (excluded === undefined) {
    excluded = [];
  }
  var default_file = [
    'CONTRIBUTING.md', 'readme.md', 'phpunit.xml', 'packages.json', 'package.json', 'production.rb', 'composer.json', '.scrutinizer.yml',
    'Gruntfile.js', 'README.md', 'example-functions.php', 'bower.json', 'Capfile', 'screenshot-1.png', 'component.json',
    'phpunit.xml.dist', 'Dockunit.json', 'coverage.clover', 'CHANGELOG.md', 'Test.php', 'screenshot1.jpg', 'production.rb',
    '.travis.yml', '.bowerrc', '.gitignore', 'README.txt', 'readme.txt', 'release.sh', 'pointerplus.php', '.DS_Store', 'widget-sample.php',
    'cronplus.php', '.gitignore', 'converage.clover', 'phpunit.xml.dist'
  ];

  // Remove excluded files from default files
  if (!!excluded && excluded.length) {
    excluded.forEach(function (excluded_file) {
      default_file = default_file.filter(function (element) {
        return excluded.indexOf(element) === -1; // remove element if inside excluded array
      });
    });
  }

  if (removeGit === true) {
    default_file.push('.git');
  }
  var default_folder = ['tests', 'bin', 'deploy', 'config'];
  if (cleanfolder !== false) {
    //Remove the unuseful files
    default_file.forEach(function (element, index, array) {
      if (fs.existsSync('./' + pathrec + '/' + element)) {
        fs.unlink(pathrec + '/' + element, function (err) {
          if (err) {
            console.log(('Remove unuseful file error: ' + err).red);
          }
        });
        if (verbose) {
          console.log(('Removed ' + pathrec + '/' + element).italic);
        }
      }
    });
    //Remove the unuseful directory
    default_folder.forEach(function (element, index, array) {
      var isEmpty = false;
      fs.stat('./' + pathrec + '/' + element, function (error, stats) {
        fs.readdir('./' + pathrec + '/' + element, function (err, items) {
          if (!items || !items.length) {
            isEmpty = true;
          }
        });
        if (!error || isEmpty) {
          rmdir('./' + pathrec + '/' + element, function (err) {
            if (err) {
              console.log(('Remove unuseful directory error:' + err).red);
            }
            if (verbose) {
              console.log(('Removed ' + pathrec + '/' + element).italic);
            }
          });
        }
      });
    });
  }
  //Insert a blank index.php
  fs.exists('./' + pathrec + '/index.php', function (exists) {
    if (!exists) {
      fs.writeFile('./' + pathrec + '/index.php',
              "<?php // Silence is golden",
              'utf8', function () {
              });
      if (verbose) {
        console.log(('Created ' + pathrec + '/index.php').italic);
      }
    }
  });
}

/*
 * Delete folders
 * 
 * @param string path
 */
function deleteFolder(path) {
  rmdir(path, function (error) {
    if (error) {
      console.log((error).red);
    }
  });
}

var WpPluginBoilerplateGenerator = module.exports = function WpPluginBoilerplateGenerator(args, options, config) {
  var self = this,
          default_file;

  yeoman.Base.apply(this, arguments);

  this.on('end', function () {
    //Generate the bash script for download the git submodules
    //Initialize git and clean the submodules not required
    var submodulessh = ['#!/bin/sh',
      'set -e',
      'git init',
      "git config -f .gitmodules --get-regexp '^submodule..*.path$' |",
      'while read path_key path',
      '   do',
      "     url_key=$(echo $path_key | sed 's/.path/.url/')",
      '     url=$(git config -f .gitmodules --get $url_key)',
      '     path="./$path"',
      '       if [ -d "$path" ]; then',
      '         rm -r $path',
      '         echo "Add $url in $path"',
      '         git submodule add -f $url $path >> /dev/null',
      '       fi',
      '   done',
      'rm $0'
    ].join('\n');
    fs.writeFile(self.pluginSlug + '/submodules.sh', submodulessh, 'utf8',
            function (err) {
              if (err) {
                console.log(('Error on writing submodules.sh:' + err).red);
                process.exit();
              } else {
                fs.chmodSync(process.cwd() + '/' + self.pluginSlug + '/submodules.sh', '0777');
                console.log(('Generate git config on the fly').white);
                //Execute the magic for clean, destroy, brick, brock the code
                var key = null;
                for (key in self.files) {
                  if (self.files.hasOwnProperty(key)) {
                    self.files[key].sed();
                    if (verbose) {
                      console.log(('  Sed executed on ' + key).italic);
                    }
                  }
                }
                console.log(('Parsed all the files').white);
                //Call the bash script
                console.log(('Download submodules (wait a moment)').white);
                var submodule = spawn(process.cwd() + '/' + self.pluginSlug + '/submodules.sh', [],
                        {
                          cwd: process.cwd() + '/' + self.pluginSlug + '/'
                        });

                if (submodule.status !== 0) {
                  console.log(('Error on submodule:' + submodule.stderr).blue);
                  process.exit();
                } else {
                  if (self.defaultValues.git !== true) {
                    fs.unlink(self.pluginSlug + '/.gitmodules', function (error) {
                      if (error) {
                        console.log(('Error on removing .gitmodules:' + error).red);
                      }
                    });
                    deleteFolder(self.pluginSlug + '/.git');

                    console.log(('Removed git configs generated').white);
                  }
                  //Clean all the folders!!
                  if (self.modules.indexOf('CPT_Core') !== -1) {
                    cleanFolder(self.pluginSlug + '/includes/CPT_Core');
                  }

                  if (self.modules.indexOf('Taxonomy_Core') !== -1) {
                    cleanFolder(self.pluginSlug + '/includes/Taxonomy_Core');
                  }

                  if (self.modules.indexOf('Widget Helper') !== -1) {
                    cleanFolder(self.pluginSlug + '/includes/Widgets-Helper/');
                    cleanFolder(self.pluginSlug + '/includes/widgets');
                  }

                  if (self.modules.indexOf('Freemius SDK') !== -1) {
                    cleanFolder(self.pluginSlug + '/includes/freemius');
                  }

                  if (self.modules.indexOf('CMB2-Grid') !== -1) {
                    cleanFolder(self.pluginSlug + '/admin/includes/CMB2-grid');
                  }

                  if (self.modules.indexOf('CMB2-Google-Maps') !== -1) {
                    cleanFolder(self.pluginSlug + '/admin/includes/CMB2-Google-Maps');
                  }

                  if (self.modules.indexOf('CMB2') !== -1) {
                    cleanFolder(self.pluginSlug + '/admin/includes/CMB2', ['readme.txt', 'README.txt']);
                  }

                  if (self.modules.indexOf('PointerPlus') !== -1) {
                    cleanFolder(self.pluginSlug + '/admin/includes/PointerPlus');
                  }

                  if (self.modules.indexOf('CronPlus') !== -1) {
                    cleanFolder(self.pluginSlug + '/admin/includes/CronPlus');
                  }

                  if (self.modules.indexOf('WP Background Processing') !== -1) {
                    cleanFolder(self.pluginSlug + '/wp-background-processing');
                  }

                  if (self.modules.indexOf('Template system (like WooCommerce)') !== -1) {
                    cleanFolder(self.pluginSlug + '/templates');
                  }

                  if (self.modules.indexOf('WP-Contextual-Help') !== -1) {
                    if (cleanfolder !== false) {
                      deleteFolder(self.pluginSlug + '/admin/includes/WP-Contextual-Help/assets/');
                    }
                    cleanFolder(self.pluginSlug + '/admin/includes/WP-Contextual-Help', ['readme.txt']);
                  }

                  //Console.log are cool and bowtie are cool!
                  console.log(('Inserted index.php files in all the folders').white);
                  console.log(('All done!').white);
                }
              }
            }
    );

  });

  //Check the default file for the default values, I have already said default?
  if (fs.existsSync(__dirname + '/../default-values.json')) {
    default_file = path.join(__dirname, '../default-values.json');
    if (verbose) {
      console.log(('Config loaded').yellow);
    }
  } else if (fs.existsSync(process.cwd() + '/default-values.json')) {
    default_file = process.cwd() + '/default-values.json';
    if (verbose) {
      console.log(('Config loaded').yellow);
    }
  } else {
    console.log(yosay(('This tool can create ' + process.cwd() + '/default-values.json with default values in the parent folder! The next time the tool load all the settings for a fast development').bold));
    console.log(('Don\'t forget to check the wiki of the boilerplate: https://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/wiki').bold);
    console.log(('Add your public Plugins Free/Premium made it with WPBP on https://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/wiki/Plugin-made-with-this-Boilerplate!').bold.red);
    if (/^win/.test(os.platform())) {
      console.log(('Not supported on Windows!').bold.red);
      process.exit(1);
    } else {
      console.log(('Unix systems like Linux or Mac OSX are supported!').bold.red);
    }
    default_file = path.join(__dirname, '../default-values-example.json');
    console.log('--------------------------');
    is_default = true;
  }
  this.defaultValues = JSON.parse(require("html-wiring").readFileAsString(default_file));
  this.loadLines = JSON.parse(fs.readFileSync(__dirname + '/match.json', "utf8")).list[0];
};

util.inherits(WpPluginBoilerplateGenerator, yeoman.Base);

WpPluginBoilerplateGenerator.prototype.askFor = function askFor() {
  var cb = this.async(),
          prompts = [];
  //The boilerplate have the steroids then there are many questions. I know I'm not funny. 
  prompts = [{
      name: 'name',
      message: 'What do you want to call your plugin?',
      default: 'My New Plugin'
    }, {
      name: 'pluginVersion',
      message: 'What is your new plugin\'s version?',
      default: '1.0.0'
    }, {
      name: 'author',
      message: 'What is your name?',
      default: this.defaultValues.author.name
    }, {
      name: 'authorEmail',
      message: 'What is your e-mail?',
      default: this.defaultValues.author.email
    }, {
      name: 'authorURI',
      message: 'What is your URL?',
      default: this.defaultValues.author.url
    }, {
      name: 'copyright',
      message: 'What goes in copyright tags?',
      default: this.defaultValues.author.copyright
    }, {
      type: 'checkbox',
      name: 'publicResources',
      message: 'Which resources your public site needs?',
      choices: [{name: 'JS', checked: true}, {name: 'CSS', checked: true}]
    }, {
      type: 'checkbox',
      name: 'activateDeactivate',
      message: 'Which resources your plugin needs?',
      choices: [
        {name: 'Activate Method', checked: true},
        {name: 'Deactivate Method', checked: true},
        {name: 'Uninstall File', checked: true}]
    }, {
      type: 'confirm',
      name: 'adminPage',
      message: 'Does your plugin need an admin page?'
    }, {
      type: 'checkbox',
      name: 'modules',
      message: 'Which library your plugin needs?',
      choices: [
        {name: 'CPT_Core', checked: true},
        {name: 'CPT_Columns', checked: true},
        {name: 'Taxonomy_Core', checked: true},
        {name: 'Widget Helper', checked: true},
        {name: 'CMB2', checked: true},
        {name: 'CMB2-Grid', checked: true},
        {name: 'CMB2-Google-Maps', checked: true},
        {name: 'WP-Contextual-Help', checked: true},
        {name: 'WP-Admin-Notice', checked: true},
        {name: 'PointerPlus', checked: true},
        {name: 'CronPlus', checked: true},
        {name: 'WP Background Processing', checked: false},
        {name: 'Fake Page Class', checked: true},
        {name: 'Template system (like WooCommerce)', checked: true},
        {name: 'Language function support (WPML/Ceceppa Multilingua/Polylang)', checked: true},
        {name: 'Requirements system on activation', checked: true},
        {name: 'Freemius SDK', checked: false}
      ]
    }, {
      type: 'checkbox',
      name: 'snippet',
      message: 'Which snippet your plugin needs?',
      choices: [
        {name: 'Support Dashboard At Glance Widget for CPT', checked: true},
        {name: 'Support Dashboard Activity Widget for CPT', checked: true},
        {name: 'Javascript DOM-based Routing', checked: true},
        {name: 'Bubble notification on pending CPT', checked: true},
        {name: 'Import/Export settings system', checked: true},
        {name: 'Capability system', checked: true},
        {name: 'Debug system (Debug Bar support)', checked: true},
        {name: 'Add body class', checked: true},
        {name: 'wp_localize_script for PHP var to JS', checked: true},
        {name: 'CPTs on search box', checked: true},
        {name: 'Custom action', checked: true},
        {name: 'Custom filter', checked: true},
        {name: 'Custom shortcode', checked: true},
        {name: 'Donate link in plugins list', checked: false}
      ]
    }, {
      type: 'confirm',
      name: 'git',
      message: 'Do you need an initialized git repo?'
    }, {
      type: 'confirm',
      name: 'cleanFolder',
      message: 'Do you want clean the folders?'
    }, {
      type: 'confirm',
      name: 'coffeescript',
      message: 'Do you need CoffeeScript?'
    }, {
      type: 'confirm',
      name: 'saveSettings',
      message: 'Do you want save the configuration for reuse it?'
    }];

  if (is_default === false) {
    var defaultvalues;
    if (this.defaultValues.name !== '') {
      if (fs.existsSync('./' + s.slugify(this.defaultValues.name)) && this.defaultValues.name !== undefined) {
        console.log(('Warning folder ' + s.slugify(this.defaultValues.name) + ' already exist, change the name of the plugin!').red);
      }
      prompts[0].default = this.defaultValues.name;
    }
    if (this.defaultValues.version !== '') {
      prompts[1].default = this.defaultValues.pluginVersion;
    }
    if (this.defaultValues.publicResources !== '') {
      if (this.defaultValues.publicResources === undefined) {
        prompts[6].choices.forEach(function (element, index, array) {
          prompts[6].choices[index].checked = false;
        });
      } else {
        defaultvalues = this.defaultValues.publicResources;
        prompts[6].choices.forEach(function (element, index, array) {
          prompts[6].choices[index].checked = false;
          defaultvalues.forEach(function (element_z, index_z, array_z) {
            if (prompts[6].choices[index].name === element_z) {
              prompts[6].choices[index].checked = true;
            }
          });
        });
      }
    }
    if (this.defaultValues.activateDeactivate !== '') {
      if (this.defaultValues.activateDeactivate === undefined) {
        prompts[7].choices.forEach(function (element, index, array) {
          prompts[7].choices[index].checked = false;
        });
      } else {
        defaultvalues = this.defaultValues.activateDeactivate;
        prompts[7].choices.forEach(function (element, index, array) {
          prompts[7].choices[index].checked = false;
          defaultvalues.forEach(function (element_z, index_z, array_z) {
            if (prompts[7].choices[index].name === element_z) {
              prompts[7].choices[index].checked = true;
            }
          });
        });
      }
    }
    if (this.defaultValues.adminPage !== '') {
      prompts[8].default = this.defaultValues.adminPage;
    }
    if (this.defaultValues.modules === undefined) {
      prompts[9].choices.forEach(function (element, index, array) {
        prompts[9].choices[index].checked = false;
      });
    } else {
      defaultvalues = this.defaultValues.modules;
      prompts[9].choices.forEach(function (element, index, array) {
        prompts[9].choices[index].checked = false;
        defaultvalues.forEach(function (element_z, index_z, array_z) {
          if (prompts[9].choices[index].name === element_z) {
            prompts[9].choices[index].checked = true;
          }
        });
      });
    }
    if (this.defaultValues.snippet === undefined) {
      prompts[10].choices.forEach(function (element, index, array) {
        prompts[10].choices[index].checked = false;
      });
    } else {
      defaultvalues = this.defaultValues.snippet;
      prompts[10].choices.forEach(function (element, index, array) {
        prompts[10].choices[index].checked = false;
        defaultvalues.forEach(function (element_z, index_z, array_z) {
          if (prompts[10].choices[index].name === element_z) {
            prompts[10].choices[index].checked = true;
          }
        });
      });
    }
    if (this.defaultValues.git !== '') {
      prompts[11].default = this.defaultValues.git;
      removeGit = true;
    }
    if (this.defaultValues.cleanFolder !== '') {
      prompts[12].default = this.defaultValues.cleanFolder;
    }
    if (this.defaultValues.coffeescript !== '') {
      prompts[13].default = this.defaultValues.coffeescript;
    }
    if (this.defaultValues.saveSettings !== '') {
      prompts[14].default = this.defaultValues.saveSettings;
    }
  }
  this.prompt(prompts, function (props) {
    this.pluginName = props.name;
    this.pluginSlug = s.slugify(props.name);
    this.pluginClassName = s.titleize(props.name).replace(/ /g, "_").replace(/-/g, "_");
    this.author = props.author;
    this.authorEmail = props.authorEmail;
    this.authorURI = props.authorURI;
    this.pluginVersion = props.pluginVersion;
    this.pluginCopyright = props.copyright;
    this.publicResources = props.publicResources;
    this.activateDeactivate = props.activateDeactivate;
    this.modules = props.modules;
    this.snippet = props.snippet;
    this.adminPage = props.adminPage;

    //Set the path of the files
    this.files = {
      primary: new Replacer(this.pluginSlug + '/' + this.pluginSlug + '.php', this),
      publicClass: new Replacer(this.pluginSlug + '/public/class-' + this.pluginSlug + '.php', this),
      adminClass: new Replacer(this.pluginSlug + '/admin/class-' + this.pluginSlug + '-admin.php', this),
      adminCss: new Replacer(this.pluginSlug + '/admin/assets/sass/admin.scss', this),
      publicView: new Replacer(this.pluginSlug + '/public/views/public.php', this),
      adminView: new Replacer(this.pluginSlug + '/admin/views/admin.php', this),
      uninstall: new Replacer(this.pluginSlug + '/uninstall.php', this),
      readme: new Replacer(this.pluginSlug + '/README.txt', this),
      gruntfile: new Replacer(this.pluginSlug + '/Gruntfile.js', this),
      package: new Replacer(this.pluginSlug + '/package.json', this),
      gitmodules: new Replacer(this.pluginSlug + '/.gitmodules', this),
      template: new Replacer(this.pluginSlug + '/includes/template.php', this),
      loadtextdomain: new Replacer(this.pluginSlug + '/includes/load_textdomain.php', this),
      publicjs: new Replacer(this.pluginSlug + '/public/assets/js/public.js', this),
      debug: new Replacer(this.pluginSlug + '/admin/includes/debug.php', this),
      impexp: new Replacer(this.pluginSlug + '/admin/includes/impexp.php', this),
      requirements: new Replacer(this.pluginSlug + '/public/includes/requirements.php', this),
      language: new Replacer(this.pluginSlug + '/includes/language.php', this),
      fakepage: new Replacer(this.pluginSlug + '/includes/fake-page.php', this),
      widgetsample: new Replacer(this.pluginSlug + '/includes/widget/sample.php', this)
    };

    if (props.saveSettings === true) {
      var cleaned = props;
      delete cleaned.authorEmail;
      delete cleaned.authorEmail;
      delete cleaned.copyright;
      cleaned.author = {'name': props.author, 'email': this.authorEmail, 'url': this.authorURI, 'copyright': this.pluginCopyright};
      fs.writeFile(props.name + '.json', JSON.stringify(cleaned, null, 2), function (err) {
        if (err) {
          console.log('Error on save your json config file: ' + err);
        } else {
          console.log(("JSON saved to " + props.name + '.json').blue);
        }
      });
    }
    cb();
  }.bind(this));
};

WpPluginBoilerplateGenerator.prototype.download = function download() {
  var cb = this.async(),
          self = this,
          path = 'http://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/archive/' + version + '.zip',
          zip = "";
  //Force the remove of the same plugin folder
  if (args[2] === 'force' || args[3] === 'force' || args[4] === 'force') {
    rmdir.sync('./' + self.pluginSlug, function (error) {
      if (error) {
        console.log(('Error on removing plugin folder' + error).red);
      }
    });
    rmdir.sync('./plugin_temp', function (error) {
      if (error) {
        console.log(('Error on removing plugin temp folder' + error).red);
      }
    });
    //Check plugin folder if exist
  } else if (fs.existsSync('./' + self.pluginSlug)) {
    console.log(('Error: Folder ' + self.pluginSlug + ' already exist, change the name of the plugin!').red);
    process.exit(1);
  }
  //Check if exist the plugin.zip
  if (fs.existsSync(process.cwd() + '/plugin.zip')) {
    console.log(('Extract Plugin boilerplate').white);
    zip = new Admzip('./plugin.zip');
    zip.extractAllTo('plugin_temp', true);
    fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/.gitmodules', './plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/.gitmodules', function (err) {
      if (err) {
        console.log(('Error: Maybe you want the development version? Call this generator with the dev parameter').red);
        process.exit(1);
      }
    });
    fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function () {
      rmdir('plugin_temp', function (error) {
        if (error) {
          console.log(('Error on removing plugin temp folder' + error).red);
        }
        cb();
      });
    });
    //else download the zip
  } else {
    console.log(('Downloading the WP Plugin Boilerplate Powered...').white);
    //Do you want the development version? 
    if (version === 'master') {
      path = 'https://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/archive/master.zip';
    }

    request(path)
            .pipe(fs.createWriteStream('plugin.zip'))
            .on('close', function () {
              zip = new Admzip('./plugin.zip');
              console.log(('File downloaded').white);
              zip.extractAllTo('plugin_temp', true);
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/.gitmodules', './plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/.gitmodules', function (error) {
                if (error) {
                  console.log(('Error on move gitmodules:' + error).red);
                }
              });
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function () {
                rmdir('plugin_temp', function (error) {
                  if (error) {
                    console.log(('Error on move plugin temp folder:' + error).red);
                  }
                  cb();
                });
              });
              fs.unlink('plugin.zip');
            });
  }
};

WpPluginBoilerplateGenerator.prototype.setFiles = function setFiles() {
  cleanfolder = this.cleanFolder;
  //Change path of gitmodules
  this.files.gitmodules.add(new RegExp(this.pluginSlug + '/', "g"), '');
  this.files.gitmodules.add(new RegExp('git@github.com:', "g"), 'https://github.com/');

  //Rename files
  fs.rename(this.pluginSlug + '/plugin-name.php', this.files.primary.file, function (err) {
    if (err) {
      console.log(('Error on rename plugin-name.php:' + err).red);
    }
  });
  fs.rename(this.pluginSlug + '/admin/class-plugin-name-admin.php', this.files.adminClass.file, function (err) {
    if (err) {
      console.log(('Error on rename class-plugin-name-admin.php:' + err).red);
    }
  });
  fs.rename(this.pluginSlug + '/public/class-plugin-name.php', this.files.publicClass.file, function (err) {
    if (err) {
      console.log(('Error on rename class-plugin-name.php:' + err).red);
    }
  });
  fs.rename(this.pluginSlug + '/languages/plugin-name.pot', this.pluginSlug + '/languages/' + this.pluginSlug + '.pot', function (err) {
    if (err) {
      console.log(('Error on rename plugin-name.pot:' + err).red);
    }
  });

  console.log(('Renamed files').white);

  if (this.coffeescript !== true) {
    deleteFolder(this.pluginSlug + '/admin/assets/coffee/');
    deleteFolder(this.pluginSlug + '/public/assets/coffee/');
    this.files.gruntfile.looplines(this.loadLines.gruntfile.coffee);
    this.files.package.looplines(this.loadLines.package.coffee);
    this.files.package.add('"grunt-contrib-compass": "*",', '"grunt-contrib-compass": "*"');
    if (verbose) {
      console.log(('Removed Coffeescript files and stuff').italic);
    }
  }
};

WpPluginBoilerplateGenerator.prototype.setPrimary = function setPrimary() {
  this.files.primary.add(/Plugin Name:( {7})@TODO/g, 'Plugin Name:       ' + this.pluginName);
  this.files.primary.add(/Version:( {11})1\.0\.0/g, 'Version:           ' + this.pluginVersion);
  this.files.primary.add(/Author:( {12})@TODO/g, 'Author:            ' + this.author);
  this.files.primary.add(/Author URI:( {8})@TODO/g, 'Author URI:        ' + this.authorURI);
  this.files.primary.looplines(this.loadLines.primary.todo);
  if (verbose) {
    console.log(('Added info marker replace on plugin.php').italic);
  }
  //Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1 && this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.looplines(this.loadLines.primary.actdeact);
  }
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.primary.looplines(this.loadLines.primary.act);
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.looplines(this.loadLines.primary.deact);
  }

  //Repo
  if (this.modules.indexOf('CPT_Core') === -1 && this.modules.indexOf('Taxonomy_Core') === -1) {
    this.files.primary.looplines(this.loadLines.primary.cptcomment);
  }
  if (this.modules.indexOf('CPT_Core') === -1) {
    deleteFolder(this.pluginSlug + '/includes/CPT_Core');
    this.files.primary.looplines(this.loadLines.primary.cptcore);
    this.files.primary.rm("and Custom Post Type");
    if (verbose) {
      console.log(('Removed CPT_Core').italic);
    }
  }
  if (this.modules.indexOf('Taxonomy_Core') === -1) {
    deleteFolder(this.pluginSlug + '/includes/Taxonomy_Core');
    this.files.primary.looplines(this.loadLines.primary.taxcore);
    this.files.primary.rm("Taxonomy and");
    if (verbose) {
      console.log(('Removed Taxonomy_Core ').italic);
    }
  }
  if (this.modules.indexOf('Widget Helper') === -1) {
    deleteFolder(this.pluginSlug + '/includes/Widgets-Helper');
    deleteFolder(this.pluginSlug + '/includes/widgets');
    this.files.primary.looplines(this.loadLines.primary.widget);
    if (verbose) {
      console.log(('Removed Widgets Helper').italic);
    }
  }
  if (this.modules.indexOf('Freemius SDK') === -1) {
    deleteFolder(this.pluginSlug + '/includes/freemius');
    this.files.primary.looplines(this.loadLines.primary.freemius);
    if (verbose) {
      console.log(('Removed Freemius SDK').italic);
    }
  }
  if (this.modules.indexOf('WP Background Processing') === -1) {
    deleteFolder(this.pluginSlug + '/includes/wp-background-processing');
    if (verbose) {
      console.log(('Removed WP Background processing').italic);
    }
  }

  //Function
  if (this.modules.indexOf('Fake Page Class') === -1) {
    fs.unlink(this.pluginSlug + '/includes/fake-page.php');
    this.files.primary.looplines(this.loadLines.primary.fakepage);
    if (verbose) {
      console.log(('Removed Fake Class').italic);
    }
  }
  if (this.modules.indexOf('Template system (like WooCommerce)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/template.php');
    deleteFolder(this.pluginSlug + '/templates');
    this.files.primary.looplines(this.loadLines.primary.template);
    if (verbose) {
      console.log(('Removed Template System').italic);
    }
  }
  if (this.modules.indexOf('Language function support (WPML/Ceceppa Multilingua/Polylang)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/language.php');
    this.files.primary.looplines(this.loadLines.primary.language);
    if (verbose) {
      console.log(('Removed Language functions').italic);
    }
  }
};

WpPluginBoilerplateGenerator.prototype.setAdminClass = function setAdminClass() {
  this.files.adminClass.looplines(this.loadLines.admin.todo);
  if (verbose) {
    console.log(('Added info marker in admin-class*.php').italic);
  }
  //Repo
  if (this.modules.indexOf('CMB2') === -1) {
    deleteFolder(this.pluginSlug + '/admin/includes/CMB2');
    deleteFolder(this.pluginSlug + '/admin/includes/CMB2-Google-Maps');
    deleteFolder(this.pluginSlug + '/admin/includes/CMB2-grid');
    this.files.impexp.looplines(this.loadLines.impexp.cmb);
    this.files.adminClass.looplines(this.loadLines.admin.cmb);
    if (this.adminPage === true) {
      this.files.adminView.looplines(this.loadLines.adminview.cmb);
      this.files.adminClass.looplines(this.loadLines.admin.adminPage);
    }
    if (verbose) {
      console.log(('Removed CMB2').italic);
    }
  }
  if (this.modules.indexOf('CMB2-Google-Maps') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.cmbgmaps);
    deleteFolder(this.pluginSlug + '/admin/includes/CMB2-Google-Maps');
    if (verbose) {
      console.log(('Removed CMB2-Google-Maps').italic);
    }
  }
  if (this.modules.indexOf('CMB2-Grid') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.cmbgrid);
    this.files.adminClass.add('$field1 = ', '');
    this.files.adminClass.add('$field2 = ', '');
    deleteFolder(this.pluginSlug + '/admin/includes/CMB2-grid');
    if (verbose) {
      console.log(('Removed CMB2-Grid').italic);
    }
  }
  if (this.modules.indexOf('WP-Contextual-Help') === -1) {
    deleteFolder(this.pluginSlug + '/admin/includes/WP-Contextual-Help');
    deleteFolder(this.pluginSlug + '/help-docs');
    this.files.adminClass.looplines(this.loadLines.admin.contextual);
    if (verbose) {
      console.log(('Removed Wp_Contextual_Help').italic);
    }
  }
  if (this.modules.indexOf('WP-Admin-Notice') === -1) {
    deleteFolder(this.pluginSlug + '/admin/includes/WP-Admin-Notice');
    this.files.adminClass.looplines(this.loadLines.admin.notice);
    if (verbose) {
      console.log(('Removed WP-Admin-Notice').italic);
    }
  }
  if (this.modules.indexOf('PointerPlus') === -1) {
    deleteFolder(this.pluginSlug + '/admin/includes/PointerPlus');
    this.files.adminClass.looplines(this.loadLines.admin.pointers);
    if (verbose) {
      console.log(('Removed PointerPlus').italic);
    }
  }
  if (this.modules.indexOf('CronPlus') === -1) {
    deleteFolder(this.pluginSlug + '/admin/includes/CronPlus');
    this.files.adminClass.looplines(this.loadLines.admin.cron);
    if (verbose) {
      console.log(('Removed CronPlus').italic);
    }
  }
  if (this.modules.indexOf('CPT_Columns') === -1) {
    fs.unlink(this.pluginSlug + '/admin/includes/CPT_Columns.php');
    this.files.adminClass.looplines(this.loadLines.admin.columns);
    if (verbose) {
      console.log(('Removed CPT_Columns').italic);
    }
  }

  //Snippet
  if (this.adminPage === false) {
    this.files.adminClass.looplines(this.loadLines.admin.remove);
    if (verbose) {
      console.log(('Removed code of Admin page').italic);
    }
  }
  if (this.snippet.indexOf('Support Dashboard At Glance Widget for CPT') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.glance);
    this.files.adminCss.looplines(this.loadLines.admincss.glance);
    if (verbose) {
      console.log(('Removed code of At Glance Support in Dashboard').italic);
    }
  }
  if (this.snippet.indexOf('Support Dashboard Activity Widget for CPT') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.activity);
    if (verbose) {
      console.log(('Removed code of Activity Support in Dashboard').italic);
    }
  }
  if (verbose) {
    console.log(('Cleaning in admin-class*.php').italic);
  }
  if (this.snippet.indexOf('Bubble notification on pending CPT') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.bubble);
    if (verbose) {
      console.log(('Removed Bubble Notification').italic);
    }
  }
  if (this.snippet.indexOf('Import/Export settings system') === -1) {
    fs.unlink(this.pluginSlug + '/admin/includes/impexp.php');
    this.files.adminClass.looplines(this.loadLines.admin.impexp);
    if (this.adminPage === true) {
      this.files.gruntfile.looplines(this.loadLines.adminview.impexp);
    }
    if (verbose) {
      console.log(('Removed Import/Export Settings').italic);
    }
  }
  if (this.snippet.indexOf('Debug system (Debug Bar support)') === -1) {
    fs.unlink(this.pluginSlug + '/admin/includes/debug.php');
    fs.unlink(this.pluginSlug + '/admin/includes/PN_Debug_Panel.php');
    this.files.adminClass.looplines(this.loadLines.admin.debug);
    if (verbose) {
      console.log(('Removed Debug system').italic);
    }
  }
  if (this.snippet.indexOf('Custom action') === -1 && this.snippet.indexOf('Custom filter') === -1 && this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.custom);
  }
  if (this.snippet.indexOf('Custom action') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.customact);
    if (verbose) {
      console.log(('Removed Custom Action').italic);
    }
  }
  if (this.snippet.indexOf('Custom filter') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.customflt);
    if (verbose) {
      console.log(('Removed Custom Filter').italic);
    }
  }
  if (this.snippet.indexOf('Donate link in plugins list') === -1) {
    this.files.adminClass.looplines(this.loadLines.admin.donate);
    if (verbose) {
      console.log(('Removed Donate link in plugins list').italic);
    }
  }

};

WpPluginBoilerplateGenerator.prototype.setPublicClass = function setPublicClass() {
  this.files.publicClass.looplines(this.loadLines.public.todo);

  //Assets - JS/CSS
  if (this.publicResources.length === 0) {
    this.files.publicClass.looplines(this.loadLines.public.jscss);
    deleteFolder(this.pluginSlug + '/public/assets/');
  }
  if (this.publicResources.indexOf('JS') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.js);
    deleteFolder(this.pluginSlug + '/public/assets/js');
  }
  if (this.publicResources.indexOf('CSS') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.css);
    deleteFolder(this.pluginSlug + '/public/assets/css');
    deleteFolder(this.pluginSlug + '/public/assets/sass');
  }

  //Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.act);
    if (verbose) {
      console.log(('Removed Activate Method').italic);
    }
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.deact);
    if (verbose) {
      console.log(('Removed Deactive Method').italic);
    }
  }

  //Repo
  if (this.modules.indexOf('CPT_Core') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.cptcore);
  }
  if (this.modules.indexOf('Taxonomy_Core') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.taxcore);
  }

  //Function
  if (this.modules.indexOf('Template system (like WooCommerce)') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.template);
    deleteFolder(this.pluginSlug + '/templates');
  }
  if (this.modules.indexOf('Requirements system on activation') === -1) {
    fs.unlink(this.pluginSlug + '/public/includes/requirements.php');
    fs.unlink(this.pluginSlug + '/languages/requirements.pot');
    this.files.publicClass.looplines(this.loadLines.public.requirement);
    if (verbose) {
      console.log(('Removed Requirements Detection System').italic);
    }
  }
  //Snippet
  if (this.snippet.indexOf('CPTs on search box') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.cptsearch);
    if (verbose) {
      console.log(('Removed CPTs on search box').italic);
    }
  }
  if (this.snippet.indexOf('Custom action') === -1 && this.snippet.indexOf('Custom filter') === -1 && this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.customfunc);
  }
  if (this.snippet.indexOf('Custom action') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.customact);
  }
  if (this.snippet.indexOf('Custom filter') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.customflt);
  }
  if (this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.customsc);
  }
  if (this.snippet.indexOf('Javascript DOM-based Routing') === -1) {
    this.files.publicjs.looplines(this.loadLines.publicjs.routing);
  }
  if (this.snippet.indexOf('Capability system') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.cap);
  }
  if (this.snippet.indexOf('Add body class') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.body);
  }
  if (this.snippet.indexOf('wp_localize_script for PHP var to JS') === -1) {
    this.files.publicClass.looplines(this.loadLines.public.localize);
    this.files.publicjs.looplines(this.loadLines.publicjs.localize);
  }
};

WpPluginBoilerplateGenerator.prototype.setReadme = function setReadme() {
  this.files.readme.add('@TODO: Plugin Name', this.pluginName);
};

WpPluginBoilerplateGenerator.prototype.setUninstall = function setUninstall() {
  if (this.activateDeactivate.indexOf('Uninstall File') === -1) {
    fs.unlink(this.files.uninstall.file);
    delete this.files.uninstall;
  } else if (this.snippet.indexOf('Capability system') === -1) {
    this.files.uninstall.looplines(this.loadLines.uninstall.cap);
    this.files.uninstall.add('global $wpdb, $wp_roles;', 'global $wpdb;');
  }
};
