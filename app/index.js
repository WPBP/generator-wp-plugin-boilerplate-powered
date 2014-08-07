'use strict';

var util = require('util');
var path = require('path');
var yeoman = require('yeoman-generator');
var fs = require('fs');
var request = require('request');
var admzip = require('adm-zip');
var rmdir = require('rimraf');
var _s = require('underscore.string');
var sys = require('sys');
var spawn = require('child_process').spawn;
var colors = require('colors');
var Replacer = require('./replacer');
var version = 'master';

function cleanFolder(path) {
  var default_file = [
    'CONTRIBUTING.md', 'readme.md', 'phpunit.xml', 'packages.json', 'package.json',
    'Gruntfile.js', 'README.md', 'example-functions.php', 'bower.json',
    '.travis.yml', '.bowerrc', '.gitignore', 'README.txt'
  ];
  var default_folder = ['tests'];

  default_file.forEach(function(element, index, array) {
    fs.exists('./' + path + '/' + element, function(exists) {
      if (exists) {
        fs.unlink(path + '/' + element);
      }
    });
  });

  default_folder.forEach(function(element, index, array) {
    fs.stat('./' + path + '/' + element, function(error, stats) {
      if (!error) {
        rmdir('./' + path + '/' + element, function(err) {
          if (error) {
            console.log(error);
          }
        });
      }
    });
  });

  fs.exists('./' + path + '/index.php', function(exists) {
    if (!exists) {
      fs.writeFile('./' + path + '/index.php',
              "<?php // Silence is golden",
              'utf8', function() {
              });
    }
  });
}
var WpPluginBoilerplateGenerator = module.exports = function WpPluginBoilerplateGenerator(args, options, config) {
  var self = this,
          default_file;

  yeoman.generators.Base.apply(this, arguments);

  this.on('end', function() {

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
      'rm $0'
    ].join('\n');

    fs.writeFile(self.pluginSlug + '/submodules.sh', submodulessh, 'utf8',
            function(err) {
              if (err) {
                return console.log(err);
              } else {
                fs.chmodSync(process.cwd() + '/' + self.pluginSlug + '/submodules.sh', '0777');
                console.log(('Generate git config on the fly').white);
                console.log(('Download submodules').white);
                var submodule = spawn('./submodules.sh', [], {cwd: process.cwd() + '/' + self.pluginSlug + '/'});
                submodule.stdout.on('data',
                        function(data) {
                          console.log(data.toString());
                        });
                submodule.on('close',
                        function(code) {
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

                          if (self.modules.indexOf('Custom Metaboxes and Fields for WordPress') !== -1) {
                            cleanFolder(self.pluginSlug + '/admin/includes/CMBF');
                            cleanFolder(self.pluginSlug + '/admin/includes/CMBF-Select2');
                          }

                          if (self.modules.indexOf('HM Custom Meta Boxes for WordPress') !== -1) {
                            cleanFolder(self.pluginSlug + '/admin/includes/CMB');
                          }
                          
                          if (self.modules.indexOf('Template system (like WooCommerce)') !== -1) {
                            cleanFolder(self.pluginSlug + '/templates');
                          }

                          console.log(('Inserted index.php files in all the folders').white);

                          var key = null;
                          for (key in self.files) {
                            if (self.files.hasOwnProperty(key)) {
                              self.files[key].sed();
                            }
                          }
                          
                          console.log(('Parsed all the files').white);
                          console.log(('All done!').white);
                        });
              }
            }
    );

  });

// have Yeoman greet the user.
  console.log(this.yeoman);

  if (fs.existsSync(__dirname + '/../default-values.json')) {
    default_file = path.join(__dirname, '../default-values.json');
  } else if (fs.existsSync(process.cwd() + '/default-values.json')) {
    default_file = process.cwd() + '/default-values.json';
  } else {
    console.log('--------------------------');
    console.log(('You should create the file ' + process.cwd() + '/default-values.json with default values in the parent folder! Use the default-values-example.json as a template.').white);
    console.log('--------------------------');
    default_file = path.join(__dirname, '../default-values-example.json');
  }
  this.defaultValues = JSON.parse(this.readFileAsString(default_file));
};

