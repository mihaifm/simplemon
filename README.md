## simplemon

A simple file monitor that executes a given command each time a file change occurs inside the tracked directory.

### Installation

	npm install -g simplemon

### Usage
	
    simplemon COMMAND

Tracks file changes within the directory where it was launched, and lauches COMMAND when a file change occurs.

The command supports a wildcard, `{}` , which is replaced with the modified file name before the command is launched.
(similar to the {} wildcard of `find -exec`).

File tracking works recursively on subfolders.
Ignore rules can be specified in a `.smonignore` file. The rules work in the `.gitignore` fashion.

### Examples

	simplemon echo Something changed

Prints 'Something changed' whenever a file changes

    simplemon echo {} >> log.txt

Appends the full path of each modified file to log.txt

	simplemon jade -O ouput {}

Calls jade to render .jade files into .html. In this case the .smonignore file should ignore anything else except .jade:
    \*
    !\*.jade

    simplemon node app.js

Starts node. Each time a file changes within the current directory, the node process is killed and restarted (it works the same way as [nodemon](https://github.com/remy/nodemon)).

### Configuration

simplemon supports some config options that can be specified in a `smonconfig.json` file within the directory where it is run.

Here are the options and their default values:

	{
		"threshold" : 200,
		"restart" : true,
		"restartDelay" : 500,
		"debug" : false
	}

__threshold__ : interval (in miliseconds) inside which changes to the same file are ignored.
For example, a file save triggers a COMMAND to be launched by simplemon. If the same file is saved again withing the 200ms threshold interval, the COMMAND is not launched a second time. 

__restart__ : If true, the processes that are already running are restarted. 
If a COMMAND is launched with no wildcard {} (for instance `node app.js`), the process is restarted each time a file changes within its directory.
If a COMMAND is launched with a wilcard {}, the process is restarted only when file received as a parameter changes.

__restartDelay__ : Delays the restart of the process with the given value (miliseconds). This should allow some processes to do cleanup after they received the kill message.

__debug__ : more output messages


