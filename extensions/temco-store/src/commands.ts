// The store's one command: what it is, where it is, and what it currently holds.
//
// It is the whole surface of this module, and it lives here rather than in the module that shows it because the
// answer is about *this* file: a caller that asked the documentation module where the platform's memory lives
// would be asking the wrong module. Everything else the platform does with the store — adding a source, creating
// a project, building one, reading a history — is a command of the module that owns that work.

import * as vscode from 'vscode';
import { Catalog, CatalogUnavailable, catalogFileUri, sqliteAvailable } from './catalog/store';

const OUTPUT_NAME = 'Temco Store';

export function registerStoreCommands(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel(OUTPUT_NAME);
  context.subscriptions.push(
    output,
    vscode.commands.registerCommand('temcoStore.status', () => show(context, output))
  );
}

async function show(context: vscode.ExtensionContext, output: vscode.OutputChannel): Promise<void> {
  if (!sqliteAvailable()) {
    void vscode.window.showErrorMessage(
      'Temco Store: this editor does not provide `node:sqlite` (built into Node 22.5 and later), so the ' +
      "platform's memory cannot be opened."
    );
    return;
  }

  let catalog: Catalog;
  try {
    catalog = await Catalog.open(context);
  } catch (error) {
    const message = error instanceof CatalogUnavailable ? error.message : String(error);
    void vscode.window.showErrorMessage(`Temco Store: ${message}`);
    return;
  }

  const counts = catalog.counts();
  const empty = counts.every(([, n]) => n === 0);

  output.appendLine('');
  output.appendLine("The catalog — the platform's memory");
  output.appendLine(`  file            ${catalog.file.fsPath}`);
  output.appendLine(`  schema          ${catalog.schemaVersion()}`);
  output.appendLine('');
  for (const [table, n] of counts) {
    output.appendLine(`  ${table.padEnd(14)} ${String(n).padStart(6)}`);
  }
  if (empty) {
    output.appendLine('');
    output.appendLine('  Nothing has been recorded yet: no sources, no projects, no builds.');
  }
  output.show(true);
  catalog.close();

  const file = catalogFileUri(context);
  const answer = await vscode.window.showInformationMessage(
    `Temco Store: catalog ready — ${counts.length} tables, ${empty ? 'nothing recorded yet' : 'in use'}.`,
    'Open the folder',
    'Copy the path'
  );
  if (answer === 'Open the folder') {
    await vscode.commands.executeCommand('revealFileInOS', file);
  } else if (answer === 'Copy the path') {
    await vscode.env.clipboard.writeText(file.fsPath);
  }
}
