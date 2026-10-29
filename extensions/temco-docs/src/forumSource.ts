/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Temco Controls. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// The forum, read from the community site itself.
//
// The forum at `forums.temcocontrols.com` is Discourse, and Discourse answers in JSON when a page addresses it with
// `.json`: `site.json` lists the categories, a category's address lists its topics with the figures its own table shows
// (replies, views, last activity, who is in it), and a topic's address carries the posts — the discussion history.
//
// This file is the only place that speaks that vocabulary. Everything above it works in the catalog's rows
// (`store.ts`), so no surface parses JSON and no view has to know what a "bumped_at" is.

import * as vscode from 'vscode';
import { ForumCategoryInput, ForumPostInput, ForumPoster, ForumTopicInput } from './store';

/** The site the forum lives on, when nobody has said otherwise. */
export const DEFAULT_FORUM_URL = 'https://forums.temcocontrols.com';

/** One answer, whether the site gave what was asked for or why it could not. */
export type SiteAnswer<T> = { ok: true; body: T } | { ok: false; note: string };

/** Where the forum is, without a trailing slash. Read every time, so a setting change needs no reload. */
export function forumBase(): string {
	const configured = vscode.workspace.getConfiguration('temcoDocs').get<string>('forumUrl');
	const url = typeof configured === 'string' && configured.trim().length > 0 ? configured.trim() : DEFAULT_FORUM_URL;
	return url.replace(/\/+$/, '');
}

/** A topic's own address, which is what "open on the forum" means. */
export function topicUrl(topic: { id: number; slug: string }): string {
	return `${forumBase()}/t/${topic.slug}/${topic.id}`;
}

/** A category's address, which is what a triager opens when the cache is not enough. */
export function categoryUrl(category: { id: number; slug: string }): string {
	return `${forumBase()}/c/${category.slug}/${category.id}`;
}

/** The site's own *Topics* list, which is what "the forum" means when no category is chosen. */
export function latestUrl(): string {
	return `${forumBase()}/latest`;
}

/** Fetches one JSON answer. A refusal is a sentence, never a thrown error: the caller shows it. */
export async function readJson<T>(url: string): Promise<SiteAnswer<T>> {
	let response: Response;
	try {
		response = await fetch(url, {
			headers: { accept: 'application/json', 'user-agent': 'temco-platform' },
			signal: AbortSignal.timeout(20_000)
		});
	} catch (error) {
		return { ok: false, note: `${forumBase()} could not be reached (${messageOf(error)})` };
	}
	if (!response.ok) {
		return { ok: false, note: `the forum answered ${response.status} ${response.statusText} for ${url}` };
	}
	try {
		return { ok: true, body: (await response.json()) as T };
	} catch (error) {
		return { ok: false, note: `the forum's answer could not be read (${messageOf(error)})` };
	}
}

/** The categories, as `site.json` lists them — the left column of the forum, in its own order. */
export interface SiteCategories {
	categories: ForumCategoryInput[];
}

interface SiteJson {
	categories?: {
		id?: number;
		slug?: string;
		name?: string;
		color?: string;
		parent_category_id?: number | null;
		topic_count?: number;
		post_count?: number;
	}[];
}

export async function readCategories(): Promise<SiteAnswer<ForumCategoryInput[]>> {
	const answer = await readJson<SiteJson>(`${forumBase()}/site.json`);
	if (!answer.ok) {
		return answer;
	}
	const listed = answer.body.categories;
	if (!Array.isArray(listed)) {
		return { ok: false, note: 'the forum returned no category list' };
	}
	const categories = listed
		.filter((category) => typeof category.id === 'number' && typeof category.slug === 'string')
		.map((category, index) => ({
			id: Number(category.id),
			slug: String(category.slug),
			name: String(category.name ?? category.slug),
			// Discourse stores the colour without the hash; a page needs a colour, not a number.
			color: typeof category.color === 'string' && category.color.length > 0 ? `#${category.color.replace(/^#/, '')}` : undefined,
			parentId: typeof category.parent_category_id === 'number' ? category.parent_category_id : undefined,
			topics: Number(category.topic_count ?? 0),
			posts: Number(category.post_count ?? 0),
			position: index
		}));
	if (categories.length === 0) {
		return { ok: false, note: 'the forum returned an empty category list' };
	}
	return { ok: true, body: categories };
}

/** A topic as the list carries it, and the people in it as the list's own `users` array names them. */
interface CategoryJson {
	topic_list?: { topics?: TopicJson[] };
	users?: { id?: number; username?: string; name?: string }[];
}

interface TopicJson {
	id?: number;
	slug?: string;
	title?: string;
	excerpt?: string;
	posts_count?: number;
	reply_count?: number;
	views?: number;
	created_at?: string;
	last_posted_at?: string | null;
	pinned?: boolean;
	closed?: boolean;
	category_id?: number;
	posters?: { user_id?: number; description?: string }[];
}

