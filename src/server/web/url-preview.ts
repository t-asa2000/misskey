import * as Router from '@koa/router';
import summaly from '../../misc/summaly';
import fetchMeta from '../../misc/fetch-meta';
import Logger from '../../services/logger';
import config from '../../config';
import { query } from '../../prelude/url';
import fetch from 'node-fetch';
import { getAgentByUrl } from '../../misc/agent';

const logger = new Logger('url-preview');

module.exports = async (ctx: Router.RouterContext) => {
	if (config.disableUrlPreview) {
		ctx.body = '{}';
		return;
	}

	const meta = await fetchMeta();

	logger.info(meta.summalyProxy
		? `(Proxy) Getting preview of ${ctx.query.url}@${ctx.query.lang} ...`
		: `Getting preview of ${ctx.query.url}@${ctx.query.lang} ...`);

	try {
		const summary = meta.summalyProxy ? await getSummalyProxy(`${meta.summalyProxy}?${query({
			url: ctx.query.url,
			lang: ctx.query.lang || 'ja-JP'
		})}`) : await summaly(ctx.query.url);

		logger.succ(`Got preview of ${ctx.query.url}: ${summary.title}`);

		summary.icon = wrap(summary.icon);
		summary.thumbnail = wrap(summary.thumbnail);

		// Cache 7days
		ctx.set('Cache-Control', 'max-age=604800');

		ctx.body = summary;
	} catch (e) {
		logger.error(`Failed to get preview of ${ctx.query.url}: ${e}`);
		ctx.status = 200;

		ctx.set('Cache-Control', 'max-age=3600');

		ctx.body = '{}';
	}
};

function wrap(url: string): string {
	return url != null
		? url.match(/^https?:\/\//)
			? `${config.url}/proxy/preview.jpg?${query({
				url,
				preview: '1'
			})}`
			: url
		: null;
}

export async function getSummalyProxy(url: string) {
	const res = await fetch(url, {
		headers: {
			'User-Agent': config.userAgent,
			Accept: 'application/json, */*'
		},
		timeout: 30000,	// たしかsummaly側多かった気がした
		agent: getAgentByUrl(new URL(url), false, true),
	});

	if (!res.ok) {
		throw {
			name: `StatusError`,
			statusCode: res.status,
			message: `${res.status} ${res.statusText}`,
		};
	}

	return await res.json();
}
