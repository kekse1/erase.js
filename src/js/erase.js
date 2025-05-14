/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://kekse.biz/ https://norbert.com.es/
 * v2
 */

//
const DEFAULT_PARAM_SCHEME_JSON = '../../json/param/erase.json';
const DEFAULT_PROMPT = 'erase!';
const DEFAULT_ROUND = 1;
const DEFAULT_MODE = 0;
const DEFAULT_BASE = 1024;
const DEFAULT_PREC = 2;
const DEFAULT_FIXED = true;
const DEFAULT_BYTES = true;
const DEFAULT_ALL = true;
const DEFAULT_PROGRESS = 2.5;

//
import FileSystem from '../shared/fs.js';
import Application from '../shared/app.js';
import Parameter from '../shared/param.js';
import Quant from '../shared/quant.js';
import crypt from '../shared/crypt.js';
import path from 'node:path';
import fs from 'node:fs';
import Help from './help.js';
import Parameters from './param.js';

//
class Erase extends Quant
{
	constructor(_param = null, ... _args)
	{
		//
		super(null, ... _args);

		//
		if(!(this.param = _param))
		{
			throw new Error('No _param defined');
		}
		
		//
		Application.registerExitHandler((... _a) => this.onExit(... _a));
		
		new Application(this, {
			callback: (... _a) => this.onApplication(... _a),
			name: 'Erase', param: this.param,
			config: this.param.get('config') });
	}

	onExit(_name, _code, ... _args)
	{
		return this.destroy(_name, _code, ... _args);
	}
	
	get freeSpace()
	{
		return !!this.param.get('free');
	}
	
	static checkPathParameters(_param)
	{
		const set = new Set();
		const directories = [];
		const files = [];
		var stats, p;

		for(var i = 0; i < _param.length; ++i)
		{
			if(! pathname(_param[i]))
			{
				continue;
			}

			if(set.has(p = path.resolve(_param[i])))
			{
				continue;
			}
			else
			{
				set.add(p);
			}
			
			try
			{
				stats = fs.lstatSync(p);
			}
			catch(_err)
			{
				continue;
			}

			if(stats.isSymbolicLink())
			{
				++symlinks;
				continue;
			}
			else if(stats.isDirectory())
			{
				directories.push(p);
			}
			else if(stats.isFile())
			{
				files.push(p);
			}
			else
			{
				++others;
				continue;
			}
		}
		
		if(directories.length === 0 && files.length === 0)
		{
			return null;
		}
		
		return { files, directories };
	}
	
	//
	onApplication(_app, _info, _config, _object, _data)
	{
		new Parameter((_check, _scheme, _instance) => {
			//
			if(!_check)
			{
				throw new Error("TODO/DEBUG");
			}

			//
			this.errorList = [];
			
			//
			var items;
			
			if(this.free = this.freeSpace)
			{
				this.freeSpaceFlashWarning();
				this.items = null;
			}
			else if(!(items = Erase.checkPathParameters(this.param)))
			{
				console.eol(2);
				return new Help(this.param, true);
			}
			else
			{
				this.items = items;
				this.flashWarning();
			}

			//
			if(this.param.has('random'))
			{
				this.random = this.param.get('random');
			}
			else
			{
				this.random = this.getConfig('random');
			}

			if(this.param.has('iterations'))
			{
				this.iterations = this.param.get('iterations');
			}
			else
			{
				this.iterations = this.getConfig('iterations');
			}

			if(this.param.has('parallel'))
			{
				this.parallel = this.param.get('parallel');
			}
			else
			{
				this.parallel = this.getConfig('parallel');
			}

			if(this.param.has('buffer'))
			{
				this.buffer = this.param.get('buffer');
			}
			else
			{
				this.buffer = this.getConfig('buffer');
			}

			if(this.param.has('delete'))
			{
				this.delete = this.param.get('delete');
			}
			else
			{
				this.delete = this.getConfig('delete');
			}

			if(this.param.has('chmod'))
			{
				if(int(this.param.get('chmod')))
				{
					this.chmod = this.param.get('chmod');
				}
				else if(this.param.get('chmod'))
				{
					this.chmod = DEFAULT_MODE;
				}
				else
				{
					this.chmod = null;
				}
			}
			else if(int(this.getConfig('chmod')))
			{
				this.chmod = this.getConfig('chmod');
			}
			else if(this.getConfig('chmod'))
			{
				this.chmod = DEFAULT_MODE;
			}
			else
			{
				this.chmod = null;
			}
			
			if(this.param.has('refresh'))
			{
				if((this.refresh = this.param.get('refresh')) < 0)
				{
					this.refresh = this.getConfig('interface.refresh');
				}
			}
			else
			{
				this.refresh = this.getConfig('interface.refresh');
			}

			if(this.param.has('ansi'))
			{
				process.ansi = this.param.get('ansi');
			}
			else
			{
				process.ansi = this.getConfig('interface.ansi');
			}

			//
			global.progressStyle = this.getConfig('interface.progress');

			//
			console.eol();

			//
			if(this.iterations < 1)
			{
				console.error('Invalid `--iterations`: expecting an Integer above zero.');
				return this.destroy(null, true);
			}
			
			if(this.parallel < 1)
			{
				console.error('Invalid `--parallel`: expecting an Integer above zero.');
				return this.destroy(null, true);
			}

			if(this.buffer < 1)
			{
				console.error('Invalid `--buffer`: expecting an Integer above zero.');
				return this.destroy(null, true);
			}

			//
			if(this.free)
			{
				this.freeSpaceStart();
			}
			else
			{
				this.regularStart();
			}

			//
		}, path.join(this.param.get('script'),
			DEFAULT_PARAM_SCHEME_JSON), this.param);
	}

