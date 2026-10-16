# resources/temco

Art for **Temco Platform**. The folder exists so the branded assets have one home that is ours, and so the
build's own art (`resources/win32`, `resources/darwin`, `resources/linux`) is never edited in place until we
choose to.

## What goes here

| Asset | Used by | Format |
|---|---|---|
| the application icon | the window, the taskbar, the dock, the installer | `.ico` for Windows (several sizes in one file), `.icns` for macOS, `.png` for Linux (16–512 px) |
| installer art | the Windows installer | `.bmp` backgrounds and banners, at the sizes the installer expects |
| splash and About art | first run, and the About command in [`src/temco/branding`](../../src/temco/branding/temco.about.ts) | `.svg` or `.png` |

## How it gets wired

Nothing here is referenced by a build yet, and that is deliberate: pointing a build at an asset that does not
exist breaks packaging. When the art exists, three things change together, each in its own file:

1. `product.json` — `linuxIconName` and the display identity it already carries;
2. the platform build files that read `resources/win32/code.ico`, the macOS `.icns` set and the Linux icons —
   either the same files replaced, or the Temco art copied in beside them;
3. the installer definition, for the banner and background bitmaps.

Until then the fork builds with VS Code's own art, which is why this folder holds a README and no binaries.
