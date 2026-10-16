# Content package

The content package is the contract between a build engine and `temco-learn`. The site reads packages and never names an engine, so any engine can be replaced without touching the site.

## Shape

One package per product **and version**:

```text
t3000/13.0/
├── manifest.json          required — what this is and what it was built from
├── nav.json               required — the navigation model
├── pages/                 required — the articles
│   ├── index.md
│   └── getting-started/install.md
├── assets/                images and page assets
├── downloads/             the published artifacts
│   ├── t3000-13.0.pdf
│   ├── t3000-13.0.chm
│   └── t3000-13.0-source.zip
└── search-index.json      optional — a pre-built index for this package
```

A package may also carry pre-rendered HTML beside the markdown. When it does, the site serves it; when it does not, the site renders the markdown itself. That is what makes the engine optional rather than required.

## manifest.json

| Field | Required | Meaning |
|---|---|---|
| `schemaVersion` | yes | the version of this contract |
| `product` | yes | the product id, matching its folder and its entry in `products.json` |
| `title` | yes | the display name |
| `version` | yes | the product version this package documents |
| `language` | yes | the content language |
| `builtAt` | yes | when the package was produced |
| `engine` | yes | which engine produced it and its version — informational, never branched on |
| `sourceCommit` | yes | the commit of the product repository this content describes |
| `pages` | yes | the page list: id, path, title, section |
| `nav` | yes | the reference to `nav.json` |
| `downloads` | no | the artifacts in `downloads/`, with size and date |
| `xref` | no | the cross-reference map, where the engine produces one |
| `search` | no | the reference to `search-index.json` |

## nav.json

```json
{
  "items": [
    {
      "title": "Getting started",
      "path": "pages/getting-started/install.md",
      "children": [
        { "title": "Requirements", "path": "pages/getting-started/requirements.md" }
      ]
    },
    { "title": "API", "path": "pages/api/index.md", "children": [] }
  ]
}
```

Every `path` resolves to a file in the package. Every page in `pages/` is reachable from `nav.json`, and everything reachable is in `nav.json`. The order in the file is the order on the site; the site never sorts.

## Versions

Each version is a real package. `latest` is an alias the site resolves from the version list, never a copied tree, so it cannot drift. Retiring a version removes its folder; the other versions' URLs do not move.

## Validation

A package is rejected when:

- a required manifest field is missing, or `schemaVersion` is unknown;
- a `path` in `nav.json` or in the page list does not exist in the package;
- a page exists in `pages/` that no navigation entry reaches;
- a `downloads` entry names a file that is not in the package;
- two packages claim the same product and version;
- a product has versions but no `latest` target.

## Engine rules

1. The engine is invoked by the product repository's own scripts — never by the application, never by the site.
2. The engine's configuration stays with the product it builds.
3. The engine's version is pinned by the product that uses it and recorded in `manifest.json`.
4. DocFX is the default engine. Adding another is a product-level decision and requires no change in `temco-learn` and no change in the application.