	//
	regularStart(_items = this.items)
	{
		//
		this.prohibited = 0;
		this.multiple = 0;
		this.found = 0;
		this.ignored = 0;
		this.depth = 1;
		this.empty = 0;
		this.rmList = [ ... this.items.files ];
		this.rmdirList = [ ... this.items.directories ];
		this.size = 0;
		this.done = 0;
		this.set = new Set();
		this.map = new Map();
		this.open = [];
		this.lastRefresh = 0;
		this.lines = 0;
		
		//
		this.checkFiles(this.items.files, (... _a) => {
			delete this.items.files;
			this.traverseDirectories(this.items.directories, (_files) => {
				delete this.items;
				this.checkFiles(_files, (... _a) => {
					this.continueRegular(); });
			});
		});
	}
	
	//
	freeSpaceStart()
	{
throw new Error('TODO: --free');
	}
	
	//
	destroy(_name, _code = 0, ... _args)
	{
		super.destroy();
		this.destroying = true;
		this.exitAllowed = true;
		process.exit(_code);
	}

	flashWarning()
	{
		console.warn(('WARNING'.inverse(true) + ': ' +
			'Flash/SSD drives probably cause less security!'
				.bold(true)).underline(true));
		console.debug('In this case you should also ' +
			('call this with '.warn(true) + '--free'.
				bold(true).info(true)).bold(true) +
					'!');
		console.eol();
	}
	
	freeSpaceFlashWarning()
	{
		console.warn(('WARNING'.inverse(true) + ': ' +
			'This mode is really ' + 'recommended'.info(true).bold(true) +
			' on ' + 'Flash/SSD drives'.bold(true).error(true)).
			underline(true) + (',' + EOL + 'but shouldn\'t' +
			' be repeated too often (' + 'due to ' +
			('NAND ' + 'endurance'.underline(true)).
			bold(true).error(true) + ')!').warn(true));
		console.eol();
	}

	//
	traverseDirectories(_directories, _callback)
	{
		const cwd = process.cwd();
		const result = []; var index = 0;
		var rest = _directories.length;

		if(rest === 0)
		{
			return _callback(result);
		}

		const readdirCallback = (_path, _err, _files, _depth = 1) => {
			if(_path === null)
			{
				//
			}
			else if(_err)
			{
				this.pushError(_err, _path);
			}
			else
			{
				if(_depth > this.depth)
				{
					this.depth = _depth;
				}

				for(var i = 0; i < _files.length; ++i)
				{
					const p = path.join(_path, _files[i].name);
				
					if(_files[i].isSymbolicLink())
					{
						++this.ignored;
						continue;
					}
					else if(_files[i].isDirectory())
					{
						if(this.set.has(p))
						{
							++this.multiple;
							continue;
						}

						this.set.add(p); ++rest;
						fs.readdir(p, {
							encoding: 'utf8',
							withFileTypes: true,
							recursive: false },
								(... _a) => readdirCallback(
									p, ... _a,
										_depth + 1));
					}
					else if(_files[i].isFile())
					{
						result[index++] = p;
					}
					else
					{
						++this.ignored;
					}
				}
			}

			if(--rest <= 0)
			{
				_callback(result);
			}
		};

		for(var i = 0; i < _directories.length; ++i)
		{
			const p = _directories[i];

			if(this.set.has(p))
			{
				++this.multiple;
				continue;
			}
			
			this.set.add(p);
			fs.realpath(p, { encoding: 'utf8' }, (_err, _path) => {
				if(_err)
				{
					this.pushError(_err, p);
					readdirCallback(null);
				}
				else if(!FileSystem.below(cwd, _path, true))
				{
					this.rmdirList.remove(_path);
					++this.prohibited;
					readdirCallback(null);
				}
				else fs.readdir(_path, {
					encoding: 'utf8',
					withFileTypes: true,
					recursive: false },
					(... _a) => readdirCallback(
						_path, ... _a));
			});
		}
	}
	
