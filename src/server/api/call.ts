import * as Router from '@koa/router';
import { performance } from 'perf_hooks';
import limiter from './limiter';
import { IUser } from '../../models/user';
import { IApp } from '../../models/app';
import endpoints from './endpoints';
import { ApiError } from './error';
import { apiLogger } from './logger';
import { toArray } from '../../prelude/array';
import activeUsersChart from '../../services/chart/active-users';
import config from '../../config';

const accessDenied = {
	message: 'Access denied.',
	code: 'ACCESS_DENIED',
	id: '56f35758-7dd5-468b-8439-5d6fb8ec9b8e'
};

export default async (endpoint: string, user: IUser | null | undefined, app: IApp | null | undefined, data: any, ctx?: Router.RouterContext) => {
	const isSecure = user != null && app == null;

	const ep = endpoints.find(e => e.name === endpoint);

	if (ep == null) {
		throw new ApiError({
			message: 'No such endpoint.',
			code: 'NO_SUCH_ENDPOINT',
			id: 'f8080b67-5f9c-4eb7-8c18-7f1eeae8f709',
			httpStatusCode: 404
		});
	}

	if (ep.meta.secure && !isSecure) {
		throw new ApiError(accessDenied);
	}

	if (ep.meta.requireCredential && user == null) {
		throw new ApiError({
			message: 'Credential required.',
			code: 'CREDENTIAL_REQUIRED',
			id: '1384574d-a912-4b81-8601-c7b1c4085df1',
			httpStatusCode: 401
		});
	}

	if (ep.meta.requireCredential && user!.isDeleted) {
		throw new ApiError(accessDenied, { reason: 'Your account has been deleted.' });
	}

	if (ep.meta.requireCredential && user!.isSuspended) {
		throw new ApiError(accessDenied, { reason: 'Your account has been suspended.' });
	}

	if (ep.meta.requireAdmin && !user!.isAdmin) {
		throw new ApiError(accessDenied, { reason: 'You are not the admin.' });
	}

	if (ep.meta.requireModerator && !user!.isAdmin && !user!.isModerator) {
		throw new ApiError(accessDenied, { reason: 'You are not a moderator.' });
	}

	if (app && ep.meta.kind && !app.permission.some(p => toArray(ep.meta.kind).includes(p))) {
		throw new ApiError({
			message: 'Your app does not have the necessary permissions to use this endpoint.',
			code: 'PERMISSION_DENIED',
			id: '1370e5b7-d4eb-4566-bb1d-7748ee6a1838',
		});
	}

	if (ep.meta.limit) {
		// Rate limit
		await limiter(ep, user, ctx?.ip).catch(e => {
			throw new ApiError({
				message: 'Rate limit exceeded. Please try again later.',
				code: 'RATE_LIMIT_EXCEEDED',
				id: 'd5826d14-3982-4d2e-8011-b9e9f02499ef',
				httpStatusCode: 429
			});
		});
	}

	if (ep.meta.canDenyPost && config.denyStatsPost && ctx?.method === 'POST') {
		throw new ApiError({
			message: 'Method Not Allowed',
			code: 'METHOD_NOT_ALLOWED',
			id: 'a80e8552-bc3c-4dd5-9682-869a825e3716',
			httpStatusCode: 405
		});
	}

	// Cast non JSON input
	if ((ep.meta.requireFile || ctx?.method === 'GET') && ep.meta.params) {
		for (const k of Object.keys(ep.meta.params)) {
			const param = ep.meta.params[k];
			if (['Boolean', 'Number'].includes(param.validator.name) && typeof data[k] === 'string') {
				try {
					data[k] = JSON.parse(data[k]);
				} catch (e) {
					throw	new ApiError({
						message: 'Invalid param.',
						code: 'INVALID_PARAM',
						id: '0b5f1631-7c1a-41a6-b399-cce335f34d85',
					}, {
						param: k,
						reason: `cannot cast to ${param.validator.name}`,
					})
				}
			}
		}
	}

	// API invoking
	const before = performance.now();
	return await ep.exec(data, user, app, ctx?.file).catch((e: Error) => {
		if (e instanceof ApiError) {
			throw e;
		} else {
			console.error(e);
			apiLogger.error(`Internal error occurred in ${ep.name}`, {
				ep: ep.name,
				ps: data,
				e: {
					message: e?.message,
					code: e?.name,
					stack: e?.stack
				}
			});
			throw new ApiError(null, {
				e: {
					message: e?.message,
					code: e?.name,
					stack: e?.stack
				}
			});
		}
	}).finally(() => {
		const after = performance.now();
		const time = after - before;
		if (time > 1000) {
			apiLogger.warn(`SLOW API CALL DETECTED: ${ep.name} user=${user?.username} (${time}ms)`);
		}

		if (user) activeUsersChart.update(user);
	});
};
