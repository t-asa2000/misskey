import * as http from 'http';
import * as https from 'https';
import CacheableLookup from 'cacheable-lookup';
import fetch from 'node-fetch';
import { HttpProxyAgent, HttpsProxyAgent } from 'hpagent';
import config from '../config';
import { AbortController } from 'abort-controller';
import Logger from '../services/logger';

const logger = new Logger('fetch');

type GetOptions = {
	accept?: string;
	timeout?: number;
	authorization?: string;
};

export async function getJson(url: string, opts?: GetOptions) {
	const headers: Record<string, string> = {
		'User-Agent': config.userAgent,
		Accept: opts?.accept || 'application/json, */*',
	};
	if (opts?.authorization) headers.Authorization = opts.authorization;

	const res = await getResponse({
		url,
		method: 'GET',
		headers,
		timeout: opts?.timeout || 10 * 1000,
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

export async function getHtml(url: string, opts?: GetOptions) {
	const headers: Record<string, string> = {
		'User-Agent': config.userAgent,
		Accept: opts?.accept || 'application/json, */*',
	};
	if (opts?.authorization) headers.Authorization = opts.authorization;

	const res = await getResponse({
		url,
		method: 'GET',
		headers,
		timeout: opts?.timeout || 10 * 1000,
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

//#region Agent
const cache = new CacheableLookup({
	maxTtl: 3600,	// 1hours
	errorTtl: 30,	// 30secs
	lookup: false,	// nativeのdns.lookupにfallbackしない
});

/**
 * Get http non-proxy agent
 */
const _http = new http.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: cache.lookup,	// DefinitelyTyped issues
} as http.AgentOptions);

/**
 * Get https non-proxy agent
 */
const _https = new https.Agent({
	keepAlive: true,
	keepAliveMsecs: 30 * 1000,
	lookup: cache.lookup,
} as https.AgentOptions);

const maxSockets = Math.max(256, config.deliverJobConcurrency || 128);

/**
 * Get http proxy or non-proxy agent
 */
export const httpAgent = config.proxy
	? new HttpProxyAgent({
		keepAlive: true,
		keepAliveMsecs: 30 * 1000,
		maxSockets,
		maxFreeSockets: 256,
		scheduling: 'lifo',
		proxy: config.proxy
	})
	: _http;

/**
 * Get https proxy or non-proxy agent
 */
export const httpsAgent = config.proxy
	? new HttpsProxyAgent({
		keepAlive: true,
		keepAliveMsecs: 30 * 1000,
		maxSockets,
		maxFreeSockets: 256,
		scheduling: 'lifo',
		proxy: config.proxy
	})
	: _https;

/**
 * Get agent by URL
 * @param url URL
 * @param bypassProxy Allways bypass proxy
 */
export function getAgentByUrl(url: URL, bypassProxy = false): http.Agent | https.Agent {
	if (bypassProxy) {
		return url.protocol == 'http:' ? _http : _https;
	} else {
		return url.protocol == 'http:' ? httpAgent : httpsAgent;
	}
}
//#endregion Agent