	static size(_bytes, _int = DEFAULT_BYTES, _ansi_a = 'info', _ansi_b = 'debug')
	{
		if(string(_ansi_a, false))
		{
			if(! (_ansi_a in String.prototype))
			{
				_ansi_a = '';
			}
		}
		else
		{
			_ansi_a = '';
		}

		if(string(_ansi_b, false))
		{
			if(! (_ansi_b in String.prototype))
			{
				_ansi_b = '';
			}
		}
		else
		{
			_ansi_b = '';
		}

		if(_ansi_a && !_ansi_b)
		{
			_ansi_b = _ansi_a;
		}

		var result = Math.size.styled(
			_bytes,
			DEFAULT_BASE,
			DEFAULT_PREC,
			DEFAULT_FIXED);

		if(_ansi_a)
		{
			result = result[_ansi_a](true);
		}

		if(_int && _bytes >= DEFAULT_BASE)
		{
			var bytes = (' (' + _bytes.toLocaleString().
				bold(true) + ' Bytes)');

			if(_ansi_b)
			{
				bytes = bytes[_ansi_b](true);
			}

			result += bytes;
		}

		return result;
	}

	checkFiles(_files, _callback)
	{
		const cwd = process.cwd();
		var rest = _files.length;

		if(rest === 0)
		{
			return _callback();
		}
		
		const lstatCallback = (_file, _err, _stats) => {
			if(--rest <= 0) setImmediate(
				() => _callback());
			
			if(_file === null)
			{
				return;
			}
			
			const file = {
				path: _file,
				basename: path.basename(_file),
				dirname: path.dirname(_file),
				relative: path.relative(cwd, _file)
			};

			if(_err)
			{
				this.pushError(_err, _file);
			}
			else if(this.map.has(_file))
			{
				++this.multiple;
			}
			else if(!_stats.isSymbolicLink() && _stats.isFile())
			{
				//
				if(_stats.size === 0)
				{
					return ++this.empty;
				}

				//
				this.size += _stats.size;

				//
				file.bytes = _stats.size;
				file.write = (_stats.size * this.iterations);
				file.size = Erase.size(_stats.size);
				file.perm = FileSystem.renderMode(
					file.mode = _stats.mode, true);
				file.octal = FileSystem.octalMode(
					_stats.mode);
				file.links = _stats.nlink;
				file.handle = null;
				file.iterations = 0;
				file.done = 0;
				
				//
				this.map.set(_file, file);
			}
			else
			{
				++this.ignored;
			}
		};

		const realpathCallback = (_file, _err, _path) => {
			if(_err)
			{
				this.pushError(_err, _file);
				return lstatCallback(null);
			}
			
			if(!FileSystem.below(cwd, _file, true))
			{
				this.rmdirList.remove(_path);
				++this.prohibited;
				return lstatCallback(null);
			}

			++this.found;
			fs.lstat(_file, { bigint: false }, (... _a) => {
				lstatCallback(_file, ... _a); });
		};

		for(var i = 0; i < _files.length; ++i)
		{
			const p = _files[i];
			fs.realpath(p, { encoding: 'utf8' }, (... _a) => {
				realpathCallback(p, ... _a); });
		}
	}

	pushError(_error, _path)
	{
		_error.PATH = (_path || '');
		return this.errorList.push(_error);
	}

