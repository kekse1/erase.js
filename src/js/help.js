/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://norbert.com.es/
 */

//
import Parameters from './param.js';

//
class EraseHelp
{
	constructor(_param, _exit = 0)
	{
		//
		if(!(this.param = _param))
		{
			throw new Error('Missing parameters argument (started via shell script?)');
		}

		//
		this.showSyntax();

		//
		if(bool(_exit))
		{
			if(_exit)
			{
				_exit = Math.random.byte(255, 1);
			}
			else
			{
				_exit = 0;
			}
		}
		
		if(int(_exit) && _exit >= 0)
		{
			process.exit(_exit);
		}
	}

	get base()
	{
		return this.param.get('base');
	}

	showSyntax()
	{
		console.log('Expects either an arbitrary amount of file and/or directory paths,' +
			EOL + 'or only the ' + '--free'.bold(true).info(true).quote() + ' parameter.');
		console.eol();
		console.log('\t' + 'Syntax'.error(true) + ': ' + this.base.debug(true) +
			' < '.debug(true) + 'path'.info(true) + ' [ ... ]'.warn(true) + ' >'.debug(true) +
			' // '.debug(true) + '--free'.warn(true).quote());
		console.eol();
		console.log('The ' + '--free'.bold(true).info(true).quote() + ' parameter is designed ' +
			'for ' + 'NAND'.bold(true).warn(true) + ' ' + 'flash drives'.underline(true) + '.' +
			EOL + ('.. but shouldn\'t be called too often (due to ' + 'NAND'.bold(true) + ' ' +
			'endurance'.bold(true).underline(true)).debug(true) + ').'.debug(true));
		console.log('The rule is to use this mode ' + 'after'.error(true) + ' regular file erasing!');

		console.eol();
		console.log('All file and/or directory paths need to reside ' + EOL + 'below'.
			bold(true).underline(true) + ' your ' + 'current working directory'.underline(true) +
			' (for security).'); console.debug('\t' + process.cwd());

		console.eol();
		console.log('Possible parameters ' + ('(also configurable via ' +
			'config.json'.warn(true).quote() + ', ' +
			'so all ' + 'optional'.bold(true) + ')').debug(true) + ':');

		console.eol();
		const parameters = Parameters.parameters;
		var maxKeyLen = 0, len, string;
		
		for(const param of parameters)
		{
			if((len = param[0].length) > maxKeyLen)
			{
				maxKeyLen = len;
			}
		}

		maxKeyLen += 2;
		const onlyRegular = ' (only '.debug(true) + 'regular mode'.info(true) + ')'.debug(true);
		const onlyFreeSpace = ' (only '.debug(true) + ('--free'.warn(true) + ' space').info(true) + ' mode)'.debug(true);

		for(const param of parameters)
		{
			string = '\t' + param[2].padStart(maxKeyLen, ' ').
				info(true) + ' \t // '.debug(true) +
					param[1].error(true);

			if(param[3])
			{
				if(param[3] === 'regular')
				{
					string += onlyRegular;
				}
				else if(param[3] === 'free')
				{
					string += onlyFreeSpace;
				}
			}
			
			console.log(string);
		}

		console.eol();
		console.log(('You should always call this utility via the ' +
			(this.base + '.sh').bold(true).quote() +
			' startup script.'.faint(true)).faint(true));
	}
}

export default EraseHelp;

//

