/*
 * Copyright (c) Sebastian Kucharczyk <kuchen@kekse.biz>
 * https://norbert.com.es/
 */

//
import * as globals from '../shared/globals.js';
import * as server from '../shared/server.js';
import getopt from '../shared/getopt.js';
import Erase from './erase.js';

//
const param = getopt(true);
const erase = new Erase(param);