	//
	regularVariables()
	{
		const regularVariables = Parameters.regularVariables;
		const maxKeyLen = Parameters.getMaxRegularVariablesKeyLength(2);
		const lines = [], width = console.width;
		var key, value, desc, len, zero;

		for(const param of regularVariables)
		{
			value = this[param[0]];
			zero = !value;

			if(zero && !DEFAULT_ALL)
			{
				continue;
			}
			
			if(zero)
			{
				param[0] = param[0].faint(true);
			}
			
			key = ('['.faint(true) + param[0] + ']'.faint(true)).
				info(true).pad(maxKeyLen, ' ', true);

			switch(param[0])
			{
				case 'size':
				case 'bytes':
					value = Erase.size(
						value,
						DEFAULT_BYTES,
						'warn',
						'error');
					break;
				default:
					value = value.toLocaleString().warn(true);
					break;
			}

			if(zero)
			{
				value = value.faint(true);
			}

			len = (key.textLength + value.textLength + 2);
			len = (width - len - 2);

			if(len > 0)
			{
				desc = param[1].substr(0, len).debug(true);
				len -= (desc.textLength + 2);

				if(zero)
				{
					desc = desc.faint(true);
				}

				if(len > 0)
				{
					desc = '.'.repeat(len).
						faint(true) +
						' ' + desc;
				}
			}
			else
			{
				desc = '';
			}
			
			lines.push(key + ' ' + value + (desc ? ' ' + desc : ''));
		}

		console.log(EOL + lines.join(EOL) + EOL + String.none());
		return lines;
	}

	get count()
	{
		return this.map.size;
	}

	regularParameters()
	{
		console.info('Your ' + 'parameters'.bold(true) + ' ' +
			('(change via ' + 'config.json'.quote().error(true) + ' or ' +
			'command line'.error(true) + '; see '.debug(true) +
				'--help / -?'.bold(true).warn(true) + ')').
					debug(true) + ':'.info(true));
		console.eol();

		const parameters = Parameters.regularParameters;
		const maxKeyLen = Parameters.getMaxRegularParametersSwitchLength(2);
		const width = console.width;
		var key, name, desc, value, left;
		
		for(const param of parameters)
		{
			key = param[0];
			name = param[2].padStart(maxKeyLen, ' ').info(true);
			desc = param[1].debug(true);
			left = (width - name.textLength - desc.textLength - 6);
			value = this[key];

			switch(Reflect.is(value))
			{
				case 'Boolean':
					value = value.toString(true);
					break;
				case 'Number':
				case 'BigInt':
					switch(key)
					{
						case 'chmod':
							value = (FileSystem.renderMode(
								value, true).error(true) + ' ('.
								defaultFG(true).faint(true) +
								FileSystem.octalMode(value).
									debug(true) + ')'.
									defaultFG(true).
									faint(true) +
									String.none());
							break;
						case 'buffer':
							const v = value;
							value = Math.size.styled(value).
								info(true);
							if(v >= 1024) value += (' (' +
								v.toLocaleString().bold(true) +
									' Bytes)').debug(true);
							break;
						default:
							value = value.toLocaleString().
								bold(true).warn(true);
							break;
					}
					break;
				case 'String':
					value = value.error(true).quote();
					break;
				default:
					switch(key)
					{
						case 'chmod':
							value = '-/-'.error(true) + (' (' +
								'unchanged)').debug(true);
							break;
						default:
							console.dir({value,param,key});
							throw new Error('Unexpected');
					}
					break;
			}

			value = (value + ' ').pad(-left, '.', true);
			
			console.log(name + ': '.defaultFG(true) +
				value + ' ' + desc);
		}

		console.eol();
	}

	prompt(_callback, _twice = true, _print = true)
	{
		const accepted = () => {
			if(_print) console.info('Accepted'.bold(true) + '! So we ' + 'continue'.underline(true).warn(true) + ' here.');
			if(_callback) _callback(true);
		};
		
		const rejected = () => {
			if(_print) console.error('Rejected'.bold(true) + '! So we ' + 'stop'.underline(true).warn(true) + ' here.');
			if(_callback) _callback(false);
			else this.destroy(null, true);
		};
		
		console.confirm('Do you really want to '.warn(true) +
			'continue'.error(true) + ''.debug(false),
			(_accepted) => {
				if(_accepted)
				{
					if(!_twice)
					{
						return accepted();
					}
					
					if(string(DEFAULT_PROMPT, false))
					{
						console.prompt('Then please '.warn(true) +
							'confirm it'.error(true).
							underline(true) + ' by typing in ' +
							DEFAULT_PROMPT.info(true).
							inverse(true).bold(true).quote() +
							' here: '.warn(false) +
							''.bold(false), (_answer) => {
								if(_answer === DEFAULT_PROMPT)
								{
									return accepted();
								}

								return rejected();
							});
					}
					else
					{
						console.confirm('Are you '.warn(true) +
							' really sure'.error(true),
							(_accepted) => {
								if(_accepted)
								{
									return accepted();
								}
								
								return rejected();
							});
					}
				}
				else
				{
					rejected();
				}
			});
	}

