# 02 — The DocFX engine

The engine that turns the corpus into a content package is a pinned dependency of the build, not a fork this project maintains. This document owns how it is obtained, how it is invoked, how it is upgraded, and what happens when it needs a change of its own.

---

## The stance

**Pin first, patch last.** The engine's version is recorded in one file, every build resolves it through that file, and patching is an escalation the design allows for but never pays for by default.

DocFX grew out of Microsoft's documentation toolchain, and its own README states that Microsoft Learn no longer uses it and does not intend to support it, and that it continues as a community-driven .NET Foundation project. Two conclusions carry weight:

- **no upstream fix is owed to this project**, so the version is pinned and the template layer stays thin: a pinned engine plus a small recorded set of overrides is the difference between the output changing under the project and an upgrade being chosen;
- **nothing here copies Learn's architecture** — that is an internal platform of a different scale. This platform is Git, Markdown, DocFX, one template and a few small services. Everything else about the engine's history is interesting and irrelevant.

## What lives where

```
C:\QN\temcocontrols\
├─ T3000Webview-EEZ-Studio\        the product repository: docs/docfx.json, docs/toc.yml, docs/templates/t3000/
└─ docfx\                          the engine, when it is a source checkout: src/docfx (the CLI), templates/
```

Three rules hold that shape:

1. no file inside the engine's tree is ever edited;
2. the engine is never inside the product repository and never a submodule;
3. only two things name it — `tools/docfx.pin` and, for a source checkout, the `DOCFX_REPO` environment variable.

Everything customised lives in the product repository: `docs/docfx.json`, `docs/toc.yml` and `docs/templates/t3000/`.

## Nothing in the engine needs changing

The expectation is **zero modified files** in the engine's tree. Every requirement is reachable in the product repository:

| What has to change | Where the change lives | Engine code changes? |
|---|---|---|
| colours, layout, fonts, widgets | `docs/templates/t3000/public/{main.css,main.js}`, passed as the last entry of `template` | no — the engine reads it |
| per-area chrome (hide the rail, `noindex`, landing layout) | `docfx.json` → `globalMetadata` / `fileMetadata` | no — configuration |
| navigation, chapters, ordering | the generated `docs/toc.yml` | no — input data |
| Markdown features | `markdownEngineProperties` plus Markdig extensions | no — configuration |
| broken links, offline-asset rules | the repository's own `scripts/audit-docs.mjs` | no — repository tooling |
| something only the engine's own C# can do | a commit on the project's branch, exported to `tools/patches/*.patch` | yes — the last resort |

## How the engine is invoked

The engine is *used as a program*, exactly like `hhc.exe` is:

```
product repository (git)                       the engine (outside the repository)
  tools/docfx.pin          ──────────────►     the version to run, and how
  npm run docs:site        ──────────────►     dotnet tool run docfx …            (a pinned release)
                                               dotnet <engine>\src\docfx\…        (a source checkout)
  docs/docfx.json, docs/toc.yml  ─────────►    read as build input
  docs/templates/t3000/**        ─────────►    read as the template layer
                                               writes ◄── dist/docs/  (the rendered copy)
```

The engine's output is a rendered copy of the corpus. The product's own build completes it into a content package in the same pass — the manifest, the navigation model and the search data the site reads ([03](03-site-project.md)).

There is no submodule, no project reference, no library call and no engine source inside the product repository. The whole relationship is a build-time invocation plus a pin file that says which version to run.

Maintenance is therefore **none until an upgrade is chosen**. Sitting on one engine version for years is a legitimate strategy: upgrading is a fetch, a checkout of a tag, a rebuild and the verification below — a checkout when the tree is unmodified, a rebase when the checkout carries commits.

## The two forms

Both forms produce the same rendered copy, and nothing downstream knows which one was used.

| | Pinned release (`mode: tool`, the default) | Source checkout (`mode: clone`) |
|---|---|---|
| What it is | the official release, installed as a local .NET tool from the committed tool manifest | `dotnet/docfx` cloned outside the product repository, with templates and the CLI built from source |
| Reproducibility | `dotnet tool restore` plus `tools/docfx.pin` gives everyone a byte-for-byte identical tool | the build is a pure function of the pinned commit |
| Cost | near zero: no Node and no engine build anywhere, including CI | a build the project owns: .NET SDK *and* Node 24, a checkout outside the repository, and a rebuild after every upgrade |
| Patching | not possible | possible, as commits on the project's own remote or as exported patches |
| When it is used | always, until a specific need appears | when behaviour is needed that a template override, a post-processor or a configuration option cannot reach — or when the build host cannot reach NuGet |

