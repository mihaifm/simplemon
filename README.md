## simplemon

A simple file monitor that executes a given command each time a file change occurs inside the tracked directory.

### Installation

	npm install -g simplemon

### Usage
	
    simplemon COMMAND

Tracks file changes within the directory where it was launched, and launches COMMAND when a file change occurs.

The command supports a wildcard, `{}` , which is replaced with the modified file name before the command is launched.    
(similar to the {} wildcard of `find -exec`).

File tracking works recursively on subfolders.

Ignore rules can be specified in a `.smonignore` file. The rules work in the `.gitignore` fashion.

### Examples

 1\. Prints something whenever a file changes

	simplemon echo Something changed

 2\. Log modified the full path of each modified file (make sure to add an ignore rule for log.txt)

    simplemon echo {} >> log.txt

 3\. Calls jade to render .jade files into .html, each time a .jade file changes. 

	simplemon jade -O output {}

In this case the .smonignore file should ignore anything else except .jade:

    *
    !*.jade

 4\. Restart node each time a file changes somewhere in the current directory:

    simplemon node app.js

(this works in the same way as [nodemon](https://github.com/remy/nodemon))


### Configuration

simplemon supports some config options that can be specified in a `smonconfig.json` file within the directory where it is run.

Here are the options and their default values:

	{
		"command" : null,
		"threshold" : 200,
		"restart" : true,
		"restartDelay" : 500,
		"debug" : false
	}


__command__ : the COMMAND can be specified in the config file as well (if it's specified both in the shell and in the config file, the shell version is used).

If piping or redirection are needed, setting the command in the config file is the way to go. 
(in contrast, when using the shell, piping and redirection are applied to the ouput of simplemon, rather than the ouput of the command).
Also, in this scenario, `"restart"` needs to be `false` (see the restart option below).

*Example:*
Log each line that contains a keyword from a modified file:

smonconfig.json

    {
    	"command" : "cat {} | grep foobar >> log.txt",
    	"restart" : false
    }

.smonignore
	
	log.txt

Run it without any parameters:

    simplemon


__threshold__ : interval (in milliseconds) inside which changes to the same file are ignored.

For example, a file save triggers a COMMAND to be launched by simplemon. If the same file is saved again withing the 200ms threshold interval, the COMMAND is not launched a second time. 

__restart__ : If true, the processes that are already running are restarted.

If a COMMAND is launched with no wildcard {} (for instance `node app.js`), the process is restarted each time a file changes within its directory.

If a COMMAND is launched with a wilcard {}, the process is restarted only when file received as a parameter changes.

If false, a new process is launched without killing the existing one.

*Note:* When `"restart: true"` simplemon needs to kill/restart a single running process, therefore command chaining (piping, etc.) will not work.

__restartDelay__ : Delays the restart of the process with the given value (milliseconds). This should allow some processes to do cleanup after they received the kill message.

__debug__ : more output messages


