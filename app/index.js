'use strict';

var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var fs = require('fs');
var request = require('request');
var Admzip = require('adm-zip');
var rmdir = require('rimraf');
var s = require('underscore.string');
var sys = require('sys');
var spawn = require('child_process').spawn;
var colors = require('colors');
var Replacer = require('./replacer');
var cleanfolder = false;
var args = process.argv.slice(2);
var version = '1.1.1';
var is_default = false;
var verbose = false;
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
 * Remove the unuseful file and folder, insert the index.php in the folders
 * 
 * @param string path
 */
function cleanFolder(path) {
  console.log(('Parsing ' + path).italic);
  cleanParsing(path);

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
          console.log(('Parsing ' + pathrec).italic);
        }
        cleanParsing(path);
        cleanFolder(pathrec);
      }
    }
  });
}

function cleanParsing(pathrec) {
  var default_file = [
    'CONTRIBUTING.md', 'readme.md', 'phpunit.xml', 'packages.json', 'package.json', 'production.rb', 'composer.json',
    'Gruntfile.js', 'README.md', 'example-functions.php', 'bower.json', 'Capfile', 'screenshot-1.png', 'component.json',
    '.travis.yml', '.bowerrc', '.gitignore', 'README.txt', 'readme.txt', 'release.sh', 'pointerplus.php'
  ];
  var default_folder = ['tests', 'bin', 'deploy', 'config'];
  if (cleanfolder !== false) {
    //Remove the unuseful files
    default_file.forEach(function (element, index, array) {
      fs.exists('./' + pathrec + '/' + element, function (exists) {
        if (exists) {
          fs.unlink(pathrec + '/' + element, function (err) {
//          if (err) {
//            console.log((err).red);
//          }
          });
          if (verbose) {
            console.log(('Removed ' + pathrec + '/' + element).italic);
          }
        }
      });
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
//          if (err) {
//            console.log((err).red);
//          }
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

var WpPluginBoilerplateGenerator = module.exports = function WpPluginBoilerplateGenerator(args, options, config) {
  var self = this,
          default_file;

  yeoman.generators.Base.apply(this, arguments);

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
      '       if [ -d $path ]; then',
      '         rm -r $path',
      '         echo "Add $url in $path"',
      '         git submodule add -f $url $path',
      '       fi',
      '   done',
    ].join('\n');
    fs.writeFile(self.pluginSlug + '/submodules.sh', submodulessh, 'utf8',
            function (err) {
              if (err) {
                return console.log((err).red);
              } else {
                fs.chmodSync(process.cwd() + '/' + self.pluginSlug + '/submodules.sh', '0777');
                console.log(('Generate git config on the fly').white);
                //Execute the magic for clean, destroy, brick, brock the code
                var key = null;
                for (key in self.files) {
                  if (self.files.hasOwnProperty(key)) {
                    self.files[key].sed();
                  }
                }
                console.log(('Parsed all the files').white);
                //Call the bash script
                console.log(('Download submodules').white);
                var submodule = spawn(process.cwd() + '/' + self.pluginSlug + '/submodules.sh', [],
                        {
                          cwd: process.cwd() + '/' + self.pluginSlug + '/',
                        });
                submodule.stdout.on('data',
                        function (data) {
                          console.log((data.toString()).green);
                        });
                submodule.stderr.on('data',
                        function (data) {
                          console.log((data.toString()).blue);
                        });
                submodule.on('close',
                        function (code) {
                          if (this.git !== true) {
                            fs.unlink(this.pluginSlug + '.gitmodules', function (error) {
                              if (error) {
                                console.log((error).red);
                              }
                            });
                            rmdir(this.pluginSlug + '/.git', function (error) {
                              if (error) {
                                console.log((error).red);
                              }
                            });
                            console.log(('Remove git config generated').white);
                          }
                          //Clean all the folders!!
                          if (self.modules.indexOf('CPT_Core') !== -1) {
                            cleanFolder(self.pluginSlug + '/includes/CPT_Core');
                          }

                          if (self.modules.indexOf('Taxonomy_Core') !== -1) {
                            cleanFolder(self.pluginSlug + '/includes/Taxonomy_Core');
                          }

                          if (self.modules.indexOf('Widget-Boilerplate') !== -1) {
                            cleanFolder(self.pluginSlug + '/includes/Widget-Boilerplate');
                            cleanFolder(self.pluginSlug + '/includes/Widget-Boilerplate/widget-boilerplate');
                          }

                          if (self.modules.indexOf('CMB2') !== -1) {
                            cleanFolder(self.pluginSlug + '/admin/includes/CMB2');
                          }

                          if (self.modules.indexOf('PointerPlus') !== -1) {
                            cleanFolder(self.pluginSlug + '/admin/includes/PointerPlus');
                          }

                          if (self.modules.indexOf('Template system (like WooCommerce)') !== -1) {
                            cleanFolder(self.pluginSlug + '/templates');
                          }

                          if (self.modules.indexOf('WP-Contextual-Help') !== -1) {
                            if (cleanfolder !== false) {
                              rmdir(self.pluginSlug + +'/admin/includes/WP-Contextual-Help/assets/', function (err) {
                              });
                            }
                            cleanFolder(self.pluginSlug + '/admin/includes/WP-Contextual-Help');
                          }

                          //Console.log are cool and bowtie are cool!
                          console.log(('Inserted index.php files in all the folders').white);
                          console.log(('All done!').white);
                        });
              }
            }
    );

  });

  //have Yeoman greet the user.
  console.log(this.yeoman);
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
    console.log('--------------------------');
    console.log(('You can create the file ' + process.cwd() + '/default-values.json with default values in the parent folder! Use the default-values-example.json as a template.').bold);
    console.log('--------------------------');
    default_file = path.join(__dirname, '../default-values-example.json');
    is_default = true;
  }
  this.defaultValues = JSON.parse(this.readFileAsString(default_file));
};

