// A page as a Word document.
//
// Word's own format is a zip of XML, which is why this needs no dependency: the archive comes from `zip.ts`, and the body
// is WordprocessingML — paragraphs, runs, tables — generated from the *tokens* `marked` produces rather than from HTML.
// Tokens are the Markdown's own structure, so nothing here has to guess where a bold run ends.
//
// Scope, deliberately: headings, paragraphs with bold/italic/inline code, bullet and numbered lists, quotes, tables,
// pictures and rules. Not yet: hyperlinks, footnotes, a table of contents, and Word's own list numbering definitions
// (lists are indented paragraphs with a bullet character, which every reader shows correctly).

import { Marked, type Token, type Tokens } from 'marked';
import { ZippedFile, zip } from './zip';

/** One picture the document refers to: where it sits in the Markdown, and its bytes. */
export interface DocxPicture {
	/** The `src` as the Markdown writes it: `media/wiring.png`. */
	src: string;
	data: Uint8Array;
	/** Pixels, when known; the drawing ignores zero and falls back to a default width. */
	width: number;
	height: number;
}

export interface DocxOptions {
	title: string;
	markdown: string;
	pictures: DocxPicture[];
}

const EMU_PER_INCH = 914400;
const PAGE_TEXT_WIDTH = 6 * EMU_PER_INCH;

const marked = new Marked({ gfm: true });

