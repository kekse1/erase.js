/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://kekse.biz/ https://github.com/kekse1/
 * v2
 */

//
const parameter = {};
export default parameter;

//
const parameters = [
	[ 'delete', 'Delete everything when finished', '--delete', 'regular' ],
	[ 'random', 'Use random data, instead of zero\'s', '--random', '' ],
	[ 'iterations', 'Iterations (multiple overwrites)', '--iterations', '' ],
	[ 'chmod', 'Target file mode/perms (or if any change)', '--chmod', 'regular' ],
	[ 'parallel', 'Parallel writes (async, not threads)', '--parallel', 'regular' ],
	[ 'buffer', 'Buffer/chunk size', '--buffer', '' ]
];

const regularVariables = [
	//[ 'errors', 'All errors which occured until now' ],
	[ 'count', 'All files we effectively overwrite' ],
	[ 'size', 'Size of all real files together' ],
	[ 'bytes', 'Data we effectively write (w/ iterations)' ],
	[ 'depth', 'Maximum depth when traversing directories' ],
	[ 'rm', 'Files selected for deletion (unlink)' ],
	[ 'rmdir', 'Directories for full deletion, from command line' ],
	[ 'found', 'All found items in file system, w/ non-regular files' ],
	[ 'empty', 'Empty files (won\'t get overwritten, of course)' ],
	[ 'ignored', 'Non-regular files, like symbolic links (ignored)' ],
	[ 'prohibited', 'Items not below current worling directory' ],
	[ 'multiple', 'Items selected multiple times (counted only once)' ]
];

//
Reflect.defineProperty(parameter, 'parameters', { enumerable: true, get: () => {
	return clone(parameters);
}});

Reflect.defineProperty(parameter, 'regularParameters', { enumerable: true, get: () => {
	const result = [];

	for(var i = 0, j = 0; i < parameters.length; ++i)
	{
		if(!parameters[i][3] || parameters[i][3] === 'regular')
		{
			result[j++] = [ ... parameters[i] ];
		}
	}

	return result;
}});

Reflect.defineProperty(parameter, 'freeSpaceParameters', { enumerable: true, get: () => {
	const result = [];

	for(var i = 0, j = 0; i < parameters.length; ++i)
	{
		if(!parameters[i][3] || parameters[i][3] === 'freeSpace')
		{
			result[j++] = [ ... parameters[i] ];
		}
	}

	return result;
}});

Reflect.defineProperty(parameter, 'regularVariables', { enumerable: true, get: () => {
	return clone(regularVariables);
}});

Reflect.defineProperty(parameter, 'freeSpaceVariables', { enumerable: true, get: () => {
	throw new Error('TODO');
}});

//
parameter.getMaxRegularVariablesKeyLength = (_add = 2) => {
	var result = 0, length;

	for(var i = 0; i < regularVariables.length; ++i)
	{
		if((length = regularVariables[i][0].length) > result)
		{
			result = length;
		}
	}

	return (result + _add);
};

parameter.getMaxRegularParametersSwitchLength = (_add = 2) => {
	var result = 0, length;

	for(var i = 0; i < parameters.length; ++i)
	{
		if(!parameters[i][3] || parameters[i][3] === 'regular')
		{
			if((length = parameters[i][2].length) > result)
			{
				result = length;
			}
		}
	}

	return (result + _add);
};

//

