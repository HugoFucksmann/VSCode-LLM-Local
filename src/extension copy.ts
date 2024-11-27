import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { ConsoleManager } from './ConsoleManager';
import { CodeFixer } from './CodeFixer';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);
  const consoleManager = new ConsoleManager();
  const codeFixer = new CodeFixer();

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('cursorIA.sidebar', sidebarProvider));

  let disposable = vscode.commands.registerCommand('cursorIA.openPanel', () => {
    vscode.commands.executeCommand('cursorIA.sidebar.focus');
  });

  context.subscriptions.push(disposable);

  // Register message handlers
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorIA.analyzeCode', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const text = activeEditor.document.getText();
        await consoleManager.runDiagnostics(text);
      }
    }),
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('cursorIA.fixCode', async () => {
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const text = activeEditor.document.getText();
        await codeFixer.fixCode(text);
      }
    }),
  );
}
