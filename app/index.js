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
var execSync = require('sync-exec');
var Replacer = require('./replacer');
require('colors');
var args = process.argv.slice(2);
var version = '2.0.0';
var isDefault = false;
var verbose = false;
var os = require('os');
if (args[1] === 'dev') {
  version = 'master';
}
if (args[1] === 'verbose' || args[2] === 'verbose') {
  verbose = true;
}

/*
 * Delete folders
 * 
 * @param string path
 */
function deleteFolder(path) {
  if (verbose) {
	console.log(('Removed folder ' + path).yellow);
  }
  rmdir(path, function (error) {
	if (error) {
	  console.log((error).red);
	}
  });
}

var WpPluginBoilerplateGenerator = module.exports = function WpPluginBoilerplateGenerator(args, options, config) {
  var self = this,
		  defaultFile;

  yeoman.Base.apply(this, arguments);

  this.on('end', function () {
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
	execSync('composer update');

	//Console.log are cool and bowtie are cool!
	console.log(('All done!').white);

  });

  //Check the default file for the default values, I have already said default?
  if (fs.existsSync(__dirname + '/../default-values.json')) {
	defaultFile = path.join(__dirname, '../default-values.json');
	if (verbose) {
	  console.log(('Config loaded').yellow);
	}
  } else if (fs.existsSync(process.cwd() + '/default-values.json')) {
	defaultFile = process.cwd() + '/default-values.json';
	if (verbose) {
	  console.log(('Config loaded').yellow);
	}
  } else {
	console.log(yosay(('This tool can create ' + process.cwd() + '/default-values.json with default values in the parent folder! The next time the tool load all the settings for a fast development').bold));
	console.log(('Don\'t forget to check the wiki of the boilerplate: https://github.com/WPBP/WordPress-Plugin-Boilerplate-Powered/wiki').bold);
	console.log(('Add your public Plugins Free/Premium made it with WPBP on https://github.com/WPBP/WordPress-Plugin-Boilerplate-Powered/wiki/Plugin-made-with-this-Boilerplate!').bold.red);
	if (/^win/.test(os.platform())) {
	  console.log(('Not supported on Windows!').bold.red);
	  process.exit(1);
	} else if (os.platform() === 'darwin') {
	  console.log(('Mac OSX have 2 type of sed commands!').bold.red);
	  console.log(('brew install gnu-sed - Is the command to install a GNU version of sed compatible with Linux.').bold.red);
	  console.log(('That generator search first for gsed and after the native sed but sometimes the native version have problems.').bold.red);
	}
	defaultFile = path.join(__dirname, '../default-values-example.json');
	console.log('--------------------------');
	isDefault = true;
  }
  try {
	this.defaultValues = JSON.parse(fs.readFileSync(defaultFile));
  } catch (e) {
	console.log(('default-values.json is not a valid JSON file!').bold.red);
	process.exit(1);
  }
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
		{name: 'Activate/Deactivation Method', checked: true},
		{name: 'Uninstall Hook', checked: true}]
	}, {
	  type: 'confirm',
	  name: 'adminPage',
	  message: 'Does your plugin need an admin page?'
	}, {
	  type: 'checkbox',
	  name: 'modules',
	  message: 'Which library your plugin needs?',
	  choices: [
		{name: 'Freemius/wordpress-sdk', checked: false},
		{name: 'julien731/WP-Dismissible-Notices-Handler', checked: true},
		{name: 'julien731/WP-Review-Me', checked: false},
		{name: 'nathanielks/wp-admin-notice', checked: true},
		{name: 'origgami/CMB2-grid', checked: true},
		{name: 'voceconnect/wp-contextual-help', checked: true},
		{name: 'WebDevStudios/CMB2', checked: true},
		{name: 'WebDevStudios/CPT_Core', checked: true},
		{name: 'WebDevStudios/Taxonomy_Core', checked: true},
		{name: 'wpackagist-plugin/posts-to-posts', checked: false},
		{name: 'WPBP/CPT_Columns', checked: true},
		{name: 'WPBP/CronPlus', checked: false},
		{name: 'WPBP/Debug', checked: false},
		{name: 'WPBP/FakePage', checked: false},
		{name: 'WPBP/Language', checked: true},
		{name: 'WPBP/PointerPlus', checked: true},
		{name: 'WPBP/Requirements', checked: true},
		{name: 'WPBP/Template', checked: true},
		{name: 'WPBP/Widgets-Helper', checked: true}
	  ]
	}, {
	  type: 'checkbox',
	  name: 'snippet',
	  message: 'Which snippet your plugin needs?',
	  choices: [
		{name: 'Backend - Bubble Notification on pending CPT', checked: true},
		{name: 'Backend - Dashboard At Glance Widget', checked: true},
		{name: 'Backend - Dashboard Activity Widget', checked: true},
		{name: 'Backend - Donate link in plugins list', checked: false},
		{name: 'Backend - Import/Export settings system', checked: true},
		{name: 'Frontend - Add body class', checked: true},
		{name: 'Frontend - CPTs on search box', checked: true},
		{name: 'Frontend - Javascript DOM-based Routing', checked: false},
		{name: 'Frontend - wp_localize_script for PHP var to JS', checked: true},
		{name: 'System - Capability system', checked: true},
		{name: 'System - Custom action', checked: true},
		{name: 'System - Custom filter', checked: true},
		{name: 'System - Custom shortcode', checked: true},
		{name: 'System - Transient Example', checked: false}
	  ]
	}, {
	  type: 'confirm',
	  name: 'git',
	  message: 'Do you need an initialized git repo?'
	}, {
	  type: 'confirm',
	  name: 'coffeescript',
	  message: 'Do you need CoffeeScript?'
	}, {
	  type: 'confirm',
	  name: 'saveSettings',
	  message: 'Do you want save the configuration for reuse it?'
	}];

  if (isDefault === false) {
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
	}
	if (this.defaultValues.coffeescript !== '') {
	  prompts[12].default = this.defaultValues.coffeescript;
	}
	if (this.defaultValues.saveSettings !== '') {
	  prompts[12].default = this.defaultValues.saveSettings;
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
	  primary: new Replacer(this.pluginSlug + '/' + this.pluginClassName + '.php', this),
	  publicClass: new Replacer(this.pluginSlug + '/public/' + this.pluginClassName + '.php', this),
	  widgets: new Replacer(this.pluginSlug + '/public/widgets/sample.php', this),
	  adminClass: new Replacer(this.pluginSlug + '/admin/' + this.pluginClassName + '_Admin.php', this),
	  adminCss: new Replacer(this.pluginSlug + '/admin/assets/sass/admin.scss', this),
	  adminView: new Replacer(this.pluginSlug + '/admin/views/admin.php', this),
	  readme: new Replacer(this.pluginSlug + '/README.txt', this),
	  json: new Replacer(this.pluginSlug + '/composer.json', this),
	  gruntfile: new Replacer(this.pluginSlug + '/Gruntfile.js', this),
	  package: new Replacer(this.pluginSlug + '/package.json', this),
	  publicjs: new Replacer(this.pluginSlug + '/public/assets/js/public.js', this),
	  publiccoffee: new Replacer(this.pluginSlug + '/public/assets/coffee/public.coffee', this),
	  impexp: new Replacer(this.pluginSlug + '/admin/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_ImpExp.php', this),
	  cmb: new Replacer(this.pluginSlug + '/admin/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_CMB.php', this),
	  contextualhelp: new Replacer(this.pluginSlug + '/admin/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_ContextualHelp.php', this),
	  extras: new Replacer(this.pluginSlug + '/admin/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_Extras.php', this),
	  pointers: new Replacer(this.pluginSlug + '/admin/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_Pointers.php', this),
	  actdeact: new Replacer(this.pluginSlug + '/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_ActDeact.php', this),
	  p2p: new Replacer(this.pluginSlug + '/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_P2P.php', this),
	  uninstall: new Replacer(this.pluginSlug + '/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_Uninstall.php', this),
	  fakepage: new Replacer(this.pluginSlug + '/includes/' + this.pluginName.match(/\b(\w)/g).join('') + '_FakePage.php', this)
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
		  path = 'http://github.com/WPBP/WordPress-Plugin-Boilerplate-Powered/archive/' + version + '.zip',
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
	fs.rename('./plugin_temp/WordPress-Plugin-Boilerplate-Powered-' + version + '/plugin-name/', './' + self.pluginSlug, function () {
	  rmdir('plugin_temp', function (error) {
		if (error) {
		  console.log(('Error: Maybe you want the development version? Call this generator with the dev parameter').red);
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
	  path = 'https://github.com/WPBP/WordPress-Plugin-Boilerplate-Powered/archive/master.zip';
	}
	request(path)
			.pipe(fs.createWriteStream('plugin.zip'))
			.on('close', function () {
			  zip = new Admzip('./plugin.zip');
			  console.log(('File downloaded').white);
			  zip.extractAllTo('plugin_temp', true);
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
  //Rename files
  fs.rename(this.pluginSlug + '/plugin-name.php', this.files.primary.file, function (err) {
	if (err) {
	  console.log(('Error on rename plugin-name.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/Plugin_Name_Admin.php', this.files.adminClass.file, function (err) {
	if (err) {
	  console.log(('Error on rename Plugin_Name_Admin.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/public/Plugin_Name.php', this.files.publicClass.file, function (err) {
	if (err) {
	  console.log(('Error on rename Plugin_Name.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/languages/plugin-name.pot', this.pluginSlug + '/languages/' + this.pluginSlug + '.pot', function (err) {
	if (err) {
	  console.log(('Error on rename plugin-name.pot:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/includes/PN_ActDeact.php', this.files.actdeact.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_ActDeact.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/includes/PN_P2P.php', this.files.p2p.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_P2P.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/includes/PN_Uninstall.php', this.files.uninstall.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_Uninstall.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/includes/PN_FakePage.php', this.files.fakepage.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_FakePage.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/includes/PN_CMB.php', this.files.cmb.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_ActDeact.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/includes/PN_Extras.php', this.files.extras.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_Extras.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/includes/PN_ContextualHelp.php', this.files.contextualhelp.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_ContextualHelp.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/includes/PN_ImpExp.php', this.files.impexp.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_ImpExp.php:' + err).red);
	}
  });
  fs.rename(this.pluginSlug + '/admin/includes/PN_Pointers.php', this.files.pointers.file, function (err) {
	if (err) {
	  console.log(('Error on rename PN_Pointers.php:' + err).red);
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
  if (verbose) {
	console.log(('Added info marker replace on plugin.php').italic);
  }
  //Activate/deactivate
  if (this.activateDeactivate.indexOf('Activate/Deactivation Method') === -1) {
	this.files.primary.looplines(this.loadLines.primary.actdeact);
	fs.unlink(this.files.actdeact.file);
  }
  if (this.modules.indexOf('Freemius/wordpress-sdk') === -1) {
	execSync('composer remove freemius/wordpress-sdk');
	this.files.primary.looplines(this.loadLines.primary.freemius);
	if (verbose) {
	  console.log(('Removed Freemius/wordpress-sdk').italic);
	}
  }
  if (this.modules.indexOf('wpackagist-plugin/posts-to-posts') === -1) {
	execSync('composer remove wpackagist-plugin/posts-to-posts');
	this.files.primary.looplines(this.loadLines.primary.p2p);
	fs.unlink(this.files.p2p.file);
	if (verbose) {
	  console.log(('Removed wpackagist-plugin/posts-to-posts').italic);
	}
  }
  if (this.modules.indexOf('WPBP/FakePage') === -1) {
	this.files.primary.looplines(this.loadLines.primary.fakepage);
	fs.unlink(this.files.fakepage.file);
	if (verbose) {
	  console.log(('Removed WPBP/FakePage').italic);
	}
  }
};

WpPluginBoilerplateGenerator.prototype.setAdminClass = function setAdminClass() {
  this.files.adminClass.looplines(this.loadLines.admin.todo);
  if (verbose) {
	console.log(('Added info marker in admin').italic);
  }
  if (this.modules.indexOf('WebDevStudios/CMB2') === -1) {
	execSync('composer remove webdevstudios/cmb2');
	this.files.impexp.looplines(this.loadLines.impexp.cmb);
	this.files.adminClass.looplines(this.loadLines.admin.cmb);
	fs.unlink(this.files.cmb.file);
	if (this.adminPage === true) {
	  this.files.adminView.looplines(this.loadLines.adminview.cmb);
	}
	if (verbose) {
	  console.log(('Removed WebDevStudios/CMB2').italic);
	}
  }
  if (this.modules.indexOf('origgami/CMB2-grid') === -1) {
	execSync('composer remove origgami/cmb2-grid');
	this.files.cmb.looplines(this.loadLines.cmb.cmbgrid);
	this.files.cmb.add('$field1 = ', '');
	this.files.cmb.add('$field2 = ', '');
	if (verbose) {
	  console.log(('Removed origgami/cmb2-grid').italic);
	}
  }
  if (this.modules.indexOf('voceconnect/wp-contextual-help') === -1) {
	execSync('composer remove voceconnect/wp-contextual-help');
	deleteFolder(this.pluginSlug + '/admin/includes/help-docs');
	fs.unlink(this.files.contextualhelp.file);
	this.files.adminClass.looplines(this.loadLines.admin.contextual);
	if (verbose) {
	  console.log(('Removed voceconnect/wp-contextual-help').italic);
	}
  }
  if (this.modules.indexOf('nathanielks/wp-admin-notice') === -1) {
	execSync('composer remove nathanielks/wp-admin-notice');
	this.files.adminClass.looplines(this.loadLines.admin.notice);
	if (verbose) {
	  console.log(('Removed nathanielks/wp-admin-notice').italic);
	}
  }
  if (this.modules.indexOf('julien731/WP-Review-Me') === -1) {
	execSync('composer remove julien731/wp-review-me');
	this.files.adminClass.looplines(this.loadLines.admin.review);
	if (verbose) {
	  console.log(('Removed julien731/WP-Review-Me').italic);
	}
  }
  if (this.modules.indexOf('julien731/WP-Dismissible-Notices-Handler') === -1) {
	execSync('composer remove julien731/wp-dismissible-notices-handler');
	this.files.adminClass.looplines(this.loadLines.admin.dismissible);
	if (verbose) {
	  console.log(('Removed julien731/WP-Dismissible-Notices-Handler').italic);
	}
  }
  if (this.modules.indexOf('WPBP/PointerPlus') === -1) {
	execSync('composer remove wpbp/pointerplus');
	fs.unlink(this.files.pointers.file);
	this.files.adminClass.looplines(this.loadLines.admin.pointers);
	if (verbose) {
	  console.log(('Removed WPBP/PointerPlus').italic);
	}
  }
  if (this.modules.indexOf('WPBP/CronPlus') === -1) {
	execSync('composer remove wpbp/cronplus');
	this.files.adminClass.looplines(this.loadLines.admin.cron);
	if (verbose) {
	  console.log(('Removed WPBP/CronPlus').italic);
	}
  }
  if (this.modules.indexOf('WPBP/CPT_Columns') === -1) {
	execSync('composer remove wpbp/cpt_columns');
	this.files.adminClass.looplines(this.loadLines.admin.columns);
	if (verbose) {
	  console.log(('Removed WPBP/CPT_Columns').italic);
	}
  }
  if (this.adminPage === false) {
	this.files.adminClass.looplines(this.loadLines.admin.remove);
	fs.unlink(this.files.adminView.file);
	if (verbose) {
	  console.log(('Removed code of Admin page').italic);
	}
  }
  if (verbose) {
	console.log(('Cleaning in admin-class*.php').italic);
  }
  if (this.snippet.indexOf('Backend - Dashboard Activity Widget') === -1
		  && this.snippet.indexOf('Backend - Dashboard At Glance Widget') === -1
		  && this.snippet.indexOf('System - Transient Example') === -1
		  && this.snippet.indexOf('Backend - Bubble Notification on pending CPT') === -1) {
	fs.unlink(this.files.extras.file);
	this.files.adminClass.looplines(this.loadLines.admin.extras);
  } else {
	if (this.snippet.indexOf('Backend - Dashboard At Glance Widget') === -1) {
	  this.files.extras.looplines(this.loadLines.extras.glance);
	  this.files.adminCss.looplines(this.loadLines.admincss.glance);
	  if (verbose) {
		console.log(('Removed code of Dashboard At Glance Widget').italic);
	  }
	}
	if (this.snippet.indexOf('Backend - Dashboard Activity Widget') === -1) {
	  this.files.extras.looplines(this.loadLines.extras.activity);
	  if (verbose) {
		console.log(('Removed code of Dashboard Activity Widget').italic);
	  }
	}
	if (this.snippet.indexOf('System - Transient Example') === -1) {
	  this.files.extras.looplines(this.loadLines.extras.transient);
	  if (verbose) {
		console.log(('Removed code of Transient Example').italic);
	  }
	}
	if (this.snippet.indexOf('Backend - Bubble Notification on pending CPT') === -1) {
	  this.files.extras.looplines(this.loadLines.extras.bubble);
	  if (verbose) {
		console.log(('Removed Bubble Notification').italic);
	  }
	}
  }
  if (this.snippet.indexOf('Backend - Import/Export settings system') === -1) {
	fs.unlink(this.files.impexp.file);
	this.files.adminClass.looplines(this.loadLines.admin.impexp);
	if (this.adminPage === true) {
	  this.files.gruntfile.looplines(this.loadLines.adminview.impexp);
	}
	if (verbose) {
	  console.log(('Removed Import/Export Settings').italic);
	}
  }
  if (this.snippet.indexOf('WPBP/Debug') === -1) {
	this.files.adminClass.looplines(this.loadLines.admin.debug);
	if (verbose) {
	  console.log(('Removed WPBP/Debug').italic);
	}
  }
  if (this.snippet.indexOf('System - Custom action') === -1
		  && this.snippet.indexOf('System - Custom filter') === -1
		  && this.snippet.indexOf('System - Custom shortcode') === -1) {
	this.files.adminClass.looplines(this.loadLines.admin.custom);
  } else {
	if (this.snippet.indexOf('System - Custom action') === -1) {
	  this.files.adminClass.looplines(this.loadLines.admin.customact);
	  if (verbose) {
		console.log(('Removed Custom Action').italic);
	  }
	}
	if (this.snippet.indexOf('System - Custom filter') === -1) {
	  this.files.adminClass.looplines(this.loadLines.admin.customflt);
	  if (verbose) {
		console.log(('Removed Custom Filter').italic);
	  }
	}
  }
  if (this.snippet.indexOf('Backend - Donate link in plugins list') === -1) {
	this.files.adminClass.looplines(this.loadLines.admin.donate);
	if (verbose) {
	  console.log(('Removed Donate link in plugins list').italic);
	}
  }

};

WpPluginBoilerplateGenerator.prototype.setPublicClass = function setPublicClass() {
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
  if (this.modules.indexOf('WebDevStudios/CPT_Core') === -1) {
	execSync('composer remove webdevstudios/cpt-core');
	this.files.publicClass.looplines(this.loadLines.public.cptcore);
	if (verbose) {
	  console.log(('Removed WebDevStudios/CPT_Core').italic);
	}
  }
  if (this.modules.indexOf('WebDevStudios/Taxonomy_Core') === -1) {
	execSync('composer remove webdevstudios/taxonomy_core');
	this.files.publicClass.looplines(this.loadLines.public.taxcore);
	if (verbose) {
	  console.log(('Removed WebDevStudios/Taxonomy_Core').italic);
	}
  }
  if (this.modules.indexOf('WPBP/Widgets-Helper') === -1) {
	deleteFolder(this.pluginSlug + '/public/widgets');
	this.files.publicClass.looplines(this.loadLines.public.widget);
	if (verbose) {
	  console.log(('Removed WPBP/Widgets-Helper').italic);
	}
  }
  if (this.modules.indexOf('WPBP/Template') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.template);
	deleteFolder(this.pluginSlug + '/templates');
	if (verbose) {
	  console.log(('Removed WPBP/Template').italic);
	}
  }
  if (this.modules.indexOf('WPBP/Requirements') === -1) {
	this.files.actdeact.looplines(this.loadLines.actdeact.requirement);
	if (verbose) {
	  console.log(('Removed WPBP/Requirements').italic);
	}
  }
  //Snippet
  if (this.snippet.indexOf('Frontend - CPTs on search box') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.cptsearch);
	if (verbose) {
	  console.log(('Removed CPTs on search box').italic);
	}
  }
  if (this.snippet.indexOf('System - Custom action') === -1
		  && this.snippet.indexOf('System - Custom filter') === -1
		  && this.snippet.indexOf('System - Custom shortcode') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.customfunc);
  } else {
	if (this.snippet.indexOf('System - Custom action') === -1) {
	  this.files.publicClass.looplines(this.loadLines.public.customact);
	}
	if (this.snippet.indexOf('System - Custom filter') === -1) {
	  this.files.publicClass.looplines(this.loadLines.public.customflt);
	}
	if (this.snippet.indexOf('System - Custom shortcode') === -1) {
	  this.files.publicClass.looplines(this.loadLines.public.customsc);
	}
  }
  if (this.snippet.indexOf('Frontend - Javascript DOM-based Routing') === -1) {
	this.files.publicjs.looplines(this.loadLines.publicjs.routing);
	this.files.publiccoffee.looplines(this.loadLines.publiccoffee.routing);
  }
  if (this.snippet.indexOf('Frontend - Capability system') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.cap);
	this.files.actdeact.looplines(this.loadLines.actdeact.cap);
  }
  if (this.snippet.indexOf('Frontend - Add body class') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.body);
  }
  if (this.snippet.indexOf('Frontend - wp_localize_script for PHP var to JS') === -1) {
	this.files.publicClass.looplines(this.loadLines.public.localize);
	this.files.publicjs.looplines(this.loadLines.publicjs.localize);
  }
};

WpPluginBoilerplateGenerator.prototype.setReadme = function setReadme() {
  this.files.readme.add('@TODO: Plugin Name', this.pluginName);
};

WpPluginBoilerplateGenerator.prototype.setUninstall = function setUninstall() {
  if (this.activateDeactivate.indexOf('Uninstall Hook') === -1) {
	this.files.primary.looplines(this.loadLines.primary.uninstall);
	fs.unlink(this.files.uninstall.file);
  } else if (this.snippet.indexOf('Capability system') === -1) {
	this.files.uninstall.looplines(this.loadLines.uninstall.cap);
  }
};
