# `temco-tools`

The device and data surfaces, in the `Tools` activity-bar container.

| | |
|---|---|
| Folder | `extensions/temco-tools` |
| Extension id | `temcocontrols.temco-tools` |
| Namespace | `temcoTools` |
| State | active |
| Views | **Devices**, **I/O Studio**, **BACnet Studio**, **Network**, **SQL Studio** — one view per studio, one row per surface |
| Pages | one per studio (`temcoTools.devices`, `temcoTools.io`, `temcoTools.bacnet`, `temcoTools.network`, `temcoTools.sql`), each a stack of folded surfaces |
| Requires | `temco-ui` |

## Why one module

The platform documents a `temcoTools` container "declared by the first tools module", and four separate modules
(`temco-device-manager`, `temco-bacnet`, `temco-nettools`, `temco-sql`) are reserved for the day each has a backend.
Until then this module is their container: the surfaces exist, are navigable, and are drawn with the same page kit as
the rest of the platform, so the design is decided now and the backends fill it rather than redesign it.

## What is real, and what is sample

| Real | Sample |
|---|---|
| the container, the five views, the side-bar rows, the pages and their sections | the rows: `src/data.ts` is the mock's sample — devices, points, objects, hosts, tables, queries |
| the navigation: a row opens its section on the studio's page; a head button opens another section of the same page | the numbers and states |
| the vocabulary: `temco-ui`'s `page.css` — page head, group rules, tables, badges | — |

The sample lives in exactly one file. When a backend arrives (a socket, a stack, a driver), it replaces `data.ts` and
no page has to change.

## Files

| File | Owns |
|---|---|
| `src/extension.ts` | the five views, the `temcoTools.open` command, and the studio page that reveals or re-renders |
| `src/pages.ts` | the surfaces of each studio: tables, sections, and the page that stacks them |
| `src/data.ts` | the sample behind every row, in one place |
| `src/ui.ts` | what it reads of `temco-ui`: the page shell and the click-to-command script |

## Boundary rules

- **A page belongs to a studio, not to a surface.** The side bar names a surface, the page opens it; five pages per
  studio would be five places to keep the same head in step.
- **Nothing is reported as live.** A page that showed a sample value without saying so would be worse than an empty
  page; the module README and the code say it, and the day a backend lands the sample file is deleted.
- **No writes.** Nothing here sends a command to a controller, a stack or a database.