util.inherits(WpPluginBoilerplateGenerator, yeoman.generators.Base);

WpPluginBoilerplateGenerator.prototype.askFor = function askFor() {
  var cb = this.async(),
          prompts = [];

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
        {name: 'CPT_Core', checked: false},
        {name: 'Taxonomy_Core', checked: false},
        {name: 'Widget-Boilerplate', checked: false},
        {name: 'HM Custom Meta Boxes for WordPress', checked: false},
        {name: 'Custom Metaboxes and Fields for WordPress', checked: false},
        {name: 'Fake Page Class', checked: true},
        {name: 'Template system (like WooCommerce)', checked: true},
        {name: 'Language function support (WPML/Ceceppa Multilingua/Polylang)', checked: true}]
    }, {
      type: 'checkbox',
      name: 'snippet',
      message: 'Which snippet your plugin needs?',
      choices: [
        {name: 'Support Dashboard At Glance Widget', checked: true},
        {name: 'Javascript DOM-based Routing', checked: true},
        {name: 'Bubble notification on cpt', checked: true},
        {name: 'Import/Export settings system', checked: true},
        {name: 'Capability system', checked: true},
        {name: 'Debug system (Debug Bar support)', checked: true},
        {name: 'Add body class', checked: false}
      ]
    }, {
      type: 'confirm',
      name: 'git',
      message: 'Do you need an initialized git repo?'
    }];

  this.prompt(prompts, function(props) {
    this.pluginName = props.name;
    this.pluginSlug = _s.slugify(props.name);
    this.pluginClassName = _s.titleize(props.name).replace(/ /g, "_");
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

    // Set the path of the files
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
      publicjs: new Replacer(this.pluginSlug + '/public/assets/js/public.js', this)
    };

    cb();
  }.bind(this));
};

WpPluginBoilerplateGenerator.prototype.download = function download() {
  var cb = this.async(),
          self = this,
          path = 'http://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/archive/' + version + '.zip',
          zip = "";

  if (fs.existsSync(process.cwd() + '/plugin.zip')) {
    console.log(('Extract Plugin boilerplate').white);
    zip = new admzip('./plugin.zip');
    zip.extractAllTo('plugin_temp', true);
    fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/.gitmodules', './plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/.gitmodules');
    fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function() {
      rmdir('plugin_temp', function(error) {
        if (error) {
          console.log(error);
        }
        cb();
      });
    });
  } else {
    console.log(('Downloading the WP Plugin Boilerplate Powered...').white);

    if (version === 'master') {
      path = 'https://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered/archive/master.zip';
    }

    request(path)
            .pipe(fs.createWriteStream('plugin.zip'))
            .on('close', function() {
              zip = new admzip('./plugin.zip');
              console.log(('File downloaded').white);
              zip.extractAllTo('plugin_temp', true);
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/.gitmodules', './plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/.gitmodules');
              fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function() {
                rmdir('plugin_temp', function(error) {
                  if (error) {
                    console.log(error);
                  }
                  cb();
                });
              });
              fs.unlink('plugin.zip');
            });
  }
};

WpPluginBoilerplateGenerator.prototype.setFiles = function setName() {
  // Change path of gitmodules
  this.files.gitmodules.add(new RegExp(this.pluginSlug + '/', "g"), '');

  // Rename files
  fs.rename(this.pluginSlug + '/plugin-name.php', this.files.primary.file);
  fs.rename(this.pluginSlug + '/admin/class-plugin-name-admin.php', this.files.adminClass.file);
  fs.rename(this.pluginSlug + '/public/class-plugin-name.php', this.files.publicClass.file);
  fs.rename(this.pluginSlug + '/languages/plugin-name.pot', this.pluginSlug + '/languages/' + this.pluginSlug + '.pot');
};