The default is the pinned release because a fork of a thousand-file engine is maintenance paid at every upgrade, and every requirement — branding, layout, search, PDF, offline — is reachable through template overrides, file metadata, `markdownEngineProperties`, `postProcessors` and post-build scripts. The source checkout stays documented and testable: the `clone` mode must keep working.

## The pin

`tools/docfx.pin` is the single source of truth in both forms, and the only file the scripts act on:

```json
{
  "mode": "clone",
  "repo": "https://github.com/<your-org>/docfx",
  "upstreamRepo": "https://github.com/dotnet/docfx",
  "tag": "temco-v2.78.3-1",
  "upstreamTag": "v2.78.3",
  "branch": "temco/main",
  "commit": "0123456789abcdef0123456789abcdef01234567",
  "enginePathEnvVar": "DOCFX_REPO",
  "enginePathExample": "C:/QN/temcocontrols/docfx",
  "dotnetSdk": "10.0.x",
  "node": "24.x",
  "patches": [],
  "notes": "mode: tool | clone | global. PDF requires 2.73 or newer with the modern template."
}
```

| Field | Meaning |
|---|---|
| `mode` | the only field the scripts act on: `tool` is the pinned local tool, `clone` is the external checkout, `global` is a machine-wide install |
| `enginePathEnvVar` | wins over any recorded path, so one repository serves a developer machine, a CI runner and a build server without editing a tracked file |
| `patches` | the patch files that `npm run docs:engine` applies, in order |
| `dotnetSdk`, `node` | the versions the build expects |

Changing `mode` changes nothing about the engine's project or the package, so it is a one-field edit.

## A source checkout outside the repository

**A submodule is not used and is not required.** A checkout outside the working tree gives the same guarantee — a pinned commit that can be read and patched — without nesting a second repository inside the product's: no `.gitmodules`, no `git submodule update` for every developer, no way to commit engine files by accident, and a clone of the product that stays self-contained.

```powershell
git clone https://github.com/dotnet/docfx C:\QN\temcocontrols\docfx
git -C C:\QN\temcocontrols\docfx fetch --tags
git -C C:\QN\temcocontrols\docfx checkout v2.78.3       # a release tag
$env:DOCFX_REPO = "C:\QN\temcocontrols\docfx"           # per machine, and in CI

cd $env:DOCFX_REPO\templates; npm install; npm run build   # the rendering assets
cd $env:DOCFX_REPO;           dotnet build docfx.sln -c Release
```

An air-gapped or mirrored network clones the mirror instead; everything after that is identical, and the site build itself never contacts the network.

| Way to obtain the engine | Command | Notes |
|---|---|---|
| pinned tool (`mode: tool`) | `dotnet tool install docfx --local --version <x.y.z>` | no source at all: the compiled tool lands in `%USERPROFILE%\.nuget\packages\docfx\<version>\` and only `.config/dotnet-tools.json` is committed |
| independent checkout (`mode: clone`) | `git clone https://github.com/dotnet/docfx C:\QN\temcocontrols\docfx` | its own repository in a sibling folder; the product repository has no submodule entry |
| the project's own fork (`mode: clone` with its own remote) | `gh repo fork dotnet/docfx --clone --org <org>` | the same mechanics, with the remote ours — see below |
| source archive (no git at all) | extract the release tag's zip to `C:\QN\temcocontrols\docfx-<tag>` | for machines that must not keep git metadata; the build is identical |

The checkout must stay clean, so `tools/docfx/` is listed in `.gitignore` as a guard: a checkout made *inside* the repository can then never be committed.

## A fork, when the engine must change

Forking `dotnet/docfx` into the organisation and cloning *that* is still a source checkout in every mechanical sense — outside the tree, referenced by `DOCFX_REPO`, not a submodule — with the project's own remote.

| Benefit | Why it matters |
|---|---|
| patches are commits, not patch files | a `temco/main` branch rebases onto a new upstream tag the normal way; a conflict is resolved once instead of re-deriving a patch |
| tags of the project's own | builds are tagged `temco-v<version>-<n>`, so they stay reproducible even if upstream moves or deletes a tag |
| CI can clone it | a public or internal fork needs nothing; a private one needs a token or a deploy key |
| a durable pin | `tools/docfx.pin` points at the project's fork, its tag and its commit, so the build survives upstream changing hands |
| an audit trail | an engine change is a reviewable pull request |

```powershell
# once
gh repo fork dotnet/docfx --clone --org <org>
git remote -v                                    # origin = the fork, upstream = dotnet/docfx
git checkout -b temco/main v2.78.3               # branch from the release being shipped
git push -u origin temco/main

# every upgrade
git fetch upstream --tags
git checkout temco/main; git rebase v2.79.0
git push --force-with-lease origin temco/main
git tag temco-v2.79.0-1; git push origin temco-v2.79.0-1
```

