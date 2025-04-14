/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://norbert.com.es/
 */

//
const DEFAULT_PARAM_SCHEME_JSON = '../../json/param/erase.json';
const DEFAULT_CODE = 'erase!';//(null) disables this. ..
const DEFAULT_SIMULATE = 60;//(int>0) for setTimeout();
const DEFAULT_ROUND = 1;

//
import Application from '../shared/app.js';
import Parameter from '../shared/param.js';
import Quant from '../shared/quant.js';
import crypt from '../shared/crypt.js';
import FileSystem from '../shared/fs.js';
import path from 'node:path';
import fs from 'node:fs';

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
			var entry = null, found = false, stats;

			for(var i = 0; i < this.param.length; ++i)
			{
				if(pathname(this.param[i]))
				{
					found = true;
					entry = this.param.splice(i--, 1)[0];

					try
					{
						stats = fs.lstatSync(entry);
					}
					catch(_err)
					{
						entry = null;
						continue;
					}

					if(stats.isDirectory())
					{
						entry = path.resolve(entry);
						break;
					}
					else
					{
						entry = null;
					}
				}
			}

			if(entry)
			{
				this.path = entry;
			}
			else
			{
				if(found)
				{
					console.error('None of your arguments is an existing directory.');
				}
				else
				{
					console.error('You need to define the entry point directory.');
				}

				return this.destroy(null, true);
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
			this.start();
		}, path.join(this.param.get('script'),
			DEFAULT_PARAM_SCHEME_JSON), this.param);
	}
	
	destroy(_name, _code = 0, ... _args)
	{
		super.destroy();
		this.destroying = true;
		this.exitAllowed = true;
		process.exit(_code);
	}

	getBuffer(_size, _callback)
	{
		if(this.random)
		{
			return crypt.getRandomBytes(
				_size, _callback);
		}

		const result = new Uint8Array(_size);

		if(func(_callback))
		{
			_callback(null, result);
		}

		return result;
	}

	start()
	{
		//
		process.stdin.resume();

		//
		this.list = [];
		this.links = [];
		this.directories = [];
		this.files = 0;
		this.errors = [];
		this.openDirectories = 0;
		this.found = {
			files: 0,
			directories: 0,
			links: 0,
			other: 0
		};
		this.done = 0;
		this.bytes = 0;
		this.size = null;
		this.max = [ 0, 0, 0 ];
		
		this.add = Erase.simulate;

		//
		this.intro();

		//
		this.findFiles(this.path);
	}

	findFiles(_path = this.path)
	{
		const readdirCallback = (_err, _files) => {
			if(_err)
			{
				throw _err;
			}

			var p; for(var i = 0; i < _files.length; ++i)
			{
				p = path.join(_path, _files[i].name);

				if(_files[i].isSymbolicLink())
				{
					this.links.push(p);
					++this.found.links;
				}
				else if(_files[i].isDirectory())
				{
					++this.found.directories;
					this.directories.push(p);
					this.findFiles(p);
				}
				else if(_files[i].isFile())
				{
					if(p = this.prepareFile(p))
					{
						++this.found.files;
						this.list.push(p);
					}
				}
				else
				{
					++this.found.other;
				}
			}

			if(--this.openDirectories <= 0)
			{
				++this.found.directories;
				this.directories.unshift(this.path);
				this.LIST = [ ... this.list ];
				delete this.openDirectories;
				this.prepare();
			}
		};

		++this.openDirectories;
		fs.readdir(_path, {
			encoding: 'utf8',
			withFileTypes: true,
			recursive: false },
				readdirCallback);
	}

	prepare()
	{
		if(this.found.files === 0 &&
			this.found.links === 0 &&
			this.found.directories === 1)
		{
			console.warn('Nothing to delete found in ' +
				this.found.directories.toLocaleString().
					error(true).bold(true) +
				' directories.');
			return this.destroy();
			//process.exit();
		}
		else
		{
			console.info(('Entry point: ' +
				this.path.warn(true).
				inverse(true)).bold(true));
			console.eol();
		}

		this.size = Math.size.styled(
			this.bytes).error(true) + (this.bytes >= 1024 ?
				(' (' + this.bytes.toLocaleString() + ' Bytes)').
					warn(true) : '');
		this.max[2] = this.size.textLength;

		console.info('Found ' + this.found.files.toLocaleString().
			warn(true).bold(true) + ' files in ' +
			this.found.directories.toLocaleString().
			warn(true).bold(true) + ' directories: ' +
			this.size.error(true));
		if(this.found.links > 0) console.info('Additionally there are also ' +
			this.found.links.toLocaleString().warn(true).bold(true) + ' symbolic links.' + EOL);
		if(this.found.other > 0) console.info('Plus ' +
			this.found.other.toLocaleString().bold(true).warn(true) +
			' other entries..');

		//
		console.confirm('Do you really want to continue'.error(true),
			(_answer) => {
				if(!_answer)
				{
					console.error('Aborted by you.');
					return this.destroy(null, true);
				}

				if(string(DEFAULT_CODE, false)) console.prompt('OK, then '.warn(true) + 'please confirm'.
					error(true) + ' by typing "'.warn(true) +
					DEFAULT_CODE.warn(true).inverse(true) + '"'.warn(true),
						(_answer) => {
							if(_answer !== DEFAULT_CODE)
							{
								console.error('Doesn\'t match, so we abort here.');
								return this.destroy(null, true);
							}

							console.eol(); return this.erase();
						});
				else console.confirm('Are you '.warn(true) + 'really'.error(true).bold(true) + ' sure' + ''.debug(false),
					(_answer) => { if(!_answer) { console.error('So we\'re aborting here.');
						return this.destroy(null, true); } console.eol(); return this.erase(); });
			});
	
		return true;
	}

	get fin()
	{
		return (this.list.length === 0 && this.open.length === 0 && this.active === 0);
	}

	//
	finish()
	{
		//
		console.eol();

		//
		if(!this.delete)
		{
			console.warn(('Due to ' + '--delete'.error(true) + ', we do ' +
				'not'.underline(true) +
				' delete the whole thing..!').bold(true) + EOL);
			return this.summary();
		}

		//
		console.info('Now we\'re removing the whole directory structure' +
			' (with all files etc. in it).');
	
		if(Erase.simulate === null)
		{
			fs.rmSync(this.path, {
				recursive: true });
		}
	
		console.warn('Done.'.bold(true) + EOL);
		return this.summary();
	}

	summary()
	{
		console.eol();

		if(this.files > 0)
		{
			const add = (this.bytes < 1024 ? '' :
				(' (' + this.bytes.toLocaleString() + ' Bytes)').debug(true));
			console.info('Erased ' + this.files.toLocaleString().
				warn(true).bold(true) + ' files: ' +
					Math.size.styled(this.bytes).error(true) + add);
			console.info('Removed the whole structure below entry point: ' +
				this.found.directories.toLocaleString().bold(true).warn(true) +
				' directories.');
		}
		else
		{
			console.warn(EOL + 'No files erased.'.bold(true));
		}

		if(this.found.links > 0) console.debug('There were ' +
			this.found.links.toLocaleString().bold(true).info(true) +
			' symbolic links (which are gone now).');
		if(this.found.other > 0) console.debug('Plus ' +
			this.found.other.toLocaleString().bold(true).error(true) +
			' other entries..');
		console.info(EOL + 'Entry point was: ' +
			this.path.error(true).inverse(true));

		//
		return this.destroy();
	}

	getFileString(_file)
	{
		var result = path.relative(this.path, _file);
		const used = (this.max[0] + this.max[2] +
			Erase.getPercentStringMax(DEFAULT_ROUND) +
			this.getIterationsStringMax() + result.length);
		const diff = (used - console.width);
		const add = '... ';

		if(diff > 0)
		{
			result = result.substr(diff);
		}

		const idx = result.lastIndexOf(path.sep);

		if(idx > -1)
		{
			const dir = result.substr(0, idx + 1);
			const file = result.substr(idx + 1);
			result = dir.debug(true) + file.info(true);
		}
		else
		{
			result = result.info(true);
		}

		if(diff > 0)
		{
			result = add.defaultFG(true) + result;
		}

		if(!result.textLength)
		{
			result = '.'.info(true);
		}

		return result;
	}

	//
	status(_file)
	{
		const iterMax = this.getIterationsStringMax(false);
		const size = ('\t' + _file.size.warn(true).pad(this.max[1], ' ', true));
		const iter = (this.iterations > 1 ? (' ('.debug() + _file.iterations.toLocaleString().
			padStart(iterMax, ' ').bold(true).info(true) + ' / '.debug() +
			this.iterations.toLocaleString().padStart(iterMax, ' ').
			bold(true).error(true) + ')'.debug(true)) : '');
		return process.stdout.write(String.none() + '['.faint(true) +
			this.progress + ']'.faint(true) + ' ' + String.none() +
			_file.string.pad(this.max[0], ' ', true) + ' ' +
			size + iter + String.none() + EOL);
	}

	getIterationsStringMax(_full = true)
	{
		if(this.iterations === 1)
		{
			return 0;
		}

		if(!_full)
		{
			return this.iterations.toLocaleString().length;
		}

		const str = this.iterations.toLocaleString();
		return ((str.length * 2) + 10);
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
	get progress()
	{
		const from = (this.found.files * this.iterations);
		const percent = Math.round(this.done / from * 100, DEFAULT_ROUND);
		return (percent.toFixed(DEFAULT_ROUND).padStart(Erase.
			getPercentStringMax(DEFAULT_ROUND), ' ')).info(true) +
				'%'.error(true) + String.none();
	}
	
	static get parameters()
	{
		return [
			[ 'Delete everything', 'delete' ],
			[ 'Random data', 'random' ],
			[ 'Iterations', 'iterations' ],
			[ 'Parallel writes', 'parallel' ],
			[ 'Buffer/chunk size', 'buffer' ]
		];
	}

	intro()
	{
		//
		console.error(('WARNING'.inverse(true) + ': Flash/SSD drives could cause less security!'
			.bold(true)).underline(true));

		//
		if(Erase.simulate !== null)
                {
			console.error((('And everything\'s just ' +
				'simulated'.warn(true)).bold(true) +
				(' (see ' + 'DEFAULT_SIMULATE'.warn(true) + ')').
					debug(true) + '!'.bold(true)).underline(true));
                }
		
		//
		console.debug(EOL + '\t' + 'Parameters'.underline(true) + ':' + EOL);
		const param = Erase.parameters; var maxKeyLength = 0, len, pa;

		for(const p of param)
		{
			if((len = p[0].length) > maxKeyLength)
			{
				maxKeyLength = len;
			}
		}

		for(const p of param)
		{
			if(bool(pa = this[p[1]]))
			{
				pa = pa.toString(true);
			}
			else if(numeric(pa, true, false))
			{
				pa = pa.toLocaleString().warn(true);

				if(p[1] === 'buffer' && this.buffer >= 1024)
				{
					pa += ' ('.debug(true) +
						Math.size.styled(this.buffer).
							error(true) +
						')'.debug(true);
				}
			}
			else
			{
				pa = pa.warn(true);
			}

			console.debug(
				('['.faint(true) + p[0].bold(true) +
					']'.faint(true)).pad(
						maxKeyLength + 2, ' ', true) +
				' ' + pa.bold(true));
		}

		console.eol();
	}

	//
	//maybe(!!) also w/o '*Sync()'.. see '.parallel' then!
	//
	prepareFile(_path)
	{
		const stat = fs.statSync(_path, {
			bigint: false, throwIfNoEntry: false });
	
		if(!stat)
		{
			return null;
		}
		
		this.bytes += stat.size;
		
		const result = { iterations: 0,
			path: _path, string: this.getFileString(_path),
			stat, bytes: stat.size,
			size: Math.size.styled(stat.size).error(true) +
				(stat.size >= 1024 ? (' (' +
					stat.size.toLocaleString() + ' Bytes)').
						warn(true) : '') };

		var len;

		if((len = result.string.textLength) > this.max[0])
		{
			this.max[0] = len;
		}

		if((len = result.size.textLength) > this.max[1])
		{
			this.max[1] = len;
		}

		return result;
	}

	erase()
	{
		//
		if(this.found.files === 0)
		{
			return this.finish();
		}

		//
		this.open = [];
		this.active = 0;

		//
		const openFiles = () => { var file;
			while(this.active < this.parallel && this.list.length > 0)
				this.handle(
					this.list.shift(),
					() => setImmediate(() => {
						if(this.fin) this.finish();
						else openFiles(); }));
		};
		
		openFiles();
	}

	static get simulate()
	{
		if(int(DEFAULT_SIMULATE) && DEFAULT_SIMULATE > 0)
		{
			return DEFAULT_SIMULATE;
		}

		return null;
	}

	handle(_file, _callback)
	{
		//
		if(Erase.simulate === null)
		{
			_file.handle = fs.openSync(
				_file.path, 'rs+', 0o600);
		}
		else
		{
			_file.handle = null;
		}

		//
		this.open.push(_file);
		++_file.iterations;
		++this.active;
		
		//
		const finish = () => {
			if(_file.handle)
			{
				fs.closeSync(_file.handle);
				_file.handle = null;
			}

			++this.done; --this.active;
			this.open.remove(_file);
			this.status(_file);

			if(_file.iterations < this.iterations)
			{
				setImmediate(() => {
					this.handle(
						_file,
						_callback); });
			}
			else
			{
				++this.files;
				_callback(_file);
			}
		};

		if(_file.handle === null)
		{
			setTimeout(finish, this.add);
			this.add += Erase.simulate;
			return false;
		}

		var position = 0;
		var rest = _file.bytes;

		if(rest === 0)
		{
			return finish();
		}

		const getSize = () => Math.min(rest, this.buffer);

		//
		const writeCallback = (_err, _written, _buffer) => {
			if(_err)
			{
				throw _err;
			}

			position += _written;
			rest -= _written;

			if(rest <= 0)
			{
				return finish();
			}

			this.getBuffer(getSize(), bufferCallback);
		};

		const write = (_buffer) => {
			fs.write(
				_file.handle,
				_buffer,
				0,
				_buffer.length,
				position,
				writeCallback);
		};

		const bufferCallback = (_err, _buf) => {
			if(_err)
			{
				throw _err;
			}

			write(_buf);
		};

		this.getBuffer(getSize(), bufferCallback);
		return true;
	}
}

export default Erase;

//