/** Text for XML: the five characters that end a document, and nothing else that Word will misread. */
export function xmlText(text: string): string {
	return text
		.replace(/&/gu, '&amp;')
		.replace(/</gu, '&lt;')
		.replace(/>/gu, '&gt;')
		.replace(/"/gu, '&quot;')
		.replace(/'/gu, '&apos;');
}

/** The pixels a PNG declares, so a picture keeps its shape instead of being stretched to a guess. */
export function pngSize(data: Uint8Array): { width: number; height: number } | undefined {
	if (data.length < 24 || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4e || data[3] !== 0x47) {
		return undefined;
	}
	const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

/**
 * A page as a `.docx`, ready to write.
 *
 * `pictures` carries the bytes of the pictures the Markdown refers to; a picture whose file could not be read is written as
 * its caption, so a missing image never costs the reader the document.
 */
export function docx(options: DocxOptions): Buffer {
	const tokens = marked.lexer(options.markdown);
	const media: ZippedFile[] = [];
	const relationships: string[] = [];
	const bySrc = new Map<string, number>();
	let nextId = 2; // 1 is the styles part.

	const runs = (inline: Token[] | undefined): string => (inline ?? []).map(token => {
		switch (token.type) {
			case 'strong':
				return `<w:r><w:rPr><w:b/></w:rPr>${text((token as Tokens.Strong).tokens)}</w:r>`;
			case 'em':
				return `<w:r><w:rPr><w:i/></w:rPr>${text((token as Tokens.Em).tokens)}</w:r>`;
			case 'codespan':
				return `<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/><w:color w:val="1F2328"/></w:rPr><w:t xml:space="preserve">${xmlText((token as Tokens.Codespan).text)}</w:t></w:r>`;
			case 'br':
				return '<w:r><w:br/></w:r>';
			case 'link': {
				// The text is kept and the address after it in brackets: a reader can still follow it, and the document
				// stays free of relationship ids that only exist for hyperlinks.
				const link = token as Tokens.Link;
				return `${text(link.tokens)}<w:r><w:rPr><w:color w:val="0078D4"/></w:rPr><w:t xml:space="preserve"> (${xmlText(link.href)})</w:t></w:r>`;
			}
			case 'image':
				return picture(token as Tokens.Image);
			case 'text':
				return text((token as Tokens.Text).tokens ?? [token]);
			default:
				return 'text' in token ? `<w:r><w:t xml:space="preserve">${xmlText(String((token as Tokens.Text).text))}</w:t></w:r>` : '';
		}
	}).join('');

	function text(inline: readonly Token[]): string {
		return inline.map(token => {
			if (token.type === 'text') {
				const nested = (token as Tokens.Text).tokens;
				return nested === undefined
					? `<w:r><w:t xml:space="preserve">${xmlText((token as Tokens.Text).text)}</w:t></w:r>`
					: runs(nested as Token[]);
			}
			return runs([token]);
		}).join('');
	}

	function picture(token: Tokens.Image): string {
		const found = options.pictures.find(entry => entry.src === token.href);
		if (found === undefined) {
			return `<w:r><w:t xml:space="preserve">[${xmlText(token.text === '' ? token.href : token.text)}]</w:t></w:r>`;
		}
		let id = bySrc.get(found.src);
		if (id === undefined) {
			id = nextId++;
			bySrc.set(found.src, id);
			const name = `image${id}.png`;
			media.push({ name: `word/media/${name}`, data: found.data });
			relationships.push(`<Relationship Id="rId${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/${name}"/>`);
		}
		const ratio = found.width > 0 && found.height > 0 ? found.height / found.width : 0.5625;
		const cx = Math.min(PAGE_TEXT_WIDTH, 4 * EMU_PER_INCH);
		const cy = Math.round(cx * ratio);
		const name = `image${id}.png`;
		return `<w:r><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${cx}" cy="${cy}"/><wp:docPr id="${id}" name="Picture ${id}"/><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic><pic:nvPicPr><pic:cNvPr id="${id}" name="${name}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rId${id}"/></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${cx}" cy="${cy}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;
	}

	const paragraph = (content: string, style?: string, extra = ''): string =>
		`<w:p>${style === undefined && extra === '' ? '' : `<w:pPr>${style === undefined ? '' : `<w:pStyle w:val="${style}"/>`}${extra}</w:pPr>`}${content}</w:p>`;

	const blocks = (list: readonly Token[]): string[] => list.flatMap((token): string[] => {
		switch (token.type) {
			case 'heading': {
				const heading = token as Tokens.Heading;
				const level = Math.min(3, Math.max(1, heading.depth));
				return [paragraph(runs(heading.tokens), `Heading${level}`)];
			}
			case 'paragraph':
				return [paragraph(runs((token as Tokens.Paragraph).tokens))];
			case 'space':
				return [];
			case 'hr':
				return [paragraph('<w:r><w:t xml:space="preserve">──────</w:t></w:r>')];
			case 'code':
				return [paragraph(`<w:r><w:rPr><w:rFonts w:ascii="Consolas" w:hAnsi="Consolas"/></w:rPr><w:t xml:space="preserve">${xmlText((token as Tokens.Code).text)}</w:t></w:r>`, undefined, '<w:ind w:left="360"/>')];
			case 'blockquote': {
				const quote = token as Tokens.Blockquote;
				return blocksOf(quote.tokens).map(entry => entry.replace('<w:p>', '<w:p><w:pPr><w:ind w:left="480"/></w:pPr>'));
			}
			case 'list': {
				const list = token as Tokens.List;
				return list.items.map((item, index) => {
					const marker = list.ordered ? `${(Number(list.start) || 1) + index}. ` : '• ';
					const body = item.tokens.flatMap((inner): string[] =>
						inner.type === 'text' || inner.type === 'paragraph'
							? [runs((inner as Tokens.Text).tokens ?? [(inner as Tokens.Paragraph)])]
							: blocksOf([inner])
					).join('');
					return paragraph(`<w:r><w:t xml:space="preserve">${marker}</w:t></w:r>${body}`, undefined, '<w:ind w:left="360"/>');
				});
			}
			case 'table':
				return [table(token as Tokens.Table)];
			default:
				return [];
		}
	});

	/** The same walk, for the nested blocks of a quote or a list item. */
	function blocksOf(nested: readonly Token[]): string[] {
		return nested.flatMap(inner => {
			if (inner.type === 'text' || inner.type === 'paragraph') {
				return [paragraph(runs((inner as Tokens.Text).tokens ?? [(inner as Tokens.Paragraph)]))];
			}
			if (inner.type === 'list') {
				return blocks([inner]);
			}
			return blocks([inner]);
		});
	}

	function table(tableToken: Tokens.Table): string {
		const border = '<w:tblBorders><w:top w:val="single" w:sz="4" w:color="D1D9E0"/><w:left w:val="single" w:sz="4" w:color="D1D9E0"/><w:bottom w:val="single" w:sz="4" w:color="D1D9E0"/><w:right w:val="single" w:sz="4" w:color="D1D9E0"/><w:insideH w:val="single" w:sz="4" w:color="D1D9E0"/><w:insideV w:val="single" w:sz="4" w:color="D1D9E0"/></w:tblBorders>';
		const cell = (content: string) => `<w:tc><w:tcPr><w:tcW w:w="0" w:type="auto"/></w:tcPr>${paragraph(content)}</w:tc>`;
		const row = (cells: string[]) => `<w:tr>${cells.join('')}</w:tr>`;
		const header = row(tableToken.header.map(entry => cell(`<w:r><w:rPr><w:b/></w:rPr>${runs(entry.tokens)}</w:r>`)));
		const body = tableToken.rows.map(cells => row(cells.map(entry => cell(runs(entry.tokens))))).join('');
		const width = Math.floor(PAGE_TEXT_WIDTH / Math.max(1, tableToken.header.length));
		const grid = tableToken.header.map(() => `<w:gridCol w:w="${width}"/>`).join('');
		return `<w:tbl><w:tblPr><w:tblW w:w="0" w:type="auto"/>${border}</w:tblPr><w:tblGrid>${grid}</w:tblGrid>${header}${body}</w:tbl>`;
	}

	const document = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><w:body>${blocks(tokens).join('')}<w:sectPr><w:pgSz w:w="12240" w:h="15840"/><w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1440" w:header="720" w:footer="720" w:gutter="0"/></w:sectPr></w:body></w:document>`;

	const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/></Types>`;

	const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>`;

	const documentRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>${relationships.join('')}</Relationships>`;

	// The four styles the body asks for. Word's built-in ids are used, so a reader can restyle the document without it
	// losing the difference between a heading and a paragraph.
	const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Calibri" w:hAnsi="Calibri"/><w:sz w:val="22"/></w:rPr></w:rPrDefault></w:docDefaults><w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style><w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="360" w:after="120"/></w:pPr><w:rPr><w:b/><w:sz w:val="40"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="280" w:after="100"/></w:pPr><w:rPr><w:b/><w:sz w:val="32"/></w:rPr></w:style><w:style w:type="paragraph" w:styleId="Heading3"><w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style></w:styles>`;

	const created = new Date().toISOString().replace(/\.\d{3}Z$/u, 'Z');
	const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlText(options.title)}</dc:title><dcterms:created xsi:type="dcterms:W3CDTF">${created}</dcterms:created></cp:coreProperties>`;

	return zip([
		{ name: '[Content_Types].xml', data: Buffer.from(contentTypes, 'utf8') },
		{ name: '_rels/.rels', data: Buffer.from(rootRels, 'utf8') },
		{ name: 'word/document.xml', data: Buffer.from(document, 'utf8') },
		{ name: 'word/styles.xml', data: Buffer.from(styles, 'utf8') },
		{ name: 'word/_rels/document.xml.rels', data: Buffer.from(documentRels, 'utf8') },
		{ name: 'docProps/core.xml', data: Buffer.from(core, 'utf8') },
		...media
	]);
}
