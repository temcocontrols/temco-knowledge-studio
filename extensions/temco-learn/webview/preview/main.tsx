// The project view: one project on the site, as a real page rather than a page drawn by string concatenation.
//
// It reads the same `projects.json` every other page reads, finds the project named in `?id=`, and draws three things a
// reader wants from a product page: what this is, which versions exist, and the pages of the newest one. Fluent UI does
// the controls and the accessibility; the Azure theme does the colour; nothing here knows about VS Code.

import * as React from 'react';
import {
	Badge,
	Body1,
	Button,
	Caption1,
	Card,
	Divider,
	FluentProvider,
	Link,
	Subtitle1,
	Subtitle2,
	Text,
	Title1,
	Title2,
	makeStyles,
	tokens
} from '@fluentui/react-components';
import { createRoot } from 'react-dom/client';
import { forScheme } from './theme';
import './preview.css';

interface SitePage {
	href: string;
	title: string;
}

interface SiteVersion {
	version: string;
	builtAt?: string;
	pages?: SitePage[];
}

interface SiteProject {
	id: string;
	title: string;
	summary?: string;
	section?: string;
	builtAt?: string;
	latest?: string;
	versions?: SiteVersion[];
}

interface Site {
	projects: SiteProject[];
}

const SECTIONS: { id: string; title: string }[] = [
	{ id: 'documentation', title: 'Documentation' },
	{ id: 'training', title: 'Training & Labs' },
	{ id: 'tests', title: 'Tests' },
	{ id: 'products', title: 'Products' },
	{ id: 'qa', title: 'Q&A' },
	{ id: 'topics', title: 'Topics' }
];

const sectionTitleOf = (id: string | undefined): string =>
	SECTIONS.find((entry) => entry.id === id)?.title ?? SECTIONS[0].title;

/** `Test1 docs` reads as `Test1`: the build's own title keeps the word, the page does not need it. */
const shortName = (title: string): string => title.replace(/\s+docs?$/iu, '').trim() || title;

const plural = (count: number, one: string): string => `${count} ${count === 1 ? one : `${one}s`}`;

/** `just now`, `2 hours ago` — the words a reader uses, from an ISO date. */
function since(iso: string | undefined): string {
	const then = Date.parse(String(iso));
	if (Number.isNaN(then)) {
		return 'an unknown time';
	}
	const minutes = Math.floor((Date.now() - then) / 60000);
	if (minutes < 1) {
		return 'just now';
	}
	if (minutes < 60) {
		return `${minutes} min ago`;
	}
	const hours = Math.floor(minutes / 60);
	if (hours < 24) {
		return hours === 1 ? '1 hour ago' : `${hours} hours ago`;
	}
	const days = Math.floor(hours / 24);
	return days === 1 ? 'yesterday' : `${days} days ago`;
}

const param = (name: string): string | null => new URLSearchParams(location.search).get(name);

const sectionLink = (id: string): string => (id === SECTIONS[0].id ? 'index.html' : `index.html?section=${encodeURIComponent(id)}`);
const readerLink = (project: SiteProject, version: string, page?: string): string => {
	const query = new URLSearchParams({ id: project.id, version });
	if (page !== undefined) {
		query.set('page', page);
	}
	return `reader.html?${query.toString()}`;
};
const pageHref = (project: SiteProject, version: string, page: SitePage): string =>
	`${encodeURIComponent(project.id)}/${encodeURIComponent(version)}/${page.href}`;