	unlinkPrompt(_callback, _twice, _print = true)
	{
		const rm = (this.rmList.length > 0);
		const rmdir = (this.rmdirList.length > 0);

		if(! (rm || rmdir))
		{
			return _callback(null);
		}

		if(!this.delete)
		{
			if(! _print)
			{
				return _callback(true);
			}

			console.eol();

			if(rm && rmdir)
			{
				console.info('There are %s ' + 'files'.underline(true) +
					' and %s ' + 'directories'.underline(true) +
					' selected for removal, but %s ain\'t' +
					' configured!',
						this.rmList.length.toLocaleString().
							bold(true).warn(true),
						this.rmdirList.length.toLocaleString().
							bold(true).warn(true),
						'--delete'.error(true));
			}
			else if(rm)
			{
				console.info('There are %s ' + 'files'.underline(true) +
					' selected for removal, but %s ain\'t' +
					' configured!',
						this.rmList.length.toLocaleString().
							bold(true).warn(true),
						'--delete'.error(true));
			}
			else
			{
				console.info('There are %s ' + 'directories'.underline(true) +
					' selected for removal, but %s ain\'t' +
					' configured!',
						this.rmdirList.length.toLocaleString().
							bold(true).warn(true),
						'--delete'.error(true));
			}

			console.debug('So we won\'t do anything more now.');
			return _callback(true);
		}
		
		if(!_print)
		{
			this.prompt(_callback, _twice, false);
		}

		console.eol();

		if(rm && rmdir)
		{
			console.warn('We\'re about to unlink %s ' +
				'files'.underline(true) + ' and %s ' +
				'directories'.underline(true) + ' now.',
				this.rmList.length.toLocaleString().
					bold(true).error(true),
				this.rmdirList.length.toLocaleString().
					bold(true).error(true));
		}
		else if(rm)
		{
			console.warn('We\'re about to unlink %s ' +
				'files'.underline(true) + ' now.',
				this.rmList.length.toLocaleString().
					bold(true).error(true));
		}
		else
		{
			console.warn('We\'re about to unlink %s ' +
				'directories'.underline(true) + ' now.',
				this.rmdirList.length.toLocaleString().
					bold(true).error(true));
		}

		console.debug('So I need your permission now. ...');
		this.prompt(_callback, _twice, true);
	}

	continueRegular()
	{
		delete this.set;

		const more = (this.rmList.length > 0 ||
			this.rmdirList.length > 0);

		if(this.map.size === 0)
		{
			console.info('There are ' + 'no files selected'.
				underline(true).warn(true) + ' for secure erase.');

			return this.unlinkPrompt((_accepted) => {
				console.eol(); if(more && _accepted)
					this.unlinkItems(() => {
						this.finishRegular(true); });
				else	this.finishRegular(true);
			}, true, true);
		}

		this.regularParameters();
		this.regularVariables();

		this.prompt((_accepted) => { console.eol();
			if(!_accepted) return this.finishRegular(false);

			this.clearLines(0, 2);
			console.info('Now we ' + 'overwrite'.error(true) +
				' %s ' + 'files'.warn(true) + '!',
					this.map.size.toLocaleString().
						bold(true).error(true));
			console.eol();

			this.eraseFiles(() => {
				console.info('Secure erasing ' + 'done'.bold(true) + '! :-D');

				this.unlinkPrompt((_accepted) => {
					if(_accepted !== null) this.clearLines(0, 2);
					if(more && _accepted)
						this.unlinkItems(() => {
							this.finishRegular(true); });
					else	this.finishRegular(true);
				}, false);
			});
		}, true, true);
	}
	
	get bytes()
	{
		return (this.size * this.iterations);
	}

	finishRegular(_state)
	{
		if(!_state)
		{
			return this.finish(false);
		}

		if(!process.ansi)
		{
			console.eol();
		}

		console.info('Finished'.bold(true).underline(true) + '! We just wrote ' +
			Erase.size(this.done) + ' (with ' + this.iterations.
				toLocaleString().bold(true).info(true) + ' iterations).');

		this.done /= this.iterations;

		console.debug('This were %s files with ' + Erase.size(this.done) +
			' in total.', this.map.size.toLocaleString().
				bold(true).error(true));

		return this.finish(_state, 'regular');
	}