WpPluginBoilerplateGenerator.prototype.setPrimary = function setName() {
  this.files.primary.add(/Plugin Name:( {7})@TODO/g, 'Plugin Name:       ' + this.pluginName);
  this.files.primary.add(/Version:( {11})1\.0\.0/g, 'Version:           ' + this.pluginVersion);
  this.files.primary.add(/Author:( {12})@TODO/g, 'Author:            ' + this.author);
  this.files.primary.add(/Author URI:( {8})@TODO/g, 'Author URI:        ' + this.authorURI);
  this.files.primary.rm("/*\n * @TODO:\n *\n * - replace `class-" + this.pluginSlug + ".php` with the name of the plugin's class file\n *\n */\n");
  this.files.primary.rm(" *\n * @TODO:\n *\n * - replace " + this.pluginClassName + " with the name of the class defined in\n *   `class-" + this.pluginSlug + ".php`\n");
  this.files.primary.rm("/*\n * @TODO:\n *\n * - replace " + this.pluginClassName + " with the name of the class defined in\n *   `class-" + this.pluginSlug + ".php`\n */");
  this.files.primary.rm(" * @TODO:\n *\n * - replace `class-plugin-admin.php` with the name of the plugin's admin file\n * - replace " + this.pluginClassName + "Admin with the name of the class defined in\n *   `class-" + this.pluginSlug + "-admin.php`\n *\n");

  // Activate/desactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1 && this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.rm("\n/*\n * Register hooks that are fired when the plugin is activated or deactivated.\n * When the plugin is deleted, the uninstall.php file is loaded.\n */\nregister_activation_hook( __FILE__, array( '" + this.pluginClassName + "', 'activate' ) );\nregister_deactivation_hook( __FILE__, array( '" + this.pluginClassName + "', 'deactivate' ) );\n");
  }
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.primary.rm("\nregister_activation_hook( __FILE__, array( '" + this.pluginClassName + "', 'activate' ) );");
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.primary.rm("\nregister_deactivation_hook( __FILE__, array( '" + this.pluginClassName + "', 'deactivate' ) );");
  }
  //repo
  if (this.modules.indexOf('CPT_Core') === -1 && this.modules.indexOf('Taxonomy_Core') === -1) {
    this.files.primary.rm("\n/*\n * Load library for simple and fast creation of Taxonomy and Custom Post Type\n *\n */");
  }
  if (this.modules.indexOf('CPT_Core') === -1) {
    rmdir(this.pluginSlug + '/includes/CPT_Core', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.primary.rm("require_once( plugin_dir_path( __FILE__ ) . 'includes/CPT_Core/CPT_Core.php' );\n");
    this.files.primary.rm("and Custom Post Type");
    this.files.publicClass.rmsearch('// Create Custom Post Type https://github.com/jtsternberg/CPT_Core/blob/master/README.md', "'map_meta_cap' => true", 0, -3);
  }
  if (this.modules.indexOf('Taxonomy_Core') === -1) {
    rmdir(this.pluginSlug + '/includes/Taxonomy_Core', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.primary.rm("require_once( plugin_dir_path( __FILE__ ) . 'includes/Taxonomy_Core/Taxonomy_Core.php' );\n");
    this.files.primary.rm("Taxonomy and");
    this.files.publicClass.rmsearch('// Create Custom Taxonomy https://github.com/jtsternberg/Taxonomy_Core/blob/master/README.md', "), array( 'demo' )", 0, -2);
  }
  if (this.modules.indexOf('Widget-Boilerplate') === -1) {
    rmdir(this.pluginSlug + '/includes/Widget-Boilerplate', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.primary.rm("\n/*\n * Load Widget boilerplate\n */\nrequire_once( plugin_dir_path( __FILE__ ) . 'includes/Widget-Boilerplate/widget-boilerplate/plugin.php' );\n");
  }
  //Function
  if (this.modules.indexOf('Fake Page Class') === -1) {
    fs.unlink(this.pluginSlug + '/includes/fake-page.php');
    this.files.primary.rm("\n/*\n * Load Fake Page class\n */\nrequire_once( plugin_dir_path( __FILE__ ) . 'includes/fake-page.php' );\n");
    this.files.primary.rm("\nnew Fake_Page(\n\t\tarray(\n\t'slug' => 'fake_slug',\n\t'post_title' => 'Fake Page Title',\n\t'post content' => 'This is the fake page content'\n\t\t)\n);\n");
  }
  if (this.modules.indexOf('Template system (like WooCommerce)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/template.php');
    rmdir(this.pluginSlug + '/templates', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.publicClass.rmsearch('* Example for override the template system on the frontend', 'return $original_template;', 1, -2);
    this.files.publicClass.rm('//Override the template hierachy for load /templates/content-demo.php');
    this.files.publicClass.rm("add_filter( 'template_include', array( $this, 'load_content_demo' ) );");
    this.files.primary.rm("\n/*\n * Load template system\n */\nrequire_once( plugin_dir_path( __FILE__ ) . 'includes/template.php' );\n");
  }
  if (this.modules.indexOf('Language function support (WPML/Ceceppa Multilingua/Polylang)') === -1) {
    fs.unlink(this.pluginSlug + '/includes/language.php');
    this.files.primary.rm("\n/*\n * Load Language wrapper function for WPML/Ceceppa Multilingua/Polylang\n */\nrequire_once( plugin_dir_path( __FILE__ ) . 'includes/language.php' );\n");
  }
  if (this.snippet.indexOf('Javascript DOM-based Routing') === -1) {
    this.files.publicjs.rmsearch('* DOM-based Routing', '$(document).ready(UTIL.loadEvents);', 1, 1);
  }
  if (this.git === false) {
    fs.unlink(this.pluginSlug + '.gitmodules');
    rmdir(this.pluginSlug + '/.git', function(error) {
      if (error) {
        console.log(error);
      }
    });
    console.log('Remove git config generated');
  }
};

WpPluginBoilerplateGenerator.prototype.setAdminClass = function setAdminClass() {
  this.files.adminClass.rm(" * @TODO: Rename this class to a proper name for your plugin.\n *\n");
  this.files.adminClass.rm("\t\t/*\n\t\t * Call $plugin_slug from public plugin class.\n\t\t *\n\t\t * @TODO:\n\t\t *\n\t\t * - Rename \"" + this.pluginClassName + "\" to the name of your initial plugin class\n\t\t *\n\t\t */\n");
  this.files.adminClass.rm(new RegExp("\\* \\@TODO:\\n\\t \\*\\n\\t \\* - Rename \"" + this.pluginClassName + "\" to the name your plugin\\n\\t \\*\\n\\t ", "g"));

  //Repo
  if (this.modules.indexOf('Custom Metaboxes and Fields for WordPress') === -1 && this.modules.indexOf('HM Custom Meta Boxes for WordPress') === -1) {
    this.files.adminClass.rmsearch("add_filter( 'plugin_action_links_' . $plugin_basename, array( $this, 'add_action_links' ) );", "add_filter( 'cmb_meta_boxes', array( $this, 'cmb_demo_metaboxes' ) );", -1, 0);
    this.files.adminClass.rmsearch("* NOTE:     Your metabox on Demo CPT", "return $meta_boxes;", 1, -3);
  }
  if (this.modules.indexOf('Custom Metaboxes and Fields for WordPress') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/CMBF', function(error) {
      if (error) {
        console.log(error);
      }
    });
    rmdir(this.pluginSlug + '/admin/includes/CMBF-Select2', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.adminClass.rm("$settings[ 1 ] = get_option( $this->plugin_slug . '-settings-second' );");
    this.files.adminClass.rm("update_option( $this->plugin_slug . '-settings-second', get_object_vars( $settings[ 1 ] ) );");
    this.files.adminView.rmsearch("//Required for multi CMB form", "jQuery('.cmb-form #wp_meta_box_nonce').appendTo('.cmb-form');", 1, -4);
    this.files.adminView.rmsearch('<div id="tabs-1">', "cmb_metabox_form( $option_fields, $this->plugin_slug . '-settings' );", -2, -2);
    this.files.adminView.rmsearch('<div id="tabs-2">', "cmb_metabox_form( $option_fields_second, $this->plugin_slug . '-settings-second' );", -2, -2);

    if (this.modules.indexOf('HM Custom Meta Boxes for WordPress') !== -1) {
      this.files.adminClass.rmsearch("* Choose the Custom Meta Box Library and remove the other", "* Custom meta Boxes by HumanMade | PS: include natively Select2 for select box", 0, 0);
      this.files.adminClass.rmsearch("*  Custom Metabox and Fields for Wordpress", "add_filter( 'cmb_meta_boxes', array( $this, 'cmb_demo_metaboxes' ) );", 0, 4);
      this.files.adminClass.add('https://github.com/humanmade/Custom-Meta-Boxes/', 'https://github.com/humanmade/Custom-Meta-Boxes/	*/' + "\n");
    }
  }
  if (this.modules.indexOf('HM Custom Meta Boxes for WordPress') === -1) {
    rmdir(this.pluginSlug + '/admin/includes/CMB', function(error) {
      if (error) {
        console.log(error);
      }
    });
    this.files.adminClass.rmsearch("* Choose the Custom Meta Box Library and remove the other", "*  Custom Metabox and Fields for Wordpress", 0, 0);
    this.files.adminClass.rmsearch("*  Custom meta Boxes by HumanMade | PS: include natively Select2 for select box", "require_once( plugin_dir_path( __FILE__ ) . 'includes/CMB/custom-meta-boxes.php' );", -1, 1);
  }
  //Snippet
  if (this.adminPage === false) {
    this.files.adminClass.rm("\n\t\t// Add an action link pointing to the options page.\n\t\t$plugin_basename = plugin_basename( plugin_dir_path( __DIR__ ) . $this->plugin_slug . '.php' );\n\t\tadd_filter( 'plugin_action_links_' . $plugin_basename, array( $this, 'add_action_links' ) );");
    this.files.adminClass.rm("\n\n\t\t// Load admin style sheet and JavaScript.\n\t\tadd_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_styles' ) );\n\t\tadd_action( 'admin_enqueue_scripts', array( $this, 'enqueue_admin_scripts' ) );\n\n\t\t// Add the options page and menu item.\n\t\tadd_action( 'admin_menu', array( $this, 'add_plugin_admin_menu' ) );");
    this.files.adminClass.rm("\n\t/**\n\t * Register and enqueue admin-specific style sheet.\n\t *\n\t * @since     1.0.0\n\t *\n\t * @return    null    Return early if no settings page is registered.\n\t */\n\tpublic function enqueue_admin_styles() {\n\n\t\tif ( ! isset( $this->plugin_screen_hook_suffix ) ) {\n\t\t\treturn;\n\t\t}\n\n\t\t$screen = get_current_screen();\n\t\tif ( $this->plugin_screen_hook_suffix == $screen->id ) {\n\t\t\twp_enqueue_style( $this->plugin_slug .'-admin-styles', plugins_url( 'assets/css/admin.css', __FILE__ ), array(), MyNewPlugin::VERSION );\n\t\t}\n\n\t}\n\n\t/**\n\t * Register and enqueue admin-specific JavaScript.\n\t *\n\t * @since     1.0.0\n\t *\n\t * @return    null    Return early if no settings page is registered.\n\t */\n\tpublic function enqueue_admin_scripts() {\n\n\t\tif ( ! isset( $this->plugin_screen_hook_suffix ) ) {\n\t\t\treturn;\n\t\t}\n\n\t\t$screen = get_current_screen();\n\t\tif ( $this->plugin_screen_hook_suffix == $screen->id ) {\n\t\t\twp_enqueue_script( $this->plugin_slug . '-admin-script', plugins_url( 'assets/js/admin.js', __FILE__ ), array( 'jquery' ), MyNewPlugin::VERSION );\n\t\t}\n\n\t}\n\n\t/**\n\t * Register the administration menu for this plugin into the WordPress Dashboard menu.\n\t *\n\t * @since    1.0.0\n\t */\n\tpublic function add_plugin_admin_menu() {\n\n\t\t/*\n\t\t * Add a settings page for this plugin to the Settings menu.\n\t\t *\n\t\t * NOTE:  Alternative menu locations are available via WordPress administration menu functions.\n\t\t *\n\t\t *        Administration Menus: http://codex.wordpress.org/Administration_Menus\n\t\t *\n\t\t * @TODO:\n\t\t *\n\t\t * - Change 'Page Title' to the title of your plugin admin page\n\t\t * - Change 'Menu Text' to the text for menu item for the plugin settings page\n\t\t * - Change 'manage_options' to the capability you see fit\n\t\t *   For reference: http://codex.wordpress.org/Roles_and_Capabilities\n\t\t */\n\t\t$this->plugin_screen_hook_suffix = add_options_page(\n\t\t\t__( 'Page Title', $this->plugin_slug ),\n\t\t\t__( 'Menu Text', $this->plugin_slug ),\n\t\t\t'manage_options',\n\t\t\t$this->plugin_slug,\n\t\t\tarray( $this, 'display_plugin_admin_page' )\n\t\t);\n\n\t}\n\n\t/**\n\t * Render the settings page for this plugin.\n\t *\n\t * @since    1.0.0\n\t */\n\tpublic function display_plugin_admin_page() {\n\t\tinclude_once( 'views/admin.php' );\n\t}\n\n\t/**\n\t * Add settings action link to the plugins page.\n\t *\n\t * @since    1.0.0\n\t */\n\tpublic function add_action_links( $links ) {\n\n\t\treturn array_merge(\n\t\t\tarray(\n\t\t\t\t'settings' => '<a href=\"' . admin_url( 'options-general.php?page=' . $this->plugin_slug ) . '\">' . __( 'Settings', $this->plugin_slug ) . '</a>'\n\t\t\t),\n\t\t\t$links\n\t\t);\n\n\t}");
  } else {
    if (this.snippet.indexOf('Support Dashboard At Glance Widget') === -1) {
      this.files.adminClass.rm("\n\t\t// At Glance Dashboard widget for your cpts\n\t\tadd_filter( 'dashboard_glance_items', array( $this, 'cpt_dashboard_support' ), 10, 1 );\n");
      this.files.adminClass.rmsearch('* Add the counter of your CPTs in At Glance widget in the dashboard<br>', '* NOTE:     Your metabox on Demo CPT', 1, 1);
      this.files.adminCss.rmsearch('#dashboard_right_now a.demo-count:before {', '', 0, 3);
    }
  }
  if (this.snippet.indexOf('Bubble notification on cpt') === -1) {
    this.files.adminClass.rmsearch("* Bubble Notification for pending cpt<br>", "if ( $needle === $value OR ( is_array( $value ) && self::recursive_array_search_php( $needle, $value ) !== false) ) {", 1, -5);
  }
  if (this.snippet.indexOf('Import/Export settings system') === -1) {
    this.files.adminClass.rmsearch("function settings_export() {", "wp_safe_redirect( admin_url( 'options-general.php?page=' . $this->plugin_slug ) );", 1, -3);
    this.files.adminView.rmsearch('<div id="tabs-3">', "<?php submit_button( __( 'Import' ), 'secondary', 'submit', false ); ?>", -2, -5);
  }
  if (this.snippet.indexOf('Debug system (Debug Bar support)') === -1) {
    this.files.adminClass.rmsearch("* Debug mode", "$debug->log( __( 'Plugin Loaded', $this->plugin_slug ) );", 1, -1);
  }
  if (this.snippet.indexOf('Capability system') === -1) {
    this.files.publicClass.rmsearch('* Array of capabilities by roles', '* Initialize the plugin by setting localization and loading public scripts', 1, 2);
    this.files.publicClass.rmsearch('// @TODO: Define activation functionality here', '* Fired for each blog when the plugin is deactivated.', 1, 1);
    this.files.publicClass.rm("'edit_others_posts' => 'edit_other_demo',");
  }
  if (this.snippet.indexOf('Add body class') === -1) {
    this.files.publicClass.rmsearch('* Add class in the body on the frontend', 'return $classes;', 1, -1);
    this.files.publicClass.rm("add_filter( 'body_class', array( $this, 'add_pn_class' ), 10, 3 );".replace(/pn_/g, this.pluginName.match(/\b(\w)/g).join('').toLowerCase() + '_'));
  }
};

WpPluginBoilerplateGenerator.prototype.setPublicClass = function setPublicClass() {
  var regexp;
  this.files.publicClass.rm("* @TODO: Rename this class to a proper name for your plugin.\n *\n ");
  regexp = new RegExp("\\* \\@TODO - Rename \"" + this.pluginSlug + "\" to the name your your plugin\\n\\t \\*\\n\\t ", "g");
  this.files.publicClass.rm(regexp);

  // Assets - JS/CSS
  if (this.publicResources.length === 0) {
    this.files.publicClass.rm("\n\n\t\t// Load public-facing style sheet and JavaScript.");
  }
  if (this.publicResources.indexOf('JS') === -1) {
    this.files.publicClass.rm("\n\t\tadd_action( 'wp_enqueue_scripts', array( $this, 'enqueue_scripts' ) );");
    this.files.publicClass.rm("\n\n\t/**\n\t * Register and enqueues public-facing JavaScript files.\n\t *\n\t * @since    " + this.pluginVersion + "\n\t */\n\tpublic function enqueue_scripts() {\n\t\twp_enqueue_script( $this->plugin_slug . '-plugin-script', plugins_url( 'assets/js/public.js', __FILE__ ), array( 'jquery' ), self::VERSION );\n\t}");
  }
  if (this.publicResources.indexOf('CSS') === -1) {
    this.files.publicClass.rm("\n\t\tadd_action( 'wp_enqueue_scripts', array( $this, 'enqueue_styles' ) );");
    this.files.publicClass.rm("\n\n\t/**\n\t * Register and enqueue public-facing style sheet.\n\t *\n\t * @since    " + this.pluginVersion + "\n\t */\n\tpublic function enqueue_styles() {\n\t\twp_enqueue_style( $this->plugin_slug . '-plugin-styles', plugins_url( 'assets/css/public.css', __FILE__ ), array(), self::VERSION );\n\t}");
  }

  // Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate Method') === -1) {
    this.files.publicClass.rm("\n\t\t// Activate plugin when new blog is added\n\t\tadd_action( 'wpmu_new_blog', array( $this, 'activate_new_site' ) );\n");
    this.files.publicClass.rm("\n\t/**\n\t * Fired when the plugin is activated.\n\t *\n\t * @since    1.0.0\n\t *\n\t * @param    boolean    $network_wide    True if WPMU superadmin uses\n\t *                                       \"Network Activate\" action, false if\n\t *                                       WPMU is disabled or plugin is\n\t *                                       activated on an individual blog.\n\t */\n\tpublic static function activate( $network_wide ) {\n\n\t\tif ( function_exists( 'is_multisite' ) && is_multisite() ) {\n\n\t\t\tif ( $network_wide  ) {\n\n\t\t\t\t// Get all blog ids\n\t\t\t\t$blog_ids = self::get_blog_ids();\n\n\t\t\t\tforeach ( $blog_ids as $blog_id ) {\n\n\t\t\t\t\tswitch_to_blog( $blog_id );\n\t\t\t\t\tself::single_activate();\n\t\t\t\t}\n\n\t\t\t\trestore_current_blog();\n\n\t\t\t} else {\n\t\t\t\tself::single_activate();\n\t\t\t}\n\n\t\t} else {\n\t\t\tself::single_activate();\n\t\t}\n\n\t}\n");
    this.files.publicClass.rm("\n\t/**\n\t * Fired when a new site is activated with a WPMU environment.\n\t *\n\t * @since    1.0.0\n\t *\n\t * @param    int    $blog_id    ID of the new blog.\n\t */\n\tpublic function activate_new_site( $blog_id ) {\n\n\t\tif ( 1 !== did_action( 'wpmu_new_blog' ) ) {\n\t\t\treturn;\n\t\t}\n\n\t\tswitch_to_blog( $blog_id );\n\t\tself::single_activate();\n\t\trestore_current_blog();\n\n\t}\n");
    this.files.publicClass.rm("\n\t/**\n\t * Get all blog ids of blogs in the current network that are:\n\t * - not archived\n\t * - not spam\n\t * - not deleted\n\t *\n\t * @since    1.0.0\n\t *\n\t * @return   array|false    The blog ids, false if no matches.\n\t */\n\tprivate static function get_blog_ids() {\n\n\t\tglobal $wpdb;\n\n\t\t// get an array of blog ids\n\t\t$sql = \"SELECT blog_id FROM $wpdb->blogs\n\t\t\tWHERE archived = '0' AND spam = '0'\n\t\t\tAND deleted = '0'\";\n\n\t\treturn $wpdb->get_col( $sql );\n\n\t}\n");
    this.files.publicClass.rm("\n\t/**\n\t * Fired for each blog when the plugin is activated.\n\t *\n\t * @since    1.0.0\n\t */\n\tprivate static function single_activate() {\n\t\t// @TODO: Define activation functionality here\n\t}\n");
  }
  if (this.activateDeactivate.indexOf('Deactivate Method') === -1) {
    this.files.publicClass.rm("\n\t/**\n\t * Fired when the plugin is deactivated.\n\t *\n\t * @since    1.0.0\n\t *\n\t * @param    boolean    $network_wide    True if WPMU superadmin uses\n\t *                                       \"Network Deactivate\" action, false if\n\t *                                       WPMU is disabled or plugin is\n\t *                                       deactivated on an individual blog.\n\t */\n\tpublic static function deactivate( $network_wide ) {\n\n\t\tif ( function_exists( 'is_multisite' ) && is_multisite() ) {\n\n\t\t\tif ( $network_wide ) {\n\n\t\t\t\t// Get all blog ids\n\t\t\t\t$blog_ids = self::get_blog_ids();\n\n\t\t\t\tforeach ( $blog_ids as $blog_id ) {\n\n\t\t\t\t\tswitch_to_blog( $blog_id );\n\t\t\t\t\tself::single_deactivate();\n\n\t\t\t\t}\n\n\t\t\t\trestore_current_blog();\n\n\t\t\t} else {\n\t\t\t\tself::single_deactivate();\n\t\t\t}\n\n\t\t} else {\n\t\t\tself::single_deactivate();\n\t\t}\n\n\t}\n\n\t/**\n\t * Fired for each blog when the plugin is deactivated.\n\t *\n\t * @since    1.0.0\n\t */\n\tprivate static function single_deactivate() {\n\t\t// @TODO: Define deactivation functionality here\n\t}\n");
  }
};

WpPluginBoilerplateGenerator.prototype.setReadme = function setReadme() {
  this.files.readme.add('@TODO: Plugin Name', this.pluginName);
};

WpPluginBoilerplateGenerator.prototype.setUninstall = function setUninstall() {
  if (this.activateDeactivate.indexOf('Uninstall File') === -1) {
    fs.unlink(this.files.uninstall.file);
    delete this.files.uninstall;
  } else if(this.snippet.indexOf('Capability system') === -1) {
    this.files.uninstall.add('global $wpdb, $wp_roles;','global $wpdb;');
    this.files.uninstall.rmsearch('$plugin_roles = array(', 'if ( is_multisite() ) {', -1, 0);
    this.files.uninstall.rmsearch("switch_to_blog( $blog[ 'blog_id' ] );", 'restore_current_blog();', -19, 0);
    this.files.uninstall.rmsearch('} else {', '$wp_roles->remove_cap( $cap );', -19, -4);
  }
};