| Rule | Why |
|---|---|
| prefix the project's tags (`temco-*`) | reusing upstream tag names on a fork makes `git fetch upstream --tags` ambiguous |
| rebase, never merge, onto upstream tags | the history then reads "upstream release plus the project's commits" |
| clone in full, not `--depth 1` | rebasing needs the history |
| keep `tools/patches/` | it becomes the export for machines that cannot clone the fork (`git format-patch <tag>..temco/main`) |
| keep the fork minimal | every engine commit is paid back at every upgrade; a template override, file metadata, `markdownEngineProperties` and a post-processor all come first |

## Prerequisites

| Tool | Version | Needed for |
|---|---|---|
| .NET SDK | 8.x, 9.x or 10.x | running the engine in either form; building it from source |
| Node.js | 24.x | the source checkout only — the engine's own `templates/` are built with `npm run build` |
| Visual Studio 2022 | optional | contributors to the engine's CLI; the `dotnet build` does not need it |
| `git-lfs` | optional | the engine's snapshot tests only |

A pinned release needs the .NET SDK alone. A source checkout additionally needs Node on the site host, because the engine's rendering assets must be built before the CLI can render anything.

## Building from source

```powershell
$engine = $env:DOCFX_REPO

cd $engine\templates; npm install; npm run build        # the rendering assets
cd $engine;           dotnet build docfx.sln -c Release # the CLI
dotnet run --project $engine\src\docfx -- --version     # verify
```

| Project | Responsibility |
|---|---|
| `src/docfx` | the CLI: `build`, `serve`, `pdf`, `metadata`, `template`, `init` |
| `src/Docfx.App` | command implementations and orchestration |
| `src/Docfx.Build`, `Docfx.Build.Common` | the build pipeline, file mappings and table-of-contents handling |
| `src/Docfx.MarkdigEngine`, `…Extensions` | Markdown to HTML through Markdig, including the DocFX extensions |
| `src/Docfx.Plugins`, `Docfx.Common`, `Docfx.Glob` | plugin contracts and file and glob infrastructure |
| `src/Docfx.DataContracts.*` | the page and table-of-contents models the templates receive |
| `src/Docfx.Build.ManagedReference`, `Docfx.Dotnet` | .NET API metadata and rendering — unused here, the products are C++, Rust and TypeScript |
| `src/Docfx.Build.RestApi`, `…OperationLevelRestApi`, `…TagLevelRestApi` | REST API pages from an OpenAPI specification |
| `src/Docfx.YamlSerialization` | YAML input and output for tables of contents and metadata |
| `templates/` | the built-in `default` and `modern` templates, plus the typings under `src/options.d.ts` |

## Resolving the engine in a build

A source checkout, invoked directly — the simplest form, with no ambiguity about which `docfx` runs:

```powershell
dotnet run --project $env:DOCFX_REPO\src\docfx -- build docs/docfx.json
```

A source checkout, packed and installed as a local tool, which keeps one command name:

```powershell
dotnet pack $env:DOCFX_REPO\src\docfx -c Release -o $env:DOCFX_REPO\artifacts
dotnet new tool-manifest
dotnet tool install docfx --local --add-source $env:DOCFX_REPO\artifacts
dotnet tool run docfx -- --version
```

A pinned release, with no checkout at all:

```powershell
dotnet new tool-manifest
dotnet tool install docfx --local --version 2.78.3     # the version in tools/docfx.pin
dotnet tool run docfx -- build docs/docfx.json
```

**Every build script resolves the engine through `tools/docfx.pin`.** `npm run docs:site` must fail with a clear message when the pinned engine is missing, is the wrong version, or does not match the pin. A machine-wide install is acceptable for throwaway experiments only.

## The commands the build depends on

| Command | Used for |
|---|---|
| `docfx build docs/docfx.json` | the site, the search index and `xrefmap.yml` |
| `docfx build docs/docfx.json --serve` | local preview while editing pages or the template |
| `docfx pdf docs/docfx.json` | the PDF manual; the site is built first ([07](07-offline-pdf-chm.md)) |
| `docfx template list`, `docfx template export modern` | dumping an embedded template to read or diff it |
| `docfx init -y` | a scratch project, for trying a configuration idea in isolation |
| `docfx metadata` | .NET only — unused here |

```
npm run docs:site     # docfx build     → the rendered copy of the corpus
npm run docs:package  # assemble the content package the site reads
npm run docs:serve    # docfx build --serve, port 8080
npm run docs:pdf      # docfx build && docfx pdf
npm run docs:engine   # rebuild the pinned engine from source, then apply patches
```

## Version policy, upgrades and rollback

**One pinned version at a time, upgraded deliberately, never automatically.** An upgrade happens when a fix or a feature is needed, or once per release cycle — not on every upstream release.

An upgrade is a single pull request, containing nothing else:

