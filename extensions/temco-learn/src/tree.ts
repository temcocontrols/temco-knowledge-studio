// The site's tree: the panel beside the pages.
//
// It never asks for anything. Every row is a place that exists: a section of the site, a product, a version, or one of
// the three things that change the folder (a build, adding a build, a publish). The site folder is shown as the Site
// row's description — a fact to read, not a question to answer — and changing it is a command in the view's title.
//
// The rows read the same manifests the pages are written from, so the panel and the site cannot disagree about what
// exists.

import * as vscode from 'vscode';
import { SECTIONS, SiteProduct, sectionHref, since } from './portal';
import { readProducts } from './site';

export const VIEW_ID = 'temcoLearn.panel';

/** A row that also knows which group or product it belongs to, so its children can be drawn. */
interface Row extends vscode.TreeItem {
	group?: 'site' | 'products' | 'build' | 'publish';
	product?: SiteProduct;
}

/** A group: always expanded, because this panel is the site's index rather than a menu that hides things. */
function group(label: string, id: 'site' | 'products' | 'build' | 'publish', mark: string, description?: string): Row {
	const item: Row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.Expanded);
	item.id = `temcoLearn.group.${id}`;
	item.iconPath = new vscode.ThemeIcon(mark);
	item.description = description;
	item.group = id;
	return item;
}

export class SiteTree implements vscode.TreeDataProvider<Row>, vscode.Disposable {
	private readonly changed = new vscode.EventEmitter<void>();
	readonly onDidChangeTreeData = this.changed.event;

	private products: SiteProduct[] | undefined;

	constructor(private readonly root: () => string | undefined) { }

	refresh(): void {
		this.products = undefined;
		this.changed.fire();
	}

	dispose(): void {
		this.changed.dispose();
	}

	getTreeItem(item: Row): vscode.TreeItem {
		return item;
	}

	async getChildren(item?: Row): Promise<Row[]> {
		const products = await this.read();
		if (item === undefined) {
			return [
				group('Site', 'site', 'globe', this.root()),
				group('Products', 'products', 'book', products.length === 0 ? 'nothing published yet' : String(products.length)),
				group('Build', 'build', 'tools'),
				group('Publish', 'publish', 'cloud-upload')
			];
		}
		if (item.product !== undefined) {
			return this.versions(item.product);
		}
		switch (item.group) {
			case 'site':
				return this.sections(products);
			case 'products':
				return products.length === 0
					? [this.row('products.none', 'No product yet', 'a build becomes a product when it is added', 'add', 'temcoLearn.assemble')]
					: products.map((product) => this.product(product));
			case 'build':
				return [
					this.row('build.run', 'Build the documentation', 'runs the open project’s own build', 'play', 'temcoLearn.build'),
					this.row('build.add', 'Add a build to the site…', 'copies a dist folder in as a product version', 'add', 'temcoLearn.assemble')
				];
			case 'publish':
				return [
					this.row('publish.pages', 'Publish to GitHub Pages', 'the site folder’s repository, on gh-pages', 'cloud-upload', 'temcoLearn.publish'),
					this.row('publish.newest', 'Newest build', this.newest(products), 'history', 'temcoLearn.preview')
				];
			default:
				return [];
		}
	}

	private async read(): Promise<SiteProduct[]> {
		const root = this.root();
		if (root === undefined) {
			return [];
		}
		if (this.products === undefined) {
			this.products = await readProducts(root);
		}
		return this.products;
	}

	/** The six sections, in the order the site draws them: the panel and the tabs are the same list. */
	private sections(products: readonly SiteProduct[]): Row[] {
		return SECTIONS.map((section) => {
			const held = products.filter((product) => product.section === section.id).length;
			const item: Row = new vscode.TreeItem(section.title, vscode.TreeItemCollapsibleState.None);
			item.id = `temcoLearn.section.${section.id}`;
			item.description = held === 0 ? 'nothing yet' : `${String(held)} ${held === 1 ? 'product' : 'products'}`;
			item.iconPath = new vscode.ThemeIcon(held === 0 ? 'circle-slash' : 'link');
			item.tooltip = section.desc;
			item.command = { command: 'temcoLearn.preview', title: section.title, arguments: [{ page: sectionHref(section) }] };
			return item;
		});
	}

	private product(product: SiteProduct): Row {
		const item: Row = new vscode.TreeItem(product.title, vscode.TreeItemCollapsibleState.Expanded);
		item.id = `temcoLearn.product.${product.id}`;
		item.description = `latest ${product.latest}`;
		item.iconPath = new vscode.ThemeIcon('book');
		item.tooltip = product.summary ?? product.title;
		item.contextValue = 'temcoLearn.product';
		item.product = product;
		return item;
	}

	private versions(product: SiteProduct): Row[] {
		return product.versions.map((version) => {
			const latest = version === product.latest;
			const item: Row = new vscode.TreeItem(version, vscode.TreeItemCollapsibleState.None);
			item.id = `temcoLearn.version.${product.id}.${version}`;
			item.description = latest ? (product.builtAt === undefined ? 'latest' : `latest · ${since(product.builtAt)}`) : 'earlier';
			item.iconPath = new vscode.ThemeIcon('tag');
			item.tooltip = `Read ${product.title} ${version}`;
			item.command = {
				command: 'temcoLearn.preview',
				title: 'Read this version',
				arguments: [{ page: `${encodeURIComponent(product.id)}/${encodeURIComponent(version)}/temco-reader.html` }]
			};
			return item;
		});
	}

	/** The newest build on the site, said in words: the one fact a publishing panel can prove. */
	private newest(products: readonly SiteProduct[]): string {
		const built = products
			.filter((product) => product.builtAt !== undefined)
			.sort((one, other) => String(other.builtAt).localeCompare(String(one.builtAt)))[0];
		return built === undefined ? 'nothing built yet' : `${built.title} ${built.latest} · ${since(built.builtAt)}`;
	}

	private row(key: string, label: string, note: string, mark: string, command: string): Row {
		const item: Row = new vscode.TreeItem(label, vscode.TreeItemCollapsibleState.None);
		item.id = `temcoLearn.${key}`;
		item.description = note;
		item.iconPath = new vscode.ThemeIcon(mark);
		item.tooltip = `${label} — ${note}`;
		item.command = { command, title: label };
		return item;
	}
}
