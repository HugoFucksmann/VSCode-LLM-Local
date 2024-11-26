import axios from 'axios';
import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

interface TabInfo {
  label: string;
  uri: string;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case 'analyze':
          vscode.commands.executeCommand('cursorIA.analyzeCode');
          break;
        case 'fix':
          vscode.commands.executeCommand('cursorIA.fixCode');
          break;
        case 'getOpenTabs':
          const openTabs = await this.getOpenTabs();
          webviewView.webview.postMessage({
            type: 'updateTabs',
            tabs: openTabs,
          });
          break;
        case 'sendPrompt':
          const selectedTabs = data.selectedTabs as string[];
          const prompt = data.prompt as string;
          await this.processPrompt(prompt, selectedTabs, webviewView);
          break;

        case 'continueGeneration':
          await this.continuePrompt(data.currentResponse, webviewView);
          break;
      }
    });
  }

  private async continuePrompt(currentResponse: string, webviewView: vscode.WebviewView): Promise<void> {
    try {
      const messages = [
        { role: 'system', content: 'Act as a helpful assistant.' },
        { role: 'assistant', content: currentResponse },
        { role: 'user', content: 'continue' },
      ];

      const response = await axios({
        method: 'post',
        url: 'http://localhost:1234/v1/chat/completions',
        data: {
          model: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1200,
          stream: true,
        },
        responseType: 'stream',
      });

      let fullResponse = currentResponse;
      response.data.on('data', (chunk: any) => {
        try {
          const chunkString = chunk.toString();
          const lines = chunkString.split('\n');

          lines.forEach((line: any) => {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.replace('data: ', '').trim();
                const parsedChunk = JSON.parse(jsonStr);
                const content = parsedChunk.choices[0]?.delta?.content || '';

                if (content) {
                  fullResponse += content;
                  webviewView.webview.postMessage({
                    type: 'partialResponse',
                    content: fullResponse,
                  });
                }
              } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
              }
            }
          });
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      });

      response.data.on('end', () => {
        webviewView.webview.postMessage({
          type: 'response',
          content: fullResponse,
        });
      });
    } catch (error) {
      console.error('Error processing prompt:', error);
      webviewView.webview.postMessage({
        type: 'response',
        content: 'Error processing prompt. Please try again.',
      });
    }
  }

  private async getOpenTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          tabs.push({
            label: tab.label,
            uri: tab.input.uri.toString(),
          });
        }
      });
    });
    return tabs;
  }

  private async processPrompt(prompt: string, selectedTabs: string[], webviewView: vscode.WebviewView): Promise<void> {
    try {
      const selectedFilesContent = selectedTabs.length > 0 ? await this.getSelectedFilesContent(selectedTabs) : '';

      const messages = [
        { role: 'system', content: 'Act as a helpful assistant.' },
        { role: 'user', content: prompt },
        ...(selectedFilesContent ? [{ role: 'user', content: selectedFilesContent }] : []),
      ];

      const response = await axios({
        method: 'post',
        url: 'http://localhost:1234/v1/chat/completions',
        data: {
          model: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
          messages: messages,
          temperature: 0.7,
          max_tokens: 1200,
          stream: true,
        },
        responseType: 'stream',
      });

      let fullResponse = '';
      response.data.on('data', (chunk: any) => {
        try {
          // Convert chunk to string and split by lines
          const chunkString = chunk.toString();
          const lines = chunkString.split('\n');

          lines.forEach((line: any) => {
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.replace('data: ', '').trim();
                const parsedChunk = JSON.parse(jsonStr);

                // Check if the chunk has content
                const content = parsedChunk.choices[0]?.delta?.content || '';

                if (content) {
                  fullResponse += content;
                  webviewView.webview.postMessage({
                    type: 'partialResponse',
                    content: fullResponse,
                  });
                }
              } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
              }
            }
          });
        } catch (error) {
          console.error('Error processing chunk:', error);
        }
      });

      response.data.on('end', () => {
        // Send final response when streaming is complete
        webviewView.webview.postMessage({
          type: 'response',
          content: fullResponse,
        });
      });
    } catch (error) {
      console.error('Error processing prompt:', error);
      webviewView.webview.postMessage({
        type: 'response',
        content: 'Error processing prompt. Please try again.',
      });
    }
  }

  private async getSelectedFilesContent(selectedTabs: string[]): Promise<string> {
    const fileContents = await Promise.all(
      selectedTabs.map(async (tabUri) => {
        const uri = vscode.Uri.parse(tabUri);
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
      }),
    );
    return fileContents.join('\n\n'); // Concatenar el contenido de todos los archivos seleccionados
  }

  private _getHtmlForWebview(): string {
    const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.html');
    const htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    return htmlContent;
  }
}
