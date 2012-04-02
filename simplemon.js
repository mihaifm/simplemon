var fs = require('fs');
var util = require('util');
var path = require('path');
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var platform = process.platform;
var watchedFiles = {};
var resolvedFiles = {};
var runningChildren = {};
var ignoreRules = [];
var config = readConfig();
var print = function(msg) { 
	process.stderr.write(msg); 
}
var app = '';
var appargs = [];

//interval (miliseconds) inside which changes to the same file are ignored
var threshold = config.threshold ; 

//restart the process when the file changes (set to false to let it finish)
var restart = config.restart;

//the grace period (miliseconds) given to a process after the kill signal was sent, before restarting it
var restartDelay = config.restartDelay;

var debug = config.debug;
var cmd = config.command;

function start()
{
	setTimeout(monitor, 500);

	setInterval(function() {}, 5 * 1000);

	//if command doesn't contain any wildcards, run it once
	if (cmd.indexOf('{}') < 0)
		runcmd('');

	print('\x1B[36m(simplemon) waiting for changes...\n\n\x1B[0m');
}
  
function runcmd(filename) 
{
	if (!cmd)
		return;

	var orig_filename = filename;
	//if command has no wildcards, there's no use for the filename
	if (cmd.indexOf('{}') < 0)
		filename = '';

	if (watchedFiles[filename] && resolvedFiles[filename])
	{
		if (watchedFiles[filename] - resolvedFiles[filename] < threshold)
			return;
	}

	if (filename.length > 0 && ignore(filename))
		return;

	var temp_cmd = cmd;

	//replace {} wildcard passed to the command with the filename
	temp_cmd = temp_cmd.replace(/{}/g, filename);

	if (orig_filename.length > 0)
		print('\x1B[36m(simplemon) file changed: \x1B[0m' + orig_filename + '\n');
	print('\x1B[36m(simplemon) starting process: \x1B[0m' + temp_cmd + '\n\n');

	if (runningChildren[filename] && restart)
	{
		if (debug)
			print('(simplemon) killing child with pid: ' + runningChildren[filename].pid + '\n');

		runningChildren[filename].kill();
		runningChildren[filename] = null;
		setTimeout(function() { runcmd(filename); }, restartDelay);
		
		return;
	}

	resolvedFiles[filename] = +new Date;

	if (!restart)
	{
		//use exec here since we don't need to kill the process
		runningChildren[filename] = exec(temp_cmd, function (error, stdout, stderr) {

	    		if (error !== null) {
	      			print('\x1B[1;31m\n(simplemon) process crashed\n\n\x1B[0m');
	      			runningChildren[filename] = null;
	    		}
	    		else
	    		{
	    			print('\x1B[32m\n(simplemon) process finished successfully\n\n\x1B[0m');
	    			runningChildren[filename] = null;
	    		}

	    		runningChildren[filename] = null;
			});

		process.stdin.resume();
		process.stdin.setEncoding('utf8');
		process.stdin.pipe(runningChildren[filename].stdin);
	
		runningChildren[filename].stdout.pipe(process.stdout);
		runningChildren[filename].stderr.pipe(process.stderr);
	}
	else
	{
		for (var i = 0; i < appargs.length; i++)
		{
			appargs[i] = appargs[i].replace(/{}/g, filename);
		}

		var child = spawn(app, appargs);

		runningChildren[filename] = child;

		child.stdout.on('data', function(data) {
			process.stdout.write(data);
		});

		child.stderr.on('data', function(data) {
			process.stderr.write(data);
		});

		child.on('exit', function(code, signal) {

			if (signal === 'SIGTERM')
				print('\x1B[32m(simplemon) process killed\n\n\x1B[0m');	
			else if (code === 0)
				print('\x1B[32m\n(simplemon) process finished successfully\n\n\x1B[0m');
			else
				print('\x1B[1;31m\n(simplemon) process crashed\n\n\x1B[0m');

    		runningChildren[filename] = null;
		});
	}

	if (debug)
		print('(simplemon) started child with pid: ' + runningChildren[filename].pid + '\n');
}

