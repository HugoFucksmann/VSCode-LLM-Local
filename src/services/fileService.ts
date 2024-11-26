// fileService.ts
import * as vscode from 'vscode';
import { TabInfo, FileServiceInterface } from './types';

export class FileService implements FileServiceInterface {
  public async getOpenTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          const tabInfo = {
            label: tab.label,
            uri: tab.input.uri.toString(),
          };
          tabs.push(tabInfo);
        }
      });
    });
    return tabs;
  }

  public async getSelectedFilesContent(selectedTabs: string[]): Promise<string> {
    try {
      const fileContents = await Promise.all(
        selectedTabs.map(async (tabUri) => {
          const uri = vscode.Uri.parse(tabUri);

          try {
            const document = await vscode.workspace.openTextDocument(uri);
            const fileContent = document.getText();

            return `File: ${uri.fsPath}:\n\n${fileContent}`;
          } catch (docError) {
            console.error(`Error opening document for ${uri.fsPath}:`, docError);
            return `Error reading file: ${uri.fsPath}`;
          }
        }),
      );

      return fileContents.join('\n\n---\n\n');
    } catch (error) {
      console.error('Error in getSelectedFilesContent:', error);
      return '';
    }
  }
}