1. fetch the tags (a source checkout) or read the release notes for every version between the pin and the target;
2. check the two things that break the build: renamed templates or partials that the `templates/t3000` overrides rely on, and changes under `src/Docfx.*` that invalidate a patch;
3. move to the new version — `git checkout <new tag>` and rebuild for a source checkout, `dotnet tool update docfx --local --version <x.y.z>` for a pinned release — and run the verification below;
4. update `tools/docfx.pin` and re-apply or re-export the patches;
5. commit the version bump together with the regenerated summary — page count, warning count, broken-link count — so the diff is auditable.

```powershell
npm run docs:site && npm run docs:package
# must hold:
#   manifest.json exists and names its product, version and source commit
#   nav.json resolves every page, and every page appears in nav.json
#   pages/ holds one entry per shipped page                              (the registry's ship count)
#   search-index.json exists and is not empty
#   broken-link warnings: zero
#   total warnings within the recorded baseline
#   no remote URL in any generated .html, .css or .js              (the offline rule, 11-review-and-cicd.md)
```

**Rollback** is a revert of the pin. The output is a pure function of the pages, the registry, the template and the engine version, so reverting the pin and rebuilding restores the previous rendered copy byte-for-byte apart from timestamps, and the package is rebuilt from it.

## Patches

A patch is created only when a behaviour cannot be reached through configuration, metadata, a template override or a post-processor.

```powershell
# a source checkout only — the tree is kept clean, so patches are the record of the project's changes
git -C $env:DOCFX_REPO checkout -b temco/patches
# …edit…
git -C $env:DOCFX_REPO commit -am "fix: what and why"
git -C $env:DOCFX_REPO format-patch <pinCommit> -o $pwd\tools\patches
```

| Rule | Why |
|---|---|
| named `NNNN-short-slug.patch`, committed under `tools/patches/` | the order is explicit and the set is reviewable |
| listed in `tools/docfx.pin`'s `patches` | one place decides what is applied |
| applied by `npm run docs:engine` after checkout, failing loudly when one no longer applies | a stale patch stops the build instead of drifting silently |
| the commit message links the upstream issue | a later upgrade can drop the patch once upstream ships the fix |

The non-patch answer is almost always available first:

| Symptom | Fix before patching |
|---|---|
| a partial's markup needs a change | override the partial in `templates/t3000` |
| a page needs different chrome | `fileMetadata` → `_disableToc`, `_disableAffix`, `_layout`, `_noindex` |
| a Markdown feature is missing | `markdownEngineProperties.markdigExtensions` |
| generated HTML needs post-processing | `postProcessors`, or a Node step after the build |
| search index behaviour | the site's own index, or the engine's ([06](06-search.md)) |

## Failure modes

| Failure | Detected by | Response |
|---|---|---|
| the engine is missing (no checkout for `clone`, no local tool for `tool`) | the `docs:site` precheck | fail with `git clone <repo> $env:DOCFX_REPO`, or with `dotnet tool restore` |
| the version does not match the pin | the precheck (`--version`, or `git rev-parse HEAD` for a checkout) | fail, printing both versions or commits |
| engine files appear inside the repository | the precheck scans for a known engine layout | fail — the engine is never vendored |
| the .NET SDK is missing or too old | `dotnet --list-sdks` in the precheck | fail with the required band |
| Node is missing, so the templates cannot build | `npm run` inside `templates/` | fail with the requirement to install Node 24 |
| port 8080 is in use | `--serve` exits | use `--port <n>` |
| a patch no longer applies after an upgrade | `git am` or `git apply` inside `docs:engine` | stop and re-derive the patch against the new tag |
| the engine builds but the package is empty | the rendered copy has no `index.html` | check that `build.content` globs are relative to `docfx.json` |
| the PDF command reports no table of contents | `docfx pdf` output | the site has not been built, or `pdf` metadata is not enabled ([07](07-offline-pdf-chm.md)) |

## What the build must satisfy

1. The pin is the only place the engine version is written down, and every script resolves the engine through it.
2. `npm run docs:site` fails with a clear message when the engine is missing, is the wrong version, or has a checkout inside the repository; the check is `verifyEnginePin()`.
3. `tools/patches/` exists with its README and its apply step in `docs:engine`, and is empty while no patch is needed.
4. A warning-count baseline for the current corpus is recorded, and becomes the build's budget.
5. The upgrade checklist lives with `CONTRIBUTING` and the pull-request template.

On a clean clone, `dotnet tool restore; npm run docs:site && npm run docs:package` — for a pinned release, or with `npm run docs:engine` first for a source checkout — produces a content package with a manifest, a navigation model that names every page, the pages themselves, the search index and the cross-reference map, with zero broken-link warnings and no engine file anywhere inside the repository.
