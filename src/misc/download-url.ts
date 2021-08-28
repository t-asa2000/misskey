import * as fs from 'fs';
import * as stream from 'stream';
import * as util from 'util';
import got from 'got';
import * as Got from 'got';
import { httpAgent, httpsAgent } from './fetch';
import config from '@/config/index';
import * as chalk from 'chalk';
import Logger from '@/services/logger';
const PrivateIp = require('private-ip');

const pipeline = util.promisify(stream.pipeline);

export async function downloadUrl(url: string, path: string) {
	const logger = new Logger('download');

	logger.info(`Downloading ${chalk.cyan(url)} ...`);

	const timeout = 30 * 1000;
	const operationTimeout = 60 * 1000;

	const req = got.stream(url, {
		headers: {
			'User-Agent': config.userAgent
		},
		timeout: {
			lookup: timeout,
			connect: timeout,
			secureConnect: timeout,
			socket: timeout,	// read timeout
			response: timeout,
			send: timeout,
			request: operationTimeout,	// whole operation timeout
		},
		agent: {
			http: httpAgent,
			https: httpsAgent,
		},
		retry: 0,
	}).on('response', (res: Got.Response) => {
		if ((process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'test') && !config.proxy && res.ip) {
			if (PrivateIp(res.ip)) {
				logger.warn(`Blocked address: ${res.ip}`);
				req.destroy();
			}
		}
	}).on('error', (e: any) => {
		if (e.name === 'HTTPError') {
			throw e.response?.statusCode;
		}
	});

	await pipeline(req, fs.createWriteStream(path));

	logger.succ(`Download finished: ${chalk.cyan(url)}`);
}
