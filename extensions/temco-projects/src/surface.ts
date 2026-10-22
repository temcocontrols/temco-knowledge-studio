// The pages this module opens, as view types.
//
// They are this module's own pages, opened by its own commands, under its own prefix — which is also what the
// shared "which column" rule recognises as one of ours. The *Projects* list and the project **hub** are both gone:
// the Library lists what exists, and opening a project shows that project's pages.

export const PROJECT_VIEW_TYPE = 'temcoProjects.project';

/** The list of every project. Opened from the Projects view's title bar, never by clicking a row. */
export const PROJECTS_PAGE_VIEW_TYPE = 'temcoProjects.projectsPage';
