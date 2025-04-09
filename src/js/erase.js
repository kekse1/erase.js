/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://norbert.com.es/
 */

//
const DEFAULT_PARAM_SCHEME_JSON = '../../json/param/erase.json';
const DEFAULT_CODE = null;//'erase!';
const DEFAULT_SIMULATE = 600;//(int>0) for setTimeout();
const DEFAULT_LENGTH_MAX = Math.min(console.width - 64, 64);

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
			var path = null, found = false, stats;

			for(var i = 0; i < this.param.length; ++i)
			{
				if(pathname(this.param[i]))
				{
					path = this.param.splice(i--, 1)[0];
					found = true;

					try
					{
						path = fs.realpathSync(path, {
							encoding: 'utf8' });
					}
					catch(_err)
					{
						path = null;
					}

					if(!path)
					{
						continue;
					}

					stats = fs.lstatSync(path);

					if(!stats.isDirectory())
					{
						path = null;
					}
				}
			}

			if(path)
			{
				this.path = path;
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
		//todo/ganz zuerst hinweis wg ssd/flash/...
		//todo/erst infos ueber aktuelle optionen (w/ .buffer @ math.size...);
		//todo/etc. ... bedenke:
		//	(b) .parallel wg. async open files
		//	(c) .iterations etc.. w/ *status*, etc.,
		//	(d) WICHTIG: ZWEIFACH PROMPT (YES/NO && '!erase')!!1
		//	(d) etc. pp..
		//

		//
		process.stdin.resume();

		//
		this.list = [];
		this.links = [];
		this.files = 0;
		this.errors = [];
		this.openDirectories = 0;
		this.found = {
			files: 0,
			directories: 0,
			links: 0 };
		this.done = 0;
		this.bytes = 0;
		this.size = null;
		this.max = [ 0, 0, 0 ];

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
				if(_files[i].isSymbolicLink())
				{
					this.links.push(path.join(_path, _files[i].name));
					++this.found.links;
				}
				else if(_files[i].isDirectory())
				{
					++this.found.directories;
					this.findFiles(path.join(
						_path, _files[i].name));
				}
				else if(_files[i].isFile())
				{
					p = path.join(_path, _files[i].name);

					try
					{
						p = fs.realpathSync(p, {
							encoding: 'utf8' });
					}
					catch(_err)
					{
						continue;
					}

					if(p = this.prepareFile(p))
					{
						++this.found.files;
						this.list.push(p);
					}
				}
			}

			if(--this.openDirectories <= 0)
			{
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
		if(this.found.files === 0 && this.found.links === 0)
		{
			console.warn('Nothing to delete found in ' +
				(this.found.directories + 1).toLocaleString().
					error(true).bold(true) +
				' directories.');
			process.exit();
		}

		this.size = Math.size.styled(
			this.bytes) + (this.bytes >= 1024 ?
				(' (' + this.bytes.toLocaleString() + ' Bytes)').debug(true) : '');
		this.max[2] = this.size.textLength;

		if(DEFAULT_LENGTH_MAX < this.max[2])
		{
			this.max[2] = DEFAULT_LENGTH_MAX;
		}

		console.info('Found ' + this.found.files.toLocaleString().
			warn(true).bold(true) + ' files in ' +
			(this.found.directories + 1).toLocaleString().
			warn(true).bold(true) + ' directories: ' +
			this.size.error(true));
		if(this.found.links > 0) console.info('Additionally there are also ' +
			this.found.links.toLocaleString().warn(true).bold(true) + ' symbolic links.' + EOL);

		//
		//todo/prompt (two times, w/ entry directory showing!);
		//if NOT accepted, `return false` (w/ rejection info)!
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

	deleteSymlinks(_callback)
	{
		if(this.links.length === 0)
		{
			return;
		}

		var rest = this.links.length;

		/*const status = (_index) => { --rest;
			process.stdout.write('\r' + String.clearLine() + 'Link '.debug(true) +
				(_index + 1).toLocaleString().bold(true).warn(true) +
				' / ' + this.links.length.toLocaleString().error(true).bold(true) +
				': ' + Math.round(_index / this.links.length * 100, 2).
				toString().info(true).bold(true) + '%' + (' (' +
				rest.toLocaleString().bold(true) + ' remaining)').debug(true));
			if(rest <= 0) { console.eol(); this.finish(); }};*/
		
		console.eol();
		console.debug('Now deleting ' + this.found.links.toLocaleString().
			bold(true).info(true) + ' symbolic links ' + '...' + EOL);

		var rest = this.links.length;
		const callback = (_link) => {
			this.status(_link);
			if(--rest <= 0) _callback(); };
		
		var add = 0; for(var i = 0; i < this.links.length; ++i)
		{
			const link = this.links[i];
			
			if(Erase.simulate === null)
			{
				fs.unlink(link, () => callback(link));
			}
			else
			{
				setTimeout(() => callback(link),
					Erase.simulate + add);
				add += Erase.simulate;
			}
		}
	}
	
	finish(_fin = this.fin)
	{
		if(!_fin)
		{
			return false;
		}

		console.eol();
		console.info('Now we\'re truncating each file to zero length.');
		console.eol();
		process.stdout.write(''.info(false));
		
		for(var i = 0; i < this.LIST.length; ++i)
		{
			fs.truncateSync(this.LIST[i].path, 0);
			this.status(this.LIST[i].path);
		}

		process.stdout.write(String.none());
		return this.deleteSymlinks(() => this.summary(_fin));
	}

	summary(_fin = this.fin)
	{
		if(!_fin)
		{
			return;
		}

		console.eol();

		if(this.files > 0)
		{
			const add = (this.bytes < 1024 ? '' :
				(' (' + this.bytes.toLocaleString() + ' Bytes)').debug(true));
			console.info('Erased ' + this.files.toLocaleString().
				warn(true).bold(true) + ' files: ' +
					Math.size.styled(this.bytes).error(true) + add);
			if(this.links.length > 0) console.info('And we also unlinked ' +
				this.links.length.toLocaleString().bold(true).warn(true) +
				' symbolic links.');
		}
		else
		{
			console.warn('No files erased.');
		}

		console.eol();
		console.debug('The original ' + 'directory'.bold(true) +
			' structure is ' + 'never'.error(true) + ' being removed!');
		console.warn('Please '.error(true) +
			'`' + 'rm -rf'.info(true) + ' ' +
			this.path.warn(true).bold(true) +'`.');

		//
		return this.destroy();
	}

	//
	status(_file, _ansi = String.none())
	{
		if(_ansi) process.stdout.write(_ansi);

		if(string(_file))
		{
			if(path.isAbsolute(_file))
			{
				_file = path.relative(
					this.path, _file);
			}
			
			return process.stdout.write('\t' +
				Erase.stylePath(_file) +
					String.none() + EOL);
		}

		const size = ('\t' + _file.size.warn(true).
			pad(this.max[1], ' ', true) +
			'\t' + this.progress);
		process.stdout.write('  ['.debug(true) + _ansi +
			Erase.stylePath(_file.relative).
			pad(this.max[0], ' ', true) +
			']'.debug(true) + size);

		if(_ansi) process.stdout.write(String.none());
		process.stdout.write(EOL);
	}

	static stylePath(_path)
	{
		const idx = _path.indexOf('/');

		if(idx === -1)
		{
			return _path.bold(true);
		}

		const dir = path.dirname(_path);
		const file = path.basename(_path);

		return (dir + path.sep + file.bold(true));
	}

	static getPercentMax(_round = 2)
	{
		var result = 3;
		
		if(_round > 0)
		{
			result += (_round + 1);
		}
		
		return result;
	}
	
	//
	//TODO/WITH(!) progress bar...!1
	//
	get progress()
	{
		if(!this.bytes) return '-/-'.debug(true);
		const percent = Math.round(this.done / this.bytes * 100, 2);
		var result = percent.toString().padStart(Erase.getPercentMax(2), ' ');
		result += '%'.error(true);
		return result;
	}
	
	info()
	{
		console.dir("info()");
	}

	prepareFile(_path)
	{
		const stat = fs.statSync(_path, {
			bigint: false, throwIfNoEntry: false });
	
		if(!stat)
		{
			return null;
		}
		
		this.bytes += stat.size;
		
		const result = {
			path: _path,
			relative: path.relative(this.path, _path),
			stat, bytes: stat.size,
			size: Math.size.styled(stat.size) + (stat.size >= 1024 ?
				(' (' + stat.size.toLocaleString() + ' Bytes)').debug(true) : '') };

		if(result.relative.length > this.max[0])
		{
			this.max[0] = result.relative.length;
		}

		if(DEFAULT_LENGTH_MAX < this.max[0])
		{
			this.max[0] = DEFAULT_LENGTH_MAX;
			result.relative = '...' + result.relative.substr(
				0, (DEFAULT_LENGTH_MAX - 3));
		}

		if(result.size.textLength > this.max[1])
		{
			this.max[1] = result.size.textLength;
		}

		if(DEFAULT_LENGTH_MAX < this.max[1])
		{
			this.max[1] = DEFAULT_LENGTH_MAX;
		}
		
		return result;
	}

	erase()
	{
		//
		this.open = [];
		this.active = 0;

		//
		const callback = (_file) => {
			++this.files;
			this.done += _file.bytes;
			this.status(_file);
			return setImmediate(() => {
				if(this.fin) this.finish();
				else openFiles();
			});
		};

		const openFiles = () => { var file;
			while(this.active < this.parallel && this.list.length > 0)
			{
				file = this.list.shift();

				if(Erase.simulate === null)
				{
					file.handle = fs.openSync(
						file.path, 'r+', 0o600);
					this.open.push(file);
				}
				else
				{
					file.handle = null;
				}

				this.write(file, callback);
			}};
		
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

	write(_file, _callback)
	{
		++this.active;
		
		//
		//todo/*real* status.. BELOW somewhere.. w/ progress; etc.
		//
		const finish = () => {
			if(_file.handle)
			{
				fs.closeSync(_file.handle);
				_file.handle = null;
			}

			--this.active;
			this.open.remove(_file);
			_callback(_file);
		};

		if(_file.handle === null)
		{
			//hab's hier weil spaeter eh geloscht..!1
			if(! ('add' in this))
			{
				this.add = 0;
			}

			setTimeout(finish, Erase.simulate + this.add);
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
		//todo/*real* status - also w progress!1
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

