
import * as Fastify from 'fastify';
import fastifyStatic from 'fastify-static';
import pointOfView from 'point-of-view';
const httpSignature = require('http-signature');
import * as path from 'path';
import * as pug from 'pug';
import cors from 'fastify-cors';
import fetchMeta from '../misc/fetch-meta';
import { buildMeta } from '../misc/build-meta';
import { fromHtml } from '../mfm/from-html';
import config from '../config';
import { sendBase } from './h';
import api from './api';
const htmlescape = require('htmlescape');

export default async (server: Fastify.FastifyInstance, opts: Fastify.FastifyPluginOptions, done: (err?: Error) => void) => {
	const client = `${__dirname}/../client/`;

	console.log(client);
	server.register(fastifyStatic, {
		root: `${client}/assets`,
		prefix: '/assets/',
		maxAge: 7 * 86400 * 1000,
	});

	server.register(pointOfView, {
		engine: {
			pug: pug
		},
		root: path.join(__dirname, '../../src/server/web/views'),
		viewExt: 'pug'
	});




	server.register(api, {
		prefix: '/api'
	});

	server.get('/', sendBase);

	done();
};