const useStyles = makeStyles({
	page: { minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: tokens.colorNeutralBackground1 },
	bar: {
		display: 'flex',
		alignItems: 'center',
		gap: tokens.spacingHorizontalM,
		padding: `${tokens.spacingVerticalS} clamp(16px, 3vw, 40px)`,
		borderBottomWidth: '1px',
		borderBottomStyle: 'solid',
		borderBottomColor: tokens.colorNeutralStroke2
	},
	brand: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, fontWeight: tokens.fontWeightSemibold },
	mark: {
		display: 'grid',
		placeItems: 'center',
		width: '22px',
		height: '22px',
		borderRadius: tokens.borderRadiusSmall,
		backgroundColor: tokens.colorBrandBackground,
		color: tokens.colorNeutralForegroundInverted,
		fontSize: tokens.fontSizeBase100,
		fontWeight: tokens.fontWeightBold
	},
	hero: {
		padding: `clamp(28px, 4vw, 48px) clamp(16px, 3vw, 40px) ${tokens.spacingVerticalXL}`,
		display: 'flex',
		flexDirection: 'column',
		gap: tokens.spacingVerticalM
	},
	crumbs: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, color: tokens.colorNeutralForeground3 },
	facts: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS, flexWrap: 'wrap' },
	main: {
		flex: 1,
		padding: `0 clamp(16px, 3vw, 40px) ${tokens.spacingVerticalXXXL}`,
		display: 'flex',
		flexDirection: 'column',
		gap: tokens.spacingVerticalL
	},
	versions: { display: 'grid', gap: tokens.spacingHorizontalM, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' },
	versionCard: { display: 'flex', flexDirection: 'column', gap: tokens.spacingVerticalS, alignItems: 'flex-start' },
	versionHead: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalS },
	pages: {
		display: 'grid',
		gap: tokens.spacingVerticalXS,
		gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
		margin: 0,
		padding: 0,
		listStyleType: 'none'
	},
	pageLink: { display: 'flex', alignItems: 'center', gap: tokens.spacingHorizontalXS, minHeight: '32px' },
	sectionTitle: { display: 'flex', alignItems: 'baseline', gap: tokens.spacingHorizontalS, marginTop: tokens.spacingVerticalL },
	foot: {
		display: 'flex',
		gap: tokens.spacingHorizontalL,
		padding: `${tokens.spacingVerticalM} clamp(16px, 3vw, 40px) ${tokens.spacingVerticalXXL}`,
		color: tokens.colorNeutralForeground3
	},
	spacer: { flex: 1 },
	empty: {
		display: 'flex',
		flexDirection: 'column',
		gap: tokens.spacingVerticalM,
		padding: `${tokens.spacingVerticalXXL} clamp(16px, 3vw, 40px)`,
		color: tokens.colorNeutralForeground2
	}
});

const styles = () => useStyles();

function Bar({ project }: { project?: SiteProject }) {
	const s = useStyles();
	return (
		<header className={s.bar}>
			<Link className={s.brand} href="index.html">
				<span className={s.mark} aria-hidden="true">
					T
				</span>
				<span>Temco Learn</span>
			</Link>
			<span className={s.spacer} />
			{project === undefined ? undefined : (
				<Caption1>
					{sectionTitleOf(project.section)} · {plural((project.versions ?? []).length, 'version')}
				</Caption1>
			)}
		</header>
	);
}

function Foot() {
	const s = useStyles();
	return (
		<footer className={s.foot}>
			<Caption1>Temco Learn · Temco Controls</Caption1>
			<span className={s.spacer} />
			<Link href="https://forums.temcocontrols.com/" target="_blank" rel="noopener noreferrer">
				Forum
			</Link>
			<Link href="https://github.com/temcocontrols" target="_blank" rel="noopener noreferrer">
				GitHub
			</Link>
		</footer>
	);
}

