import fetch from 'node-fetch';
import { getAgentByUrl } from './agent';
import config from '../config';
import { AbortController } from 'abort-controller';
import Logger from '../services/logger';

const logger = new Logger('fetch');

export async function getJson(url: string, accept = 'application/json, */*', timeout = 10000, headers?: Record<string, string>) {
	const res = await getResponse({
		url,
		method: 'GET',
		headers: objectAssignWithLcKey({
			'User-Agent': config.userAgent,
			Accept: accept
		}, headers || {}),
		timeout
	});

	try {
		return await res.json();
	} catch (e) {
		throw {
			name: `JsonParseError`,
			statusCode: 481,
			message: `JSON parse error ${e.message || e}`
		};
	}
}

export async function getHtml(url: string, accept = 'text/html, */*', timeout = 10000, headers?: Record<string, string>) {
	const res = await getResponse({
		url,
		method: 'GET',
		headers: objectAssignWithLcKey({
			'User-Agent': config.userAgent,
			Accept: accept
		}, headers || {}),
		timeout
	});

	return await res.text();
}

export async function getResponse(args: { url: string, method: string, body?: string, headers: Record<string, string>, timeout?: number, size?: number }) {
	logger.debug(`${args.method.toUpperCase()} ${args.url}\nHeaders: ${JSON.stringify(args.headers, null, 2)}${args.body ? `\n${args.body}` : ''}`);

	const timeout = args?.timeout || 10 * 1000;

	const controller = new AbortController();
	setTimeout(() => {
		controller.abort();
	}, timeout * 6);

	const res = await fetch(args.url, {
		method: args.method,
		headers: args.headers,
		body: args.body,
		timeout,
		size: args?.size || 10 * 1024 * 1024,
		agent: getAgentByUrl,
		signal: controller.signal,
	});

	if (!res.ok) {
		throw {
			name: `StatusError`,
			statusCode: res.status,
			statusMessage: res.statusText,
			message: `${res.status} ${res.statusText}`,
		};
	}

	return res;
}

function lcObjectKey(src: Record<string, string>) {
	const dst: Record<string, string> = {};
	for (const key of Object.keys(src).filter(x => x != '__proto__' && typeof src[x] === 'string')) dst[key.toLowerCase()] = src[key];
	return dst;
}

function objectAssignWithLcKey(a: Record<string, string>, b: Record<string, string>) {
	return Object.assign(lcObjectKey(a), lcObjectKey(b));
}
