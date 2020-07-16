import define from '../../../define';
import * as tmp from 'tmp';
import * as fs from 'fs';
import { addFile } from '../../../../../services/drive/add-file';
import dateFormat = require('dateformat');
import Emoji from '../../../../../models/emoji';
import { pack } from '../../../../../models/drive-file';
import { promisify } from 'util';

export const meta = {
	tags: ['admin'],

	requireCredential: true as const,
	requireModerator: true,
};

export default define(meta, async (ps, user) => {

	const emojis = await Emoji.find({
		host: null
	});

	// Create temp file
	const [path, cleanup] = await new Promise<[string, any]>((res, rej) => {
		tmp.file((e, path, fd, cleanup) => {
			if (e) return rej(e);
			res([path, cleanup]);
		});
	});

	try {
		const stream = fs.createWriteStream(path, { flags: 'a' });
		const write = promisify(stream.write).bind(stream);

		await write(`name,url,category,aliases\n`);

		for (const emoji of emojis) {
			const content = `${emoji.name},${emoji.url},${emoji.category || ''},${emoji.aliases ? emoji.aliases.join(' ') : ''}`;
			await write(content + '\n');
		}

		stream.end();

		const fileName = 'emojis-' + dateFormat(new Date(), 'yyyy-mm-dd-HH-MM-ss') + '.csv';
		const driveFile = await addFile(user, path, fileName, undefined, undefined, true);
		return pack(driveFile);
	} finally {
		cleanup();
	}
});