function ProjectView({ project }: { project: SiteProject }) {
	const s = useStyles();
	const versions = project.versions ?? [];
	const latest = project.latest ?? versions[0]?.version;
	const newest = versions.find((entry) => entry.version === latest) ?? versions[0];
	const pages = newest?.pages ?? [];

	return (
		<>
			<Bar project={project} />
			<div className={s.hero}>
				<nav className={s.crumbs} aria-label="Breadcrumb">
					<Link href="index.html">Temco Learn</Link>
					<Text aria-hidden="true">›</Text>
					<Link href={sectionLink(project.section ?? SECTIONS[0].id)}>{sectionTitleOf(project.section)}</Link>
					<Text aria-hidden="true">›</Text>
					<Text>{shortName(project.title)}</Text>
				</nav>
				<Title1 as="h1">{shortName(project.title)}</Title1>
				{project.summary === undefined || project.summary === '' ? undefined : <Body1>{project.summary}</Body1>}
				<div className={s.facts}>
					<Badge appearance="tint" color="brand">
						{plural(versions.length, 'version')}
					</Badge>
					{latest === undefined ? undefined : <Badge appearance="outline">Latest {latest}</Badge>}
					{project.builtAt === undefined ? undefined : <Caption1>Updated {since(project.builtAt)}</Caption1>}
				</div>
			</div>
			<main className={s.main}>
				<div className={s.sectionTitle}>
					<Subtitle1 as="h2">Versions</Subtitle1>
					<Caption1>Every version a project keeps stays readable.</Caption1>
				</div>
				{versions.length === 0 ? (
					<Card>
						<Body1>This project has no versions on the site yet.</Body1>
					</Card>
				) : (
					<div className={s.versions}>
						{versions.map((version) => (
							<Card key={version.version} className={s.versionCard}>
								<div className={s.versionHead}>
									<Subtitle2>{version.version}</Subtitle2>
									{version.version === latest ? <Badge appearance="tint" color="brand">Latest</Badge> : undefined}
								</div>
								<Caption1>
									{plural((version.pages ?? []).length, 'page')}
									{version.builtAt === undefined ? '' : ` · built ${since(version.builtAt)}`}
								</Caption1>
								<Button appearance="primary" as="a" href={readerLink(project, version.version)}>
									Read
								</Button>
							</Card>
						))}
					</div>
				)}
				<Divider />
				<div className={s.sectionTitle}>
					<Subtitle1 as="h2">Pages in {newest === undefined ? 'this project' : newest.version}</Subtitle1>
					<Caption1>{plural(pages.length, 'page')}</Caption1>
				</div>
				{pages.length === 0 ? (
					<Body1>This version has no pages yet.</Body1>
				) : (
					<ul className={s.pages}>
						{pages.map((page) => (
							<li key={page.href}>
								<Link className={s.pageLink} href={newest === undefined ? readerLink(project, latest ?? '') : pageHref(project, newest.version, page)}>
									{page.title}
								</Link>
							</li>
						))}
					</ul>
				)}
			</main>
			<Foot />
		</>
	);
}

function Missing({ id }: { id: string | null }) {
	const s = useStyles();
	return (
		<>
			<Bar />
			<div className={s.empty}>
				<Title1 as="h1">This project is not on the site</Title1>
				<Body1>
					{id === null ? 'The address names no project.' : `The site has no project called “${id}”.`} A project appears here as
					soon as one of its builds is added.
				</Body1>
				<Button appearance="primary" as="a" href="index.html">
					Back to Documentation
				</Button>
			</div>
			<Foot />
		</>
	);
}

function App() {
	const [state, setState] = React.useState<{ projects: SiteProject[] }>({ projects: [] });
	const [loaded, setLoaded] = React.useState(false);

	React.useEffect(() => {
		let live = true;
		const empty: Site = { projects: [] };
		fetch('projects.json', { cache: 'no-store' })
			.then((response) => (response.ok ? (response.json() as Promise<Site>) : empty))
			.then((data) => {
				if (live) {
					setState({ projects: Array.isArray(data.projects) ? data.projects : [] });
					setLoaded(true);
				}
			})
			.catch(() => {
				if (live) {
					setLoaded(true);
				}
			});
		return () => {
			live = false;
		};
	}, []);

	const id = param('id');
	const project = state.projects.find((entry) => entry.id === id);

	React.useEffect(() => {
		if (!loaded) {
			return;
		}
		document.title =
			project === undefined ? 'Not on the site · Temco Learn' : `${shortName(project.title)} · Temco Learn`;
	}, [loaded, project]);

	if (!loaded) {
		return <Text>Loading…</Text>;
	}
	return project === undefined ? <Missing id={id} /> : <ProjectView project={project} />;
}

const host = document.getElementById('root');
if (host === null) {
	throw new Error('The page has no #root to mount the project view in.');
}
createRoot(host).render(
	<FluentProvider theme={forScheme()}>
		<App />
	</FluentProvider>
);
