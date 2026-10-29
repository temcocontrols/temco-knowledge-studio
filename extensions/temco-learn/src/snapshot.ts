// The one read both surfaces draw from.
//
// The panel and the Overview page answer the same three questions — what is on the website, what is waiting, and where
// it goes — so they read one shape, once. Two readers of two shapes is how a panel and a page start disagreeing.

import { Build } from './builds';
import { ProjectArtifacts } from './artifacts';
import { Site } from './site';
import { PublishedState } from './state';

export interface Snapshot {
	site: Site;
	builds: Build[];
	/** What each project's last build wrote: the site, the help file, the pdf, the exports. */
	artifacts: ProjectArtifacts[];
	published: PublishedState;
}
