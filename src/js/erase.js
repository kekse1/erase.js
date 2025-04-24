/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://norbert.com.es/
 */

//
const DEFAULT_PARAM_SCHEME_JSON = '../../json/param/erase.json';
const DEFAULT_CODE = 'erase!';
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
			const files = [];

			for(var i = 0, j = 0; i < this.param.length; ++i)
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
					}
					else if(stats.isSymbolicLink())
					{
						entry = null;
					}
					else if(stats.isFile())
					{
						files[j++] = path.resolve(entry);
						entry = null;
					}
					else
					{
						entry = null;
					}
				}
			}

			if(pathname(entry))
			{
				this.path = entry;

				if(files.length > 0)
				{
					console.warn('You also specified an entry ' + 'directory'.info(true).bold(true) + ', so ' +
						files.length.toLocaleString().bold(true).error(true) + ' files'.bold(true) + ' are ' +
						'ignored'.underline(true).error(true) + '!');
				}
			}
			else if(files.length > 0)
			{
				this.path = files;

				console.warn('You specified no (valid) entry ' +
					'directory'.underline(true) + ', but ' +
					files.length.toLocaleString().bold(true).error(true) +
					' existing ' + 'files'.underline(true) + '.');
			}
			else
			{
				if(found)
				{
					console.error('None of your arguments is an existing directory or file!');
				}
				else
				{
					console.error('You need to define the entry point directory or one or more files!');
				}

				return this.destroy(null, true);
			}

			//
			console.eol();
			this.warning();

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
		this.max = {	percent: Erase.getPercentStringMax(DEFAULT_ROUND),
				file: 0, size: 0, iterations: (this.iterations <= 1 ?
					0 : ((this.iterations.toLocaleString().length *
						2) + 6))	};

		//
		this.intro();

		//
		if(pathname(this.path))
		{
			this.findFiles(this.path);
		}
		else
		{
			this.useFiles(this.path);
		}
	}

	useFiles(_files = this.path)
	{
		delete this.openDirectories;

		var p; for(var i = 0; i < _files.length; ++i)
		{
			if(p = this.prepareFile(_files[i]))
			{
				++this.found.files;
				this.list.push(p);
			}
		}

		this.LIST = [ ... this.list ];
		this.prepare();
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
			this.found.directories === 0)
		{
			console.warn('Nothing for secure erasing found.');
			return this.destroy();
		}
		
		if(pathname(this.path))
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
		this.max.size = this.size.textLength;

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
			if(this.found.directories > 0)
			{
				console.warn(('Due to ' + '--delete'.error(true) + ', we do ' +
					'not'.underline(true) +
					' delete the whole thing..!').bold(true) + EOL);
			}
			else
			{
				console.warn(('Due to ' + '--delete'.error(true) + ', we do ' +
					'not'.underline(true) +
					' delete this ' + this.found.files.toLocaleString().bold(true).error(true) +
					' files..!'.warn(true)).bold(true) + EOL);
			}

			console.warn('All files are left with their original sizes ' +
				'in their ' + 'original locations'.underline(true).warn(true) + '!');
			console.info('They are just filled ' +
				'with ' + (this.random ? 'random data' : 'zeroes').bold(true).info(true) + ' now!');

			return this.summary();
		}
		
		if(this.found.directories === 0)
		{
			for(var i = 0; i < this.LIST.length; ++i)
			{
				fs.unlinkSync(
					this.LIST[i].path);
			}
		}
		else
		{
			console.info('Now we\'re removing the whole directory structure' +
				' (with all files etc. in it).');
	
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
		}
		else
		{
			console.warn(EOL + 'No files erased.'.bold(true));
		}
		
		if(this.delete)
		{
			if(this.found.links > 0) console.debug('There were ' +
				this.found.links.toLocaleString().bold(true).info(true) +
				' symbolic links (which are gone now).');
			if(this.found.other > 0) console.debug('Plus ' +
				this.found.other.toLocaleString().bold(true).error(true) +
				' other entries..');
		}

		if(pathname(this.path))
		{
			console.info(EOL + 'Entry point was: ' +
				this.path.error(true).inverse(true));
		}

		//
		return this.destroy();
	}

	getFileString(_file)
	{
		var result;

		if(pathname(this.path))
		{
			result = path.relative(this.path, _file);
		}
		else
		{
			result = path.relative(process.cwd(), _file);
		}
		
		return result;
	}
	
	static beautifyFileString(_string)
	{
		const idx = _string.lastIndexOf(path.sep);
		
		if(idx === -1)
		{
			return _string.warn(true);
		}
		
		const dir = _string.substr(0, idx);
		const base = _string.substr(idx + 1);

		return (dir.info(true) + '/' + base.warn(true).bold(true));
	}

	//
	status(_file)
	{
		const progress = '['.faint(true).defaultFG(true) +
			this.progress.pad(this.max.percent, ' ', true) +
			']'.faint(true).defaultFG(true);
		var size = _file.size.warn(true).pad(this.max.size, ' ', true);
		var iterations = (this.iterations <= 1 ? '' : '  ' +
			_file.iterations.toLocaleString().bold(true).info(true) +
			' / ' + this.iterations.toLocaleString().bold(true).error(true));
		if(iterations) iterations = iterations.pad(this.max.iterations, ' ', true);
		const sum = (progress.textLength + 1 +
			size.textLength + 1 +
			iterations.textLength + 1);
		var left = (console.width - sum);
		var file;

		if(_file.string.length < left)
		{
			file = Erase.beautifyFileString(_file.string) + ' ' +
				String.none() + ('.'.repeat(left -
					_file.string.length - 1)).
						bold(true).faint(true);
		}
		else
		{
			file = '... ' + Erase.beautifyFileString(
				_file.string.substr(_file.string.length -
					(left -= 4)));
		}

		const result = progress + ' ' + file + ' ' + size + ' ' + iterations;
		process.stdout.write(result + EOL);
		return result;
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

	warning()
	{
		//
		console.error(('WARNING'.inverse(true) + ': ' +
			'Flash/SSD drives could cause less security!'
				.bold(true)).underline(true));
	}

	intro()
	{
		//
		console.info(EOL + '\t' + 'Parameters'.underline(true) + ':' + EOL);
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
				('['.faint(true) + p[0] +
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
			size: Math.size.styled(stat.size).debug(true) +
				(stat.size >= 1024 ? (' (' +
					stat.size.toLocaleString().bold(true) + ' Bytes)'.faint(true)).
						defaultFG(true).faint(true) : '') };

		var len;

		if((len = result.string.textLength) > this.max.file)
		{
			this.max.file = len;
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

	handle(_file, _callback)
	{
		//
		fs.chmodSync(_file.path, 0o600);

		if(_file.bytes > 0)
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

			if(_file.bytes === 0)
			{
				++this.files;
				fs.chmodSync(_file.path, 0);
				return _callback(_file);
			}

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
				fs.chmodSync(_file.path, 0);
				_callback(_file);
			}
		};

		if(!_file.handle)
		{
			return finish();
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