	//
	showErrors(_details = true)
	{
		if(this.errorList.length === 0)
		{
			console.info('No'.bold(true) + ' errors! ' +
				':-)'.bold(true).debug(true));
			return 0;
		}

		console.error('We collected %s errors during the whole process' +
			(_details ? ':' : '.'),
				this.errorList.length.toLocaleString().
					bold(true).warn(true));

		if(!_details)
		{
			return this.errorList.length;
		}

		console.eol();

		var maxName = 0, len; for(const err of this.errorList)
		{
			if((len = err.name.length) > maxName)
			{
				maxName = len;
			}
		}

		maxName += 2;
		var line, diff;
		const cwd = process.cwd();
		const width = (console.width - 2);

		for(const err of this.errorList)
		{
			line = ('['.debug(true) + err.name.bold(true).error(true) +
				']'.debug(true)).pad(maxName, ' ', true);

			if(err.PATH)
			{
				line += ('('.info(true).faint(true) + path.relative(
					cwd, err.PATH).bold(true).debug(true) +
					')'.info(true).faint(true));
			}
 
			diff = (width - line.textLength - 1);

			if(diff > 0)
			{
				line += ' ' + err.message.substr(0, diff).
					warn(true);
			}

			console.log(line);
		}

		console.eol();
		return this.errorList.length;
	}

	finish(_state, _mode)
	{
		this.showErrors(true);

		if(!_state)
		{
			process.exit(true);
		}

		process.exit(0);
	}

	//
	eraseFiles(_callback)
	{
		const LIST = [ ... this.map.keys() ];

		if(LIST.length === 0)
		{
			return _callback(0);
		}

		const total = LIST.length;
		var rest = total;

		const close = (_file) => {
			if(!_file || !_file.handle) return false;
			this.open.remove(_file);
			fs.closeSync(_file.handle);
			_file.handle = null;
			return true;
		};
		
		const fin = (_file, _error = null) => {
			setImmediate(() => nextItem());
			close(_file);
			
			if(_error)
			{
				this.pushError(_error, _file.path);
			}

			if(--rest <= 0 && this.open.length <= 0)
			{
				this.clearLines(0, 1);
				return _callback(total / this.iterations);
			}
		};

		const syncCallback = (_file, _error) => {
			if(_error)
			{
				return fin(_file, _error);
			}

			if(_file.handle) fs.fchmod(_file.handle, (this.chmod === null ?
				_file.mode : this.chmod),
					(_err) => fin(_file, _err));
			else fin(_file);
		};

		const doneCallback = (_file, _error, _written = _file.done) => {
			if(_error)
			{
				setImmediate(() => nextItem());

				close(_file);
				rest -= this.iterations;

				return this.pushError(_error, _file.path);
			}
			
			if(_file.handle) fs.fsync(_file.handle,
				(_err) => syncCallback(
					_file, _err));
			else fin(_file);
		};

		const openCallback = (_file, _error, _fd) => {
			if(_error)
			{
				setImmediate(() => nextItem());
				return this.pushError(_error, _file.path);
			}

			this.open.push(_file);
			_file.handle = _fd;
			
			this.erase(_file, (... _a) => doneCallback(... _a));
		};

		const nextItem = () => {
			if(LIST.length === 0 || rest <= 0 || this.open.length >= this.parallel)
			{
				return;
			}

			const file = this.map.get(LIST.shift());

			fs.chmod(file.path, 0o600, (_err) => {
				if(_err) this.pushError(_err, file.path);
				else fs.open(file.path, 'rs+', 0o600,
					(_err, _fd) => openCallback(
						file, _err, _fd));
				setImmediate(() => nextItem());
			});
		};

		//
		nextItem();
	}
	
	erase(_file, _callback)
	{
		var rest = _file.bytes, done = 0;

		const fin = () => {
			if(++_file.iterations >= this.iterations)
			{
				this.regularProgressBars(true);
				return _callback(_file, null, _file.done);
			}
			
			rest = _file.bytes; done = 0;

			fs.fsync(_file.handle, (_err) => {
				if(_err) return _callback(_file, _err);
				fs.closeSync(_file.handle);
				_file.handle = fs.open(_file.path, 'rs+', 0o600,
					(_err, _fd) => {
						if(_err) return _callback(_file, _err, _file.done);
						_file.handle = _fd; write(); }); });
		};

		const writeCallback = (_error, _written, _buffer) => {
			this.done += _written;
			_file.done += _written;
			rest -= _written;
			done += _written;

			this.regularProgressBars();

			if(_error)
			{
				return _callback(_file, _error, _file.done);
			}
			
			if(rest <= 0)
			{
				fin();
			}
			else
			{
				write();
			}
		};
		
		const write = () => this.getBuffer(Math.min(rest, this.buffer),
			(_err, _buf) => { if(_err) return _callback(_file, _err);
				fs.write(_file.handle,
					_buf, 0, _buf.length, done,
					writeCallback);
		});
				
		//
		write();
	}

