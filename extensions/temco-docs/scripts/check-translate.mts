// Translating a page must not translate the page's structure.
//
// The service is given sentences; the file it comes back into is the same file with new words. That property is the
// whole feature — a translated page whose code sample was "helpfully" translated is worse than an untranslated page —
// and it is invisible until someone reads the output. So it is asserted here instead, with a fake transport that
// answers in a way no real service would: it returns the text it was sent, so any change to the file is this module's
// doing and not the service's.
//
// Run by `npm run vscode:prepublish` in this module and by `npm run check-temco` from the repository root.

import { statSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

interface Segment {
	translate: boolean;
	text: string;
}

interface TranslateModule {
	LANGUAGES: readonly { tag: string; label: string }[];
	languageOf(tag: string): { tag: string; label: string } | undefined;
	segmentsOf(markdown: string): Segment[];
	reassemble(segments: readonly Segment[], translated: readonly string[]): string;
	translateMarkdown(markdown: string, options: TranslatorOptions): Promise<{ text?: string; sent: number; error?: string }>;
	translatedPath(pagePath: string, tag: string): string;
	httpsTransport: (request: TranslatorRequest) => Promise<{ status: number; body?: unknown; error?: string }>;
}

interface TranslatorRequest {
	url: string;
	headers: { [name: string]: string };
	body: string;
	timeout: number;
}

interface TranslatorOptions {
	endpoint: string;
	key: string;
	region?: string;
	to: string;
	timeout?: number;
	transport?: (request: TranslatorRequest) => Promise<{ status: number; body?: unknown; error?: string }>;
}

/** The built module, and a refusal to test a build that is older than the source it came from. */
const built = fileURLToPath(new URL('../out/translate.js', import.meta.url));
const source = fileURLToPath(new URL('../src/translate.ts', import.meta.url));
if (statSync(built).mtimeMs < statSync(source).mtimeMs) {
	console.error('out/translate.js is older than src/translate.ts — run `npm run compile` in this module first.');
	process.exit(1);
}
const { LANGUAGES, httpsTransport, languageOf, reassemble, segmentsOf, translateMarkdown, translatedPath } = createRequire(import.meta.url)(built) as TranslateModule;

let failures = 0;
function check(condition: boolean, message: string): void {
	if (!condition) {
		failures++;
		console.error(`  - ${message}`);
	}
}

/** A page with every kind of thing a page contains. */
const page = [
	'---',
	'title: Wiring the harness',
	'---',
	'',
	'# Wiring the harness',
	'',
	'This section explains how the harness is wired, in the order a technician follows.',
	'',
	'```ts',
	'const harness = connect(port); // hardware, not prose',
	'```',
	'',
	'| Step | What happens |',
	'| --- | --- |',
	'| 1 | Power on |',
	'',
	'Use `connect()` before `torque()` — see [the torque guide](https://example.com/torque).',
	'',
	'![The harness](media/harness.png)',
	'',
	'> A note that is prose too.',
	''
].join('\n');

const segments = segmentsOf(page);

// Round trip: with nothing translated, the file comes back byte for byte.
const identity = reassemble(segments, segments.filter((segment) => segment.translate).map((segment) => segment.text));
check(identity === page, 'putting a page back together untranslated must reproduce it exactly');

// The fenced sample is never sent.
const sentText = segments.filter((segment) => segment.translate).map((segment) => segment.text).join('\n');
check(!sentText.includes('const harness = connect(port)'), 'a fenced code sample must not be sent to the service');
check(!sentText.includes('```'), 'a code fence must not be sent to the service');
check(!sentText.includes('| --- | --- |'), 'a table rule must not be sent to the service');
check(!sentText.includes('https://example.com/torque'), 'a link target must not be sent to the service');
check(!sentText.includes('media/harness.png'), 'an image path must not be sent to the service');
check(!sentText.includes('title: Wiring the harness'), 'front matter must not be sent to the service');

// The prose is.
check(sentText.includes('This section explains how the harness is wired'), 'prose must be sent to the service');
check(sentText.includes('A note that is prose too.'), 'a blockquote\u2019s prose must be sent to the service');

// The fake service: answers with what it was given, once per segment, so structure alone is under test.
const answering = (status = 200) => async (request: { body: string }) => {
	const sent = (JSON.parse(request.body) as { Text: string }[]).map((item) => ({ translations: [{ text: item.Text }] }));
	return { status, body: sent };
};

const options: TranslatorOptions = {
	endpoint: 'https://api.cognitive.microsofttranslator.com/',
	key: 'k',
	to: 'de',
	transport: answering()
};

const translated = await translateMarkdown(page, options);
check(translated.error === undefined, `translating a page must not fail: ${translated.error}`);
check(translated.text === page, 'when the service echoes the text, the page must come back unchanged');
check(translated.sent > 0, 'something must have been sent');

// A real translation changes the words and nothing else: every preserved segment survives verbatim.
const upper = async (request: { body: string }) => {
	const sent = (JSON.parse(request.body) as { Text: string }[]).map((item) => ({ translations: [{ text: item.Text.toUpperCase() }] }));
	return { status: 200, body: sent };
};
const shouted = await translateMarkdown(page, { ...options, transport: upper });
check(shouted.text !== undefined && shouted.text.includes('const harness = connect(port);'), 'a translated page must keep its code sample exactly');
check(shouted.text !== undefined && shouted.text.includes('https://example.com/torque'), 'a translated page must keep its links exactly');
check(shouted.text !== undefined && shouted.text.includes('THIS SECTION EXPLAINS HOW THE HARNESS'), 'the prose must arrive translated');
check(shouted.text !== undefined && shouted.text.includes('| --- | --- |'), 'a translated page must keep its table rules exactly');

// The url, the key and the region are the service's terms, and each is checked because a wrong one is a 401 in the
// middle of a workflow rather than an error at the start.
let seen: { url: string; headers: { [name: string]: string } } | undefined;
await translateMarkdown(page, {
	...options,
	region: 'westeurope',
	transport: async (request) => {
		seen = { url: request.url, headers: request.headers };
		return answering()(request);
	}
});
check(seen !== undefined && seen.url === 'https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=de', 'the url must be the translate endpoint with the language, and no double slash');
check(seen !== undefined && seen.headers['Ocp-Apim-Subscription-Key'] === 'k', 'the key must travel in the subscription header');
check(seen !== undefined && seen.headers['Ocp-Apim-Subscription-Region'] === 'westeurope', 'a regional key must send its region');

// A key with no region must not send an empty header.
let bare: { [name: string]: string } | undefined;
await translateMarkdown(page, { ...options, transport: async (request) => { bare = request.headers; return answering()(request); } });
check(bare !== undefined && bare['Ocp-Apim-Subscription-Region'] === undefined, 'a global key must not send a region header');

// Every failure a person can meet is a sentence about what to do, not "translation failed".
const failuresByStatus: [number, string][] = [
	[401, 'Set the Translator Key'],
	[403, 'region'],
	[429, 'rate-limiting'],
	[500, 'answered 500']
];
for (const [status, expected] of failuresByStatus) {
	const failed = await translateMarkdown(page, { ...options, transport: answering(status) });
	check(failed.text === undefined, `a ${status} answer must not produce text`);
	check(failed.error !== undefined && failed.error.includes(expected), `a ${status} answer must say what to do (${expected})`);
}
const unreachable = await translateMarkdown(page, { ...options, transport: async () => ({ status: 0, error: 'timeout after 30000 ms' }) });
check(unreachable.error !== undefined && unreachable.error.includes('not reached'), 'an unreachable service must say so');

// A page with no prose costs nothing and says why.
const empty = await translateMarkdown('```\ncode only\n```\n', options);
check(empty.sent === 0, 'a page of code alone must not be sent');
check(empty.error !== undefined && empty.error.includes('no prose'), 'a page of code alone must explain itself');

// A service that answers with fewer segments than it was given must not punch holes in the page.
const short = await translateMarkdown(page, {
	...options,
	transport: async () => ({ status: 200, body: [{ translations: [{ text: 'Nur eins' }] }] })
});
check(short.error !== undefined, 'a short answer must be reported, not written');

// The sibling file keeps every relative image and link working.
check(translatedPath('docs/guide/setup.md', 'de') === 'docs/guide/setup.de.md', 'a translation is written beside the page');
check(translatedPath('docs/guide/setup', 'de') === 'docs/guide/setup.de', 'a page with no extension still gets one');

// The languages offered are tags the service accepts, and no tag is offered twice.
const tags = LANGUAGES.map((language) => language.tag);
check(new Set(tags).size === tags.length, 'no language may be offered twice');
check(languageOf('ZH-HANS') !== undefined, 'a language tag must match whatever its case');
check(languageOf('tlh') === undefined, 'a language this build does not offer must not be accepted');

// The transport is the only thing that touches the network, and it is replaceable — a check must never reach it.
check(typeof httpsTransport === 'function', 'the real transport must exist for the extension to use');

if (failures > 0) {
	console.error(`\n${failures} translation rules broken.`);
	process.exit(1);
}
console.log(`${segments.length} segments cut, ${segments.filter((segment) => segment.translate).length} sent, ${LANGUAGES.length} languages offered, structure preserved.`);