/** The topics of one category, newest activity first — the same order the site's own table shows. */
export async function readCategoryTopics(category: { id: number; slug: string }): Promise<SiteAnswer<ForumTopicInput[]>> {
	return readTopics(`${forumBase()}/c/${category.slug}/${category.id}.json`, category.id, category.slug);
}

/** The site's own *Topics* list: everything, newest activity first, across every category. */
export async function readLatestTopics(): Promise<SiteAnswer<ForumTopicInput[]>> {
	return readTopics(`${latestUrl()}.json`, undefined, 'the latest topics');
}

async function readTopics(url: string, categoryId: number | undefined, where: string): Promise<SiteAnswer<ForumTopicInput[]>> {
	const answer = await readJson<CategoryJson>(url);
	if (!answer.ok) {
		return answer;
	}
	const listed = answer.body.topic_list?.topics;
	if (!Array.isArray(listed)) {
		return { ok: false, note: `the forum returned no topics for ${where}` };
	}
	const people = new Map<number, ForumPoster>();
	for (const user of answer.body.users ?? []) {
		if (typeof user.id === 'number' && typeof user.username === 'string') {
			people.set(user.id, { username: user.username, name: typeof user.name === 'string' ? user.name : undefined });
		}
	}
	const topics = listed
		.filter((topic) => typeof topic.id === 'number' && typeof topic.title === 'string')
		.map((topic) => ({
			id: Number(topic.id),
			categoryId: typeof topic.category_id === 'number' ? topic.category_id : categoryId ?? 0,
			slug: String(topic.slug ?? String(topic.id)),
			title: String(topic.title),
			excerpt: typeof topic.excerpt === 'string' ? topic.excerpt : undefined,
			posts: Number(topic.posts_count ?? 0),
			// The forum's own table counts replies, not posts: a topic with one post has nothing to read yet.
			replies: Math.max(0, Number(topic.posts_count ?? 0) - 1),
			views: Number(topic.views ?? 0),
			createdAt: typeof topic.created_at === 'string' ? topic.created_at : undefined,
			lastPostedAt: typeof topic.last_posted_at === 'string' ? topic.last_posted_at : undefined,
			pinned: topic.pinned === true,
			closed: topic.closed === true,
			posters: (topic.posters ?? [])
				.map((poster) => (typeof poster.user_id === 'number' ? people.get(poster.user_id) : undefined))
				.filter((poster): poster is ForumPoster => poster !== undefined)
		}));
	if (topics.length === 0) {
		return { ok: false, note: `the forum returned an empty topic list for ${where}` };
	}
	return { ok: true, body: topics };
}

interface TopicPageJson {
	id?: number;
	slug?: string;
	title?: string;
	category_id?: number;
	posts_count?: number;
	reply_count?: number;
	views?: number;
	created_at?: string;
	last_posted_at?: string | null;
	pinned?: boolean;
	closed?: boolean;
	post_stream?: { posts?: PostJson[] };
}

interface PostJson {
	id?: number;
	post_number?: number;
	username?: string;
	name?: string;
	created_at?: string;
	cooked?: string;
	reply_to_post_number?: number | null;
}

/** One topic, and every post a reader would scroll through. */
export async function readTopic(
	topic: { id: number; slug: string }
): Promise<SiteAnswer<{ topic: ForumTopicInput; posts: ForumPostInput[] }>> {
	const answer = await readJson<TopicPageJson>(`${forumBase()}/t/${topic.slug}/${topic.id}.json`);
	if (!answer.ok) {
		return answer;
	}
	const page = answer.body;
	const listed = page.post_stream?.posts;
	if (!Array.isArray(listed)) {
		return { ok: false, note: `the forum returned no posts for topic ${topic.id}` };
	}
	const posts = listed
		.filter((post) => typeof post.id === 'number' && typeof post.post_number === 'number')
		.map((post) => ({
			id: Number(post.id),
			postNumber: Number(post.post_number),
			username: typeof post.username === 'string' ? post.username : undefined,
			name: typeof post.name === 'string' ? post.name : undefined,
			createdAt: typeof post.created_at === 'string' ? post.created_at : undefined,
			cooked: typeof post.cooked === 'string' ? post.cooked : undefined,
			replyTo: typeof post.reply_to_post_number === 'number' ? post.reply_to_post_number : undefined
		}))
		.sort((a, b) => a.postNumber - b.postNumber);
	return {
		ok: true,
		body: {
			topic: {
				id: Number(page.id ?? topic.id),
				categoryId: Number(page.category_id ?? 0),
				slug: String(page.slug ?? topic.slug),
				title: String(page.title ?? `Topic ${topic.id}`),
				posts: Number(page.posts_count ?? posts.length),
				replies: Math.max(0, Number(page.posts_count ?? posts.length) - 1),
				views: Number(page.views ?? 0),
				createdAt: typeof page.created_at === 'string' ? page.created_at : undefined,
				lastPostedAt: typeof page.last_posted_at === 'string' ? page.last_posted_at : undefined,
				pinned: page.pinned === true,
				closed: page.closed === true,
				posters: []
			},
			posts
		}
	};
}

function messageOf(error: unknown): string {
	return error instanceof Error ? error.message : String(error);
}