	//
	regularProgressBars(_force = false)
	{
		if(!this.checkRefresh() && !_force)
		{
			return false;
		}

		const width = (console.width - 4);
		const height = (console.height - 2);
		const open = [ ... this.open ];
		var result = Erase.progressBar(
			this.done / this.bytes,
			-6, false) + EOL;
		var lines = 1, maxRela = 0;
		var line, diff, rela, len;
		
		if(open.length === 0 || !process.ansi)
		{
			this.clearLines(lines);
			process.stdout.write(result);
			return result;
		}
		else if(open.length === 1)
		{
			result = '';
			lines = 0;
		}
		else
		{
			result += EOL;
			lines = 2;
		}

		for(var i = 0, l = 2; i < open.length && l < height; ++i, ++l)
		{
			if((len = open[i].relative.length) > maxRela)
			{
				maxRela = len;
			}
		}

		maxRela = Math.min(maxRela + 4, Math._floor(width / DEFAULT_PROGRESS));

		var barWidth = (width - maxRela - 5);
		
		for(var i = 0; i < open.length && lines < height; ++i, ++lines)
		{
			line = Erase.progressBar(
				open[i].done / open[i].write,
				barWidth, false);
			diff = (width - line.textLength);
			
			if(diff > 0)
			{
				rela = open[i].relative;
				diff -= rela.length;

				if(diff > 0)
				{
					rela = ' '.repeat(diff) + rela;
				}
				else if(diff < 0)
				{
					rela = ' ...'.debug(true).bold(true) +
						rela.substr(-(diff -= 4));
				}

				line = rela.defaultFG(true) + ' ' + line;
			}

			result += line + String.none() + EOL;
		}
		
		this.clearLines(lines);
		process.stdout.write(result);
		return result;
	}
	
	//
	checkRefresh()
	{
		const now = Date.now();
		const diff = (now - this.lastRefresh);
		
		if(diff < this.refresh)
		{
			return false;
		}
		
		this.lastRefresh = now;
		return true;
	}
	
	clearLines(_lines_next = 0, _more = 0)
	{
		const result = (this.lines + _more);
		
		if(result <= 0)
		{
			return this.lines =
				_lines_next;
		}
		
		this.lines = _lines_next;
		process.stdout.write('\r' +
			String.up(result + _more) +
			String.clearAfter());

		return (result - _more);
	}

	static progressBar(_factor, _width_add = -8, _seq = true, _full = false)
	{
		_factor = Math.min(_factor, 1);

		const result = { ob: progressStyle.ob, cb: progressStyle.cb,
			done: { fg: [ ... progressStyle.done.fg ],
				bg: [ ... progressStyle.done.bg ],
				char: progressStyle.done.char },
			todo: { fg: [ ... progressStyle.todo.fg ],
				bg: [ ... progressStyle.todo.bg ],
				char: progressStyle.todo.char },
			value: {} };

		result.value.text = String.none() + (result.value.percent =
			Math.round(result.factor = _factor * 100,
				DEFAULT_ROUND)).toFixed(DEFAULT_ROUND).info(true).
					pad(Erase.getPercentStringMax(DEFAULT_ROUND),
						' ', true).bold(true) + '%'.error(true) +
							String.none();
		if(_width_add > 0) result.value.width = _width_add;
		else result.value.width = (console.width -
			result.value.text.textLength + _width_add);
		result.value.done = Math._round(_factor * result.value.width);
		result.value.todo = (result.value.width - result.value.done);

		const doneChar = (process.ansi ? ' ' : result.done.char);
		const todoChar = (process.ansi ? ' ' : result.todo.char);

		result.bar = (result.ob.warn(true).faint(true) +
			doneChar.repeat(result.value.done).
				fg(... result.done.fg, false).
				bg(... result.done.bg, false) +
			todoChar.repeat(result.value.todo).
				fg(... result.todo.fg, false).
				bg(... result.todo.bg, false) +
			String.none() + result.cb.warn(true).faint(true));
		result.result = result.value.text + ' ' + result.bar;
		
		if(_seq)
		{
			result.result = '\r' + String.clearLine() +
				result.result + String.none();
		}
		
		if(_full)
		{
			return result;
		}
		
		return result.result;
	}

