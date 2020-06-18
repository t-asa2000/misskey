import User, { ILocalUser } from '../models/user';
import { createSystemUser } from './create-system-user';
import Emoji, { IEmoji } from '../models/emoji';
import { uploadFromUrl } from './drive/upload-from-url';
import getDriveFileUrl from '../misc/get-drive-file-url';

const ACTOR_USERNAME = 'system.1' as const;

export async function getSystem1(): Promise<ILocalUser> {
	const user = await User.findOne({
		host: null,
		username: ACTOR_USERNAME
	});

	if (user) return user as ILocalUser;

	const created = await createSystemUser(ACTOR_USERNAME);
	return created as ILocalUser;
}

export async function tryStockEmoji(emoji: IEmoji) {
	if (emoji.host == null) {
		//console.log(`islocal`);
		return;
	}

	if (emoji.saved && emoji.md5 != null) {
		//console.log(`saved`);
		return;
	}

	return await stockEmoji(emoji);
}

export async function stockEmoji(emoji: IEmoji) {
	const user = await getSystem1();
	const file = await uploadFromUrl(emoji.url, user, null, emoji.url, false, true);

	const url = getDriveFileUrl(file);

	if (!url) {
		//console.log(`!url`);
		return;
	}

	console.log(`saved remote emoji: ${emoji.url} => ${url}`);

	await Emoji.update({ _id: emoji._id }, {
		$set: {
			url,
			md5: file.md5,
			saved: true
		}
	});

	const emoji2 = await Emoji.findOne(emoji._id);
	if (!emoji2) return;

	const m = await Emoji.findOne({
		md5: emoji2.md5,
		host: null,
	});

	if (m) return;

	const copied = await Emoji.insert({
		updatedAt: new Date(),
		name: emoji2.name,
		host: null,
		aliases: [],
		url: emoji2.url,
		type: emoji2.type,
		md5: emoji2.md5
	});

	console.log(`copied emoji ${copied.name}`);
}
