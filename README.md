# generator-wp-plugin-boilerplate-powered

A generator for [Yeoman](http://yeoman.io) to customize the [WP Plugin Boilerplate Powered](https://github.com/Mte90/WordPress-Plugin-Boilerplate-Powered).  
Release of the boilerplate supported: **1.1.5**

## Getting Started

### What is Yeoman?

Trick question. It's not a thing. It's this guy:

![](http://i.imgur.com/JHaAlBJ.png)

Basically, he wears a top hat, lives in your computer, and waits for you to tell him what kind of application you wish to create.

Not every new computer comes with a Yeoman pre-installed. He lives in the [npm](https://npmjs.org) package repository. You only have to ask for him once, then he packs up and moves into your hard drive. *Make sure you clean up, he likes new and shiny things.*

```
$ npm install -g yo
```

### Install the generator

```
$ npm install -g generator-wp-plugin-boilerplate-powered
```
  
NOTE: require git and sed!

### How to use it

```
# Go to the plugin directory of your WP
cd wp-content/plugins
# Run the generator
$ yo wp-plugin-boilerplate-powered
# Force for remove the plugin folder
$ yo wp-plugin-boilerplate-powered force
# Use development version (not perfect)
$ yo wp-plugin-boilerplate-powered dev
# Verbose mode with verbose parameter
$ yo wp-plugin-boilerplate-powered dev verbose
# Or
$ yo wp-plugin-boilerplate-powered verbose
```

Can generate a config file for reuse it the settings!  

If exist a plugin.zip file in the root, the boilerplate is not downloaded

## License

[MIT License](http://en.wikipedia.org/wiki/MIT_License)