	//
	unlinkItems(_callback)
	{
		const total = this.unlink;

		if(total === 0)
		{
			return _callback(0);
		}

		var rest = total, open = 0, done = 0;
		var list = this.rmList, state = 0;
		
		const updateProgressBar = (_factor) => {
			if(!process.ansi) return;
			process.stdout.write(
				Erase.progressBar(_factor));
		};

		const removeProgressBar = () => {
			if(!process.ansi) return;
			process.stdout.write('\r' +
				String.clearLine());
		};
		
		const rmCallback = (_path, _err) => {
			--open; ++done; --rest;

			if(_err)
			{
				this.pushError(_err, _path);
			}

			updateProgressBar(done / total);

			if(rest <= 0 && open <= 0)
			{
				removeProgressBar();
				_callback(total);
			}
			else setImmediate(() => {
				if(list !== null) nextItem(); });
		};

		const nextItem = () => {
			if(list === null)
			{
				return;
			}

			if(state === 0 && list.length === 0)
			{
				if((list = this.rmdirList).length > 0)
				{
					state = 1;
				}
				else
				{
					state = 2;
				}
			}

			if(state === 1 && list.length === 0)
			{
				list = null;
				state = 2;
			}

			if(state === 2)
			{
				return;
			}

			if(open < this.parallel)
			{
				++open; const item = list.shift();
				fs.rm(item, { recursive: (state > 0) },
					(... _a) => rmCallback(item, ... _a));
			}
		
			if(open < this.parallel)
			{
				setImmediate(() => nextItem());
			}
		};

		nextItem();
	}
	
	get unlink()
	{
		if(!this.delete) return 0;
		return (this.rm + this.rmdir);
	}

	static getPercentStringMax(_round = DEFAULT_ROUND)
	{
		var result = 3;
		
		if(_round > 0)
		{
			result += (_round + 1);
		}
		
		return result;
	}

	//
	static get parameters()
	{
		return [
			[ 'delete', 'Delete everything when finished', '--delete', 'regular' ],
			[ 'random', 'Use random data, instead of zero\'s', '--random', '' ],
			[ 'iterations', 'Iterations (multiple overwrites)', '--iterations', '' ],
			[ 'chmod', 'Target file mode/permissions', '--chmod', 'regular' ],
			[ 'parallel', 'Parallel writes (async, not threads)', '--parallel', 'regular' ],
			[ 'buffer', 'Buffer/chunk size', '--buffer', '' ]
		];
	}
	
	static get regularParameters()
	{
		const parameters = this.parameters;
		const result = [];
		
		for(var i = 0, j = 0; i < parameters.length; ++i)
		{
			if(!parameters[i][3] || parameters[i][3] === 'regular')
			{
				result[j++] = parameters[i];
			}
		}
		
		return result;
	}
	
	static get regularVariables()
	{
		return [
			//[ 'errors', 'All errors which occured until now' ],
			[ 'count', 'All files we effectively overwrite' ],
			[ 'size', 'Size of all real files together' ],
			[ 'bytes', 'Data we effectively write (w/ iterations)' ],
			[ 'depth', 'Maximum depth on traversing directories' ],
			[ 'rm', 'Files selected for deletion (unlink)' ],
			[ 'rmdir', 'Directories for full deletion, from command line' ],
			[ 'found', 'All found items in file system, including non-regular ones' ],
			[ 'empty', 'Empty files (won\'t get overwritten, of course)' ],
			[ 'ignored', 'Non-regular files, like symbolic links (ignored)' ],
			[ 'prohibited', 'Items not below current worling directory' ],
			[ 'multiple', 'Items selected multiple times (counted only once)' ]
		];
	}

	get rm()
	{
		if(this.delete)
		{
			return this.rmList.length;
		}

		return 0;
	}

	get rmdir()
	{
		if(this.delete)
		{
			return this.rmdirList.length;
		}

		return 0;
	}

	get errors()
	{
		return this.errorList.length;
	}

	//
	getBuffer(_size, _callback)
	{
		if(this.random)
		{
			return crypt.getRandomBytes(_size, _callback);
		}

		const result = new Uint8Array(_size);

		if(func(_callback))
		{
			_callback(null, result);
		}

		return result;
	}
}

export default Erase;

//

