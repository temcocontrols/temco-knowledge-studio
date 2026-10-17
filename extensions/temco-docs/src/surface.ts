// The view types this module's own pages open under — and the one page it still owns in the editor area, the form
// that creates a page.
//
// The Library, the dashboard and the needs page are the workbench's now, and the AI, the repositories and the
// projects pages are their modules'. What all of them share — which editor column a page of ours opens in — is
// the UI module's rule, re-exported at the bottom of this file so a call site in this module reads as it did.

export const NEW_PAGE_VIEW_TYPE = 'temcoDocs.newPage';

export { fileColumn, pageColumn } from './ui';