function monitor() 
{
	var changeFunction = function (callback) {

  		var watch = function (err, dir) {
    		try {
      			fs.watch(dir, { persistent: false }, function (event, filename) {

      				if (debug) 
      					print('(simplemon) change in dir: ' + dir + ', filename: ' + filename + '\n');

      				if (filename) {

      					var fullname = dir + '/' + filename;
      					fs.stat(fullname, function(err, stat) {
      						if (!err && stat) {
      							if (!stat.isDirectory())
      							{
      								fs.realpath(fullname, function(err, resolvedPath) {

      									//keep track of modification date for this file
      									watchedFiles[resolvedPath] = +new Date;

      									callback(err, resolvedPath);
      								});
      							}
      							else
      							{
      								//new directory created, time to watch it
      								fs.realpath(fullname, watch);
      							}
      						}
      					});
        			}
  				});

      			//recursive watch
      			fs.readdir(dir, function (err, files) {
        			if (!err) {
          				files.forEach(function (file) {
            				var filename = dir + '/' + file;
            				fs.stat(filename, function (err, stat) {
              					if (!err && stat) {
                					if (stat.isDirectory()) {

                						if (debug) 
                							print('(simplemon) watching dir: ' + filename + '\n');

                  						fs.realpath(filename, watch);
                					}
              					}
            				});
          				});
        			}
      			});
    		} 
    		catch (e) {
      			// ignoring this directory
    		}
  		}
  	
  		fs.realpath(process.cwd(), watch);
	}

	changeFunction(function(err, file) {

		if (file) {
			if (debug) print('(simplemon) change detected for: ' + file + '\n');
			runcmd(file);
		}
	});
}

function ignore(filename)
{
	for (var i = 0; i < ignoreRules.length; i++)
	{
		if (ignoreRules[i][0] == '!')
			continue;

		var fname = filename.replace(/\\/g, '/');

		if (new RegExp(ignoreRules[i]).test(fname))
		{
			//check negations
			for (var k = i + 1; k < ignoreRules.length; k++)
			{
				if (ignoreRules[k][0] == '!') 
				{
					if (new RegExp(ignoreRules[k].slice(1)).test(fname))
						return false;
				}
			}

			if (debug) print('file: ' + filename + ' ignored by rule: ' + ignoreRules[i]);
			return true;
		}
	}
	return false;
}

function readIgnores()
{
	if (path.existsSync('.smonignore')) 
	{
  		ignoreRules = fs.readFileSync('.smonignore', 'utf8')
  			.split('\n')
  			.filter(function(s) {
    			//remove comments
      			s = s.trim().replace(/^#.*$/, '');
      			return s.length > 0;
    		});

    	for (var i = 0; i < ignoreRules.length; i++) 
    	{
    		var isNegation = false;

    		//remove the following from the beggining of the rule:
    		// - useless slash / (that stands for current directory)
    		// - negation charachter !

    		if (ignoreRules[i][0] == '!')
    		{
    			isNegation = true;
    			ignoreRules[i] = ignoreRules[i].slice(1).trim();
    		}
    		if (ignoreRules[i][0] == '/')
    		{
    			ignoreRules[i] = ignoreRules[i].slice(1).trim();
    		}

    		//compose a regex from cwd and the ignore rule
    		ignoreRules[i] = process.cwd().replace(/\\/g, '/').replace(/[.|[\]()\\]/g, '\\$&').trim() +
    						'/' + 
    						ignoreRules[i].replace(/[\.()]/g, '\\$&').replace(/\*/g, '.*').trim();

    		if (isNegation)
    			ignoreRules[i] = '!' + ignoreRules[i];
    	}

    	ignoreRules = ignoreRules.filter(function(s) { return s.length > 0; });
	}
}

function readArgs() 
{
	if (process.argv.length > 2)
		cmd = process.argv.slice(2).join(' ').trim();

	if (!cmd)
		process.exit(0);

	if (process.argv.length > 2)
		app = process.argv[2];
	else
		app = cmd.split(' ')[0];

	if (process.argv.length > 3)
		appargs = process.argv.slice(3);
	else if (cmd.split(' ').length > 1)
		appargs = cmd.split(' ').slice(1);
}

function readConfig()
{
	//setup config defaults
	var cfg = 
	{
		command: null,
		threshold: 200,
		restart: true,
		restartDelay: 500,
		debug: 0
	};

	if (path.existsSync('smonconfig.json'))
	{
		var parsed_cfg = JSON.parse(fs.readFileSync('smonconfig.json', 'utf8'));

		for(var prop in parsed_cfg)
		{
			cfg[prop] = parsed_cfg[prop];
		}
	}

	return cfg;
}

readArgs();
readConfig();
readIgnores();
start();