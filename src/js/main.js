/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://kekse.biz/ https://github.com/kekse1/
 */

//
import * as globals from '../shared/globals.js';
import * as server from '../shared/server.js';
import getopt from '../shared/getopt.js';
import Erase from './erase.js';
import Help from './help.js';

//
const param = getopt(true);

if(param.has('help'))
{
	new Help(param, 0);
}
else for(var i = 0; i < param.length; ++i)
{
	if(param[i] === '-?')
	{
		new Help(param, 0);
	}
}

//
new Erase(param);

//

