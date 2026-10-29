// The site's script runs in a browser, and the module's own build is a Node program: this is the one place the DOM types
// are asked for. It is a declaration file so nothing is emitted, and the served script stays free of the directive.
/// <reference lib="dom" />