util.inherits(WpPluginBoilerplateGenerator, yeoman.generators.Base);

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
        {name: 'Taxonomy_Core', checked: true},
        {name: 'Widget-Boilerplate', checked: true},
        {name: 'CMB2', checked: true},
        {name: 'WP-Contextual-Help', checked: true},
        {name: 'WP-Admin-Notice', checked: true},
        {name: 'PointerPlus', checked: true},
        {name: 'Fake Page Class', checked: true},
        {name: 'Template system (like WooCommerce)', checked: true},
        {name: 'Language function support (WPML/Ceceppa Multilingua/Polylang)', checked: true},
        {name: 'Requirements system on activation', checked: true}
      ]
    }, {
      type: 'checkbox',
      name: 'snippet',
      message: 'Which snippet your plugin needs?',
      choices: [
        {name: 'Support Dashboard At Glance Widget for CPT', checked: true},
        {name: 'Javascript DOM-based Routing', checked: true},
        {name: 'Bubble notification on pending CPT', checked: true},
        {name: 'Import/Export settings system', checked: true},
        {name: 'Capability system', checked: true},
        {name: 'Debug system (Debug Bar support)', checked: true},
        {name: 'Add body class', checked: true},
        {name: 'wp_localize_script for PHP var to JS', checked: true},
        {name: 'Custom action', checked: true},
        {name: 'Custom filter', checked: true},
        {name: 'Custom shortcode', checked: true}
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
      name: 'saveSettings',
      message: 'Do you want save the configuration for reuse it?'
    }];

  if (is_default === false) {
    if (this.defaultValues.name !== '') {
      if (fs.existsSync('./' + s.slugify(this.defaultValues.name)) && s.slugify(this.defaultValues.name) !== '') {
        console.log(('Warning folder ' + s.slugify(this.defaultValues.name) + ' already exist, change the name of the plugin!').red);
      }
      prompts[0].default = this.defaultValues.name;
    }
    if (this.defaultValues.version !== '') {
      prompts[1].default = this.defaultValues.pluginVersion;
    }
    if (this.defaultValues.publicResources !== '') {
      if (this.defaultValues.publicResources.length === 0) {
        prompts[6].choices.forEach(function (element, index, array) {
          prompts[6].choices[index].checked = false;
        });
      } else {
        var defaultvalues = this.defaultValues.publicResources;
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
      if (this.defaultValues.activateDeactivate.length === 0) {
        prompts[7].choices.forEach(function (element, index, array) {
          prompts[7].choices[index].checked = false;
        });
      } else {
        var defaultvalues = this.defaultValues.activateDeactivate;
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
    if (this.defaultValues.modules.length === 0) {
      prompts[9].choices.forEach(function (element, index, array) {
        prompts[9].choices[index].checked = false;
      });
    } else {
      var defaultvalues = this.defaultValues.modules;
      prompts[9].choices.forEach(function (element, index, array) {
        prompts[9].choices[index].checked = false;
        defaultvalues.forEach(function (element_z, index_z, array_z) {
          if (prompts[9].choices[index].name === element_z) {
            prompts[9].choices[index].checked = true;
          }
        });
      });
    }
    if (this.defaultValues.snippet.length === 0) {
      prompts[10].choices.forEach(function (element, index, array) {
        prompts[10].choices[index].checked = false;
      });
    } else {
      var defaultvalues = this.defaultValues.snippet;
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
    }
    if (this.defaultValues.cleanFolder !== '') {
      prompts[12].default = this.defaultValues.cleanFolder;
    }
    if (this.defaultValues.saveSettings !== '') {
      prompts[13].default = this.defaultValues.saveSettings;
    }
  }
  this.prompt(prompts, function (props) {
    this.pluginName = props.name;
    this.pluginSlug = s.slugify(props.name);
    this.pluginClassName = s.titleize(props.name).replace(/ /g, "_");
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
      adminCss: new Replacer(this.pluginSlug + '/admin/assets/css/admin.css', this),
      publicView: new Replacer(this.pluginSlug + '/public/views/public.php', this),
      adminView: new Replacer(this.pluginSlug + '/admin/views/admin.php', this),
      uninstall: new Replacer(this.pluginSlug + '/uninstall.php', this),
      readme: new Replacer(this.pluginSlug + '/README.txt', this),
      gitmodules: new Replacer(this.pluginSlug + '/.gitmodules', this),
      template: new Replacer(this.pluginSlug + '/includes/template.php', this),
      publicjs: new Replacer(this.pluginSlug + '/public/assets/js/public.js', this),
      debug: new Replacer(this.pluginSlug + '/admin/includes/debug.php', this),
      requirements: new Replacer(this.pluginSlug + '/public/includes/requirements.php', this),
      language: new Replacer(this.pluginSlug + '/includes/language.php', this),
      fakepage: new Replacer(this.pluginSlug + '/includes/fake-page.php', this)
    };

    if (props.saveSettings === true) {
      var cleaned = props;
      delete cleaned['authorEmail'];
      delete cleaned['authorEmail'];
      delete cleaned['copyright'];
      cleaned.author = {'name': props.author, 'email': this.authorEmail, 'url': this.authorURI, 'copyright': this.pluginCopyright};
      fs.writeFile(props.name + '.json', JSON.stringify(cleaned, null, 2), function (err) {
        if (err) {
          console.log(err);
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
  if (args[2] === 'force' || args[3] === 'force') {
    rmdir.sync('./' + self.pluginSlug, function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    rmdir.sync('./plugin_temp', function (error) {
      if (error) {
        console.log((error).red);
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
        console.log(('Error: Maybe you want the development version? call this generator with the dev parameter').red);
        process.exit(1);
      }
    });
    fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function () {
      rmdir('plugin_temp', function (error) {
        if (error) {
          console.log((error).red);
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
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/.gitmodules', './plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/.gitmodules');
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function () {
                rmdir('plugin_temp', function (error) {
                  if (error) {
                    console.log((error).red);
                  }
                  cb();
                });
              });
              fs.unlink('plugin.zip');
            });
  }
};

WpPluginBoilerplateGenerator.prototype.setFiles = function setName() {
  cleanfolder = this.cleanFolder;
  //Change path of gitmodules
  this.files.gitmodules.add(new RegExp(this.pluginSlug + '/', "g"), '');

  //Rename files
  fs.rename(this.pluginSlug + '/plugin-name.php', this.files.primary.file);
  fs.rename(this.pluginSlug + '/admin/class-plugin-name-admin.php', this.files.adminClass.file);
  fs.rename(this.pluginSlug + '/public/class-plugin-name.php', this.files.publicClass.file);
  fs.rename(this.pluginSlug + '/languages/plugin-name.pot', this.pluginSlug + '/languages/' + this.pluginSlug + '.pot');

  if (verbose) {
    console.log(('Renamed files').italic);
  }
};

WpPluginBoilerplateGenerator.prototype.setPrimary = function setPrimary() {
  this.files.primary.add(/Plugin Name:( {7})@TODO/g, 'Plugin Name:       ' + this.pluginName);
  this.files.primary.add(/Version:( {11})1\.0\.0/g, 'Version:           ' + this.pluginVersion);
  this.files.primary.add(/Author:( {12})@TODO/g, 'Author:            ' + this.author);
  this.files.primary.add(/Author URI:( {8})@TODO/g, 'Author URI:        ' + this.authorURI);
  this.files.primary.rm("/*\n * @TODO:\n *\n * - replace `class-" + this.pluginSlug + ".php` with the name of the plugin's class file\n *\n */");
  this.files.primary.rm(" * @TODO:\n *\n * - replace `class-" + this.pluginSlug + "-admin.php` with the name of the plugin's admin file\n");
  this.files.primary.rm(" *\n * @TODO:\n *\n * - replace " + this.pluginClassName + " with the name of the class defined in\n *   `class-" + this.pluginSlug + ".php`\n");
  this.files.primary.rm("/*\n * @TODO:\n *\n * - replace " + this.pluginClassName + " with the name of the class defined in\n *   `class-" + this.pluginSlug + ".php`\n */");
  this.files.primary.rm(" * - replace " + this.pluginClassName + "_Admin with the name of the class defined in\n *   `class-" + this.pluginSlug + "-admin.php`\n");
  this.files.primary.rm(" * @TODO:\n *\n * - replace `class-plugin-admin.php` with the name of the plugin's admin file\n * - replace " + this.pluginClassName + "Admin with the name of the class defined in\n *   `class-" + this.pluginSlug + "-admin.php`\n *\n");
  if (verbose) {
    console.log(('Added info marker replace on plugin.php').italic);
  }
  //Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1 && this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.rm("\n/*\n * Register hooks that are fired when the plugin is activated or deactivated.\n * When the plugin is deleted, the uninstall.php file is loaded.\n */\nregister_activation_hook( __FILE__, array( '" + this.pluginClassName + "', 'activate' ) );\nregister_deactivation_hook( __FILE__, array( '" + this.pluginClassName + "', 'deactivate' ) );\n");
  }
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.primary.rm("\nregister_activation_hook( __FILE__, array( '" + this.pluginClassName + "', 'activate' ) );");
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.rm("\nregister_deactivation_hook( __FILE__, array( '" + this.pluginClassName + "', 'deactivate' ) );");
  }

  //Repo
  if (this.modules.indexOf('CPT_Core') === -1 && this.modules.indexOf('Taxonomy_Core') === -1) {
    this.files.primary.rm("\n/*\n * Load library for simple and fast creation of Taxonomy and Custom Post Type\n *\n */");
  }
  if (this.modules.indexOf('CPT_Core') === -1) {
    rmdir(this.pluginSlug + '/includes/CPT_Core', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.primary.rm("require_once( plugin_dir_path( __FILE__ ) . 'includes/CPT_Core/CPT_Core.php' );");
    this.files.primary.rm("and Custom Post Type");
    if (verbose) {
      console.log(('CPT_Core removed').italic);
    }
  }
  if (this.modules.indexOf('Taxonomy_Core') === -1) {
    rmdir(this.pluginSlug + '/includes/Taxonomy_Core', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.primary.rm("require_once( plugin_dir_path( __FILE__ ) . 'includes/Taxonomy_Core/Taxonomy_Core.php' );");
    this.files.primary.rm("Taxonomy and");
    if (verbose) {
      console.log(('Taxnomy_Core removed').italic);
    }
  }
  if (this.modules.indexOf('Widget-Boilerplate') === -1) {
    rmdir(this.pluginSlug + '/includes/Widget-Boilerplate', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.primary.rmsearch(' * Load Widget boilerplate', '', 1, 3);
    if (verbose) {
      console.log(('Removed Widget Boilerplate').italic);
    }
  }

  //Function
  if (this.modules.indexOf('Fake Page Class') === -1) {
    fs.unlink(this.pluginSlug + '/includes/fake-page.php');
    this.files.primary.rmsearch(' * Load Fake Page class', "'post content' => 'This is the fake page content'", 1, -3);
    if (verbose) {
      console.log(('Removed Fake Class').italic);
    }
  }
  if (this.modules.indexOf('Template system (like WooCommerce)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/template.php');
    rmdir(this.pluginSlug + '/templates', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.primary.rmsearch(' * Load template system', '', 1, 3);
    if (verbose) {
      console.log(('Removed Template System').italic);
    }
  }
  if (this.modules.indexOf('Language function support (WPML/Ceceppa Multilingua/Polylang)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/language.php');
    this.files.primary.rmsearch(' * Load Language wrapper function for WPML/Ceceppa Multilingua/Polylang', '', 1, 3);
    if (verbose) {
      console.log(('Removed Language function').italic);
    }
  }
};

WpPluginBoilerplateGenerator.prototype.setAdminClass = function setAdminClass() {
  this.files.adminClass.rm(" * @TODO: Rename this class to a proper name for your plugin.\n *\n");
  this.files.adminClass.rm("*\n * Call $plugin_slug from public plugin class.\n *\n * @TODO:\n *\n * - Rename \"" + this.pluginClassName + "\" to the name of your initial plugin class\n *\n */\n");
  this.files.adminClass.rmsearch('* Register and enqueue admin-specific style sheet.', '* - Rename "Plugin_Name" to the name your plugin', -2, -1);
  this.files.adminClass.rmsearch('* Register and enqueue admin-specific JavaScript.', '* - Rename "Plugin_Name" to the name your plugin', -2, -1);
  if (verbose) {
    console.log(('Added info marker in admin-class*.php').italic);
  }
  //Repo
  if (this.modules.indexOf('CMB2') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/CMB2', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    rmdir(this.pluginSlug + '/admin/includes/CMB2-Shortcode', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.adminClass.rm("$settings[ 1 ] = get_option( $this->plugin_slug . '-settings-second' );");
    this.files.adminClass.rm("update_option( $this->plugin_slug . '-settings-second', get_object_vars( $settings[ 1 ] ) );");
    this.files.adminClass.rmsearch('* CMB 2 for metabox and many other cool things!', "add_filter( 'cmb2_meta_boxes', array( $this, 'cmb_demo_metaboxes' ) );", 1, 0);
    this.files.publicClass.rm("\n// Check for the CMB2 Shortcode Button");
    this.files.publicClass.rm("\n// In bundle with the boilerplate https://github.com/jtsternberg/Shortcode_Button");
    if (this.adminPage === true) {
      this.files.adminView.rmsearch('<div id="tabs-1">', "cmb2_metabox_form( $option_fields, $this->plugin_slug . '-settings' );", -2, -2);
      this.files.adminView.rmsearch('<div id="tabs-2">', "cmb2_metabox_form( $option_fields_second, $this->plugin_slug . '-settings-second' );", -2, -2);
    }
    if (verbose) {
      console.log(('Removed CMB2').italic);
    }
  }
  if (this.modules.indexOf('WP-Contextual-Help') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/WP-Contextual-Help', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    rmdir(this.pluginSlug + '/help-docs', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.adminClass.rmsearch('* Load Wp_Contextual_Help for the help tabs', "add_action( 'init', array( $this, 'contextual_help' ) );", 1, -1);
    this.files.adminClass.rmsearch('* Filter for change the folder of Contextual Help', "$paths[] = plugin_dir_path( __FILE__ ) . '../help-docs/';", 1, -3);
    this.files.adminClass.rmsearch('* Filter for change the folder image of Contextual Help', "$paths[] = plugin_dir_path( __FILE__ ) . '../help-docs/img';", 1, -3);
    this.files.adminClass.rmsearch('* Contextual Help, docs in /help-docs folter', "'page' => 'settings_page_' . $this->plugin_slug,", 1, -4);
    if (verbose) {
      console.log(('Removed Wp_Contextual_Help').italic);
    }
  }
  if (this.modules.indexOf('WP-Admin-Notice') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/WP-Admin-Notice', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.adminClass.rmsearch('* Load Wp_Admin_Notice for the notices in the backend', "new WP_Admin_Notice( __( 'Error Messages' ), 'error' );", 1, -1);
    if (verbose) {
      console.log(('Removed WP-Admin-Notice').italic);
    }
  }
  if (this.modules.indexOf('PointerPlus') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/PointerPlus', function (error) {
      if (error) {
        console.log((error).red);
      }
    });
    this.files.adminClass.rmsearch('* Load PointerPlus for the Wp Pointer', "add_filter( 'pointerplus_list', array( $this, 'custom_initial_pointers' ), 10, 2 );", 1, -1);
    this.files.adminClass.rmsearch('* Add pointers.', "'icon_class' => 'dashicons-welcome-learn-more',", 1, -3);
    if (verbose) {
      console.log(('Removed PointerPlus').italic);
    }
  }

  //Snippet
  if (this.adminPage === false) {
    this.files.adminClass.rm("\n// Add an action link pointing to the options page.\n$plugin_basename = plugin_basename( plugin_dir_path( __DIR__ ) . $this->plugin_slug . '.php' );\nadd_filter( 'plugin_action_links_' . $plugin_basename, array( $this, 'add_action_links' ) );");
    this.files.adminClass.rm("\n\n// Load admin style sheet and JavaScript.\nadd_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );\nadd_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );\n\n// Add the options page and menu item.\nadd_action( 'admin_menu', array( $this, 'add_plugin_admin_menu' ) );");
    this.files.adminClass.rm("\n/**\n * Register and enqueue admin-specific style sheet.\n *\n * @since     1.0.0\n *\n * @return    null    Return early if no settings page is registered.\n */\npublic function enqueue_admin_styles() {\n\nif ( ! isset( $this->plugin_screen_hook_suffix ) ) {\nreturn;\n}\n\n$screen = get_current_screen();\nif ( $this->plugin_screen_hook_suffix == $screen->id ) {\nwp_enqueue_style( $this->plugin_slug .'-admin-styles', plugins_url( 'assets/css/admin.css', __FILE__ ), array(), MyNewPlugin::VERSION );\n}\n\n}\n\n/**\n * Register and enqueue admin-specific JavaScript.\n *\n * @since     1.0.0\n *\n * @return    null    Return early if no settings page is registered.\n */\npublic function enqueue_admin_scripts() {\n\nif ( ! isset( $this->plugin_screen_hook_suffix ) ) {\nreturn;\n}\n\n$screen = get_current_screen();\nif ( $this->plugin_screen_hook_suffix == $screen->id ) {\nwp_enqueue_script( $this->plugin_slug . '-admin-script', plugins_url( 'assets/js/admin.js', __FILE__ ), array( 'jquery' ), MyNewPlugin::VERSION );\n}\n\n}\n\n/**\n * Register the administration menu for this plugin into the WordPress Dashboard menu.\n *\n * @since    1.0.0\n */\npublic function add_plugin_admin_menu() {\n\n/*\n * Add a settings page for this plugin to the Settings menu.\n *\n * NOTE:  Alternative menu locations are available via WordPress administration menu functions.\n *\n *        Administration Menus: http://codex.wordpress.org/Administration_Menus\n *\n * @TODO:\n *\n * - Change 'Page Title' to the title of your plugin admin page\n * - Change 'Menu Text' to the text for menu item for the plugin settings page\n * - Change 'manage_options' to the capability you see fit\n *   For reference: http://codex.wordpress.org/Roles_and_Capabilities\n */\n$this->plugin_screen_hook_suffix = add_options_page(\n__( 'Page Title', $this->plugin_slug ),\n__( 'Menu Text', $this->plugin_slug ),\n'manage_options',\n$this->plugin_slug,\narray( $this, 'display_plugin_admin_page' )\n);\n\n}\n\n/**\n * Render the settings page for this plugin.\n *\n * @since    1.0.0\n */\npublic function display_plugin_admin_page() {\ninclude_once( 'views/admin.php' );\n}\n\n/**\n * Add settings action link to the plugins page.\n *\n * @since    1.0.0\n */\npublic function add_action_links( $links ) {\n\nreturn array_merge(\narray(\n'settings' => '<a href=\"' . admin_url( 'options-general.php?page=' . $this->plugin_slug ) . '\">' . __( 'Settings', $this->plugin_slug ) . '</a>'\n),\n$links\n);\n\n}");
  } else {
    if (this.snippet.indexOf('Support Dashboard At Glance Widget for CPT') === -1) {
      this.files.adminClass.rmsearch('// Load admin style in dashboard for the At glance widget', "add_filter( 'dashboard_glance_items', array( $this, 'cpt_dashboard_support' ), 10, 1 );", 1, -1);
      this.files.adminClass.rmsearch('* Add the counter of your CPTs in At Glance widget in the dashboard<br>', 'return $current_key;', 1, 5);
      this.files.adminCss.rmsearch('#dashboard_right_now a.demo-count:before {', '', 0, 3);
    }
  }
  if (verbose) {
    console.log(('Cleaning in admin-class*.php').italic);
  }
  if (this.snippet.indexOf('Bubble notification on pending CPT') === -1) {
    this.files.adminClass.rmsearch('//Add bubble notification for cpt pending', "add_action( 'admin_menu', array( $this, 'pending_cpt_bubble' ), 999 );", 1, -1);
    this.files.adminClass.rmsearch("* Bubble Notification for pending cpt<br>", "return $current_key;", 1, -5);
    if (verbose) {
      console.log(('Removed Bubble Notification').italic);
    }
  }
  if (this.snippet.indexOf('Import/Export settings system') === -1) {
    this.files.adminClass.rmsearch("* Process a settings export from config", "wp_safe_redirect( admin_url( 'options-general.php?page=' . $this->plugin_slug ) );", 1, -3);
    if (this.adminPage === true) {
      this.files.adminView.rmsearch('<div id="tabs-3"', "<?php submit_button( __( 'Import' ), 'secondary', 'submit', false ); ?>", -2, -5);
    }
    if (verbose) {
      console.log(('Removed Import/Export Settings').italic);
    }
  }
  if (this.snippet.indexOf('Debug system (Debug Bar support)') === -1) {
    fs.unlink(this.pluginSlug + '/admin/includes/debug.php');
    this.files.adminClass.rmsearch("* Debug mode", "$debug->log( __( 'Plugin Loaded', $this->plugin_slug ) );", 1, -1);
    if (verbose) {
      console.log(('Removed Debug system').italic);
    }
  }
  if (this.snippet.indexOf('Custom action') === -1 && this.snippet.indexOf('Custom filter') === -1 && this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.adminClass.rmsearch('* Define custom functionality.', '* http://codex.wordpress.org/Plugin_API#Hooks.2C_Actions_and_Filters', 1, -2);
  }
  if (this.snippet.indexOf('Custom action') === -1) {
    this.files.adminClass.rm("add_action( '@TODO', array( $this, 'action_method_name' ) );\n");
    this.files.adminClass.rmsearch('* NOTE:     Actions are points in the execution of a page or process', '// @TODO: Define your action hook callback here', 1, -2);
    if (verbose) {
      console.log(('Removed Custom Action').italic);
    }
  }
  if (this.snippet.indexOf('Custom filter') === -1) {
    this.files.adminClass.rm("add_filter( '@TODO', array( $this, 'filter_method_name' ) );\n");
    this.files.adminClass.rmsearch('* NOTE:     Filters are points of execution in which WordPress modifies data', '// @TODO: Define your filter hook callback here', 1, -2);
    if (verbose) {
      console.log(('Removed Custom Filter').italic);
    }
  }
};

WpPluginBoilerplateGenerator.prototype.setPublicClass = function setPublicClass() {
  this.files.publicClass.rm("* @TODO: Rename this class to a proper name for your plugin.\n *\n ");
  this.files.publicClass.rm('* @TODO - Rename "' + this.pluginName + '" to the name of your plugin');
  this.files.publicClass.rm('* @TODO - Rename "' + this.pluginSlug + '" to the name of your plugin' + "\n     ");

  //Assets - JS/CSS
  if (this.publicResources.length === 0) {
    this.files.publicClass.rm("\n\n// Load public-facing style sheet and JavaScript.");
  }
  if (this.publicResources.indexOf('JS') === -1) {
    this.files.publicClass.rm("\nadd_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );");
    this.files.publicClass.rm("\n\n/**\n * Register and enqueues public-facing JavaScript files.\n *\n * @since    " + this.pluginVersion + "\n */\npublic function enqueue_scripts() {\nwp_enqueue_script( $this->plugin_slug . '-plugin-script', plugins_url( 'assets/js/public.js', __FILE__ ), array( 'jquery' ), self::VERSION );\n}");
  }
  if (this.publicResources.indexOf('CSS') === -1) {
    this.files.publicClass.rm("\nadd_action( 'wp_enqueue_scripts', array( $this, 'enqueue_styles' ) );");
    this.files.publicClass.rm("\n\n/**\n * Register and enqueue public-facing style sheet.\n *\n * @since    " + this.pluginVersion + "\n */\npublic function enqueue_styles() {\nwp_enqueue_style( $this->plugin_slug . '-plugin-styles', plugins_url( 'assets/css/public.css', __FILE__ ), array(), self::VERSION );\n}");
  }

  //Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.publicClass.rmsearch('// Activate plugin when new blog is added', "add_action( 'wpmu_new_blog', array( $this, 'activate_new_site' ) );", 1, 1);
    this.files.publicClass.rmsearch('* Fired when the plugin is activated.', '', 1, 32);
    this.files.publicClass.rmsearch('* Fired when a new site is activated with a WPMU environment.', '', 1, 16);
    this.files.publicClass.rmsearch('* Get all blog ids of blogs in the current network that are:', 'return $wpdb->get_col( $sql );', 1, -2);
    this.files.publicClass.rmsearch("* Fired for each blog when the plugin is activated.", '', 1, 33);
    if (verbose) {
      console.log(('Removed Activate Method').italic);
    }
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.publicClass.rmsearch('* Fired when the plugin is deactivated.', '', 1, 32);
    this.files.publicClass.rmsearch('* Fired for each blog when the plugin is deactivated.', '', 1, 10);
    if (verbose) {
      console.log(('Removed Deactive Method').italic);
    }
  }

  //Repo
  if (this.modules.indexOf('CPT_Core') === -1) {
    this.files.publicClass.rmsearch('// Create Custom Post Type https://github.com/jtsternberg/CPT_Core/blob/master/README.md', "'map_meta_cap' => true", 0, -3);
  }
  if (this.modules.indexOf('Taxonomy_Core') === -1) {
    this.files.publicClass.rmsearch('// Create Custom Taxonomy https://github.com/jtsternberg/Taxonomy_Core/blob/master/README.md', "), array( 'demo' )", 0, -2);
  }

  //Function
  if (this.modules.indexOf('Template system (like WooCommerce)') === -1) {
    this.files.publicClass.rm('//Override the template hierarchy for load /templates/content-demo.php');
    this.files.publicClass.rm("add_filter( 'template_include', array( $this, 'load_content_demo' ) );");
    this.files.publicClass.rmsearch('* Example for override the template system on the frontend', 'return $original_template;', 1, -3);
  }
  if (this.modules.indexOf('Requirements system on activation') === -1) {
    fs.unlink(this.pluginSlug + '/public/includes/requirements.php');
    fs.unlink(this.pluginSlug + '/languages/requirements.pot');
    this.files.publicClass.rmsearch('//Requirements Detection System - read the doc in the library file', "'WP' => new WordPress_Requirement( '3.9.0' ),", -1, -2);
  }
  //Snippet
  if (this.snippet.indexOf('Custom action') === -1 && this.snippet.indexOf('Custom filter') === -1 && this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.publicClass.rmsearch('* Define custom functionality.', '* Refer To http://codex.wordpress.org/Plugin_API#Hooks.2C_Actions_and_Filters', 1, -2);
  }
  if (this.snippet.indexOf('Custom action') === -1) {
    this.files.publicClass.rm("add_action( '@TODO', array( $this, 'action_method_name' ) );");
    this.files.publicClass.rmsearch('* NOTE:  Actions are points in the execution of a page or process', '// @TODO: Define your action hook callback here', 1, -2);
  }
  if (this.snippet.indexOf('Custom filter') === -1) {
    this.files.publicClass.rm("add_filter( '@TODO', array( $this, 'filter_method_name' ) );");
    this.files.publicClass.rmsearch('* NOTE:  Filters are points of execution in which WordPress modifies data', '// @TODO: Define your filter hook callback here', 1, -2);
  }
  if (this.snippet.indexOf('Custom shortcode') === -1) {
    this.files.publicClass.rm("add_shortcode( '@TODO', array( $this, 'shortcode_method_name' ) );");
    this.files.publicClass.rmsearch('* NOTE:  Shortcode simple set of functions for creating macro codes for use', '// @TODO: Define your shortcode here', 1, -2);
  }
  if (this.snippet.indexOf('Javascript DOM-based Routing') === -1) {
    this.files.publicjs.rmsearch('* DOM-based Routing', '$(document).ready(UTIL.loadEvents);', 1, -1);
  }
  if (this.snippet.indexOf('Capability system') === -1) {
    this.files.publicClass.rmsearch('* Array of capabilities by roles', '* Initialize the plugin by setting localization and loading public scripts', 1, 2);
    this.files.publicClass.rmsearch('// @TODO: Define activation functionality here', '* Fired for each blog when the plugin is deactivated.', 2, 5);
    this.files.publicClass.rm("'edit_others_posts' => 'edit_other_demo',");
  }
  if (this.snippet.indexOf('Add body class') === -1) {
    this.files.publicClass.rmsearch('* Add class in the body on the frontend', 'return $classes;', 1, -2);
    this.files.publicClass.rm("add_filter( 'body_class', array( $this, 'add_pn_class' ), 10, 3 );".replace(/pn_/g, this.pluginName.match(/\b(\w)/g).join('').toLowerCase() + '_'));
  }
  if (this.snippet.indexOf('wp_localize_script for PHP var to JS') === -1) {
    this.files.publicClass.rm("add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_js_vars' ) );");
    this.files.publicClass.rmsearch('* Print the PHP var in the HTML of the frontend for access by JavaScript', "'alert' => __( 'Hey! You have clicked the button!', $this->get_plugin_slug() )", 1, -4);
    this.files.publicjs.rm('// Write in console log the PHP value passed in enqueue_js_vars in public/class-' + this.pluginSlug + '.php' + "\n");
    this.files.publicjs.rm('console.log( tp_js_vars.alert );' + "\n");
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
    this.files.uninstall.add('global $wpdb, $wp_roles;', 'global $wpdb;');
    this.files.uninstall.rmsearch('$plugin_roles = array(', 'if ( is_multisite() ) {', -1, 0);
    this.files.uninstall.rmsearch("switch_to_blog( $blog[ 'blog_id' ] );", 'restore_current_blog();', -19, 0);
    this.files.uninstall.rmsearch('} else {', '$wp_roles->remove_cap( $cap );', -19, -4);
  }
};
  