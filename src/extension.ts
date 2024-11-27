import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('cursorIA.sidebar', sidebarProvider));

  let disposable = vscode.commands.registerCommand('cursorIA.openPanel', () => {
    vscode.commands.executeCommand('cursorIA.sidebar.focus');
  });

  context.subscriptions.push(disposable);
}
