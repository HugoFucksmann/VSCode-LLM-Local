import axios, { AxiosResponse } from 'axios';
import * as vscode from 'vscode';
import * as fs from 'fs';

interface TabInfo {
  label: string;
  uri: string;
}

interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  private selectedTabs: string[] = [];
  private _webviewView?: vscode.WebviewView;
  private readonly _extensionUri: vscode.Uri;

  private static readonly MODEL_URL = 'http://localhost:1234/v1/chat/completions';
  private static readonly MODEL_NAME = 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF';
  constructor(extensionUri: vscode.Uri) {
    this._extensionUri = extensionUri;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._webviewView = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      this._handleWebviewMessage(data, webviewView);
    });
  }

  private _handleWebviewMessage = async (data: any, webviewView: vscode.WebviewView) => {
    console.log('[SidebarProvider] Received message:', data.type, data);

    switch (data.type) {
      case 'analyze':
        vscode.commands.executeCommand('cursorIA.analyzeCode');
        break;
      case 'fix':
        vscode.commands.executeCommand('cursorIA.fixCode');
        break;
      case 'getOpenTabs':
        await this._handleGetOpenTabs(webviewView);
        break;
      case 'sendPrompt':
        await this._handleSendPrompt(data.prompt, data.selectedTabs, webviewView);
        break;
      case 'toggleTab':
        this._handleToggleTab(data.tabUri, data.isSelected, webviewView);
        break;
      case 'continueGeneration':
        await this._handleContinueGeneration(data.currentResponse, data.selectedTabs, webviewView);
        break;
      default:
        console.log('[SidebarProvider] Unknown message type:', data.type);
    }
  }

  private async _handleGetOpenTabs(webviewView: vscode.WebviewView): Promise<void> {
    const openTabs = await this.getOpenTabs();
    webviewView.webview.postMessage({
      type: 'updateTabs',
      tabs: openTabs,
      selectedTabs: this.selectedTabs,
    });
  }

  private _handleToggleTab(tabUri: string, isSelected: boolean, webviewView: vscode.WebviewView): void {
    this.handleTabSelection(tabUri, isSelected);
    webviewView.webview.postMessage({
      type: 'updateSelectedTabs',
      selectedTabs: this.selectedTabs,
    });
  }

  private async _handleSendPrompt(prompt: string, selectedTabs: string[], webviewView: vscode.WebviewView): Promise<void> {
    try {
      const selectedFilesContent = await this.getSelectedFilesContent(selectedTabs);
      const fullPrompt = this._constructFullPrompt(prompt, selectedFilesContent);
      await this._processStreamedResponse(fullPrompt, webviewView);
    } catch (error) {
      this._handleErrorResponse(error, webviewView);
    }
  }

  private async _handleContinueGeneration(currentResponse: string, selectedTabs: string[], webviewView: vscode.WebviewView): Promise<void> {
    try {
      const selectedFilesContent = await this.getSelectedFilesContent(selectedTabs);
      const fullPrompt = `${currentResponse}\n\n${selectedFilesContent}`;
      await this._processStreamedResponse(fullPrompt, webviewView, currentResponse);
    } catch (error) {
      this._handleErrorResponse(error, webviewView);
    }
  }

  private _constructFullPrompt(prompt: string, selectedFilesContent: string): string {
    return selectedFilesContent.length > 0 
      ? `${prompt}\n\n---\n\nAdditional Context:\n${selectedFilesContent}` 
      : prompt;
  }

  private async _processStreamedResponse(fullPrompt: string, webviewView: vscode.WebviewView, initialResponse: string = ''): Promise<void> {
    const messages: Message[] = initialResponse 
      ? [
          { role: 'system', content: 'Act as a helpful assistant.' },
          { role: 'assistant', content: initialResponse },
          { role: 'user', content: 'continue' }
        ]
      : [
          { role: 'system', content: 'Act as a helpful assistant.' },
          { role: 'user', content: fullPrompt }
        ];

    try {
      const response = await axios({
        method: 'post',
        url: SidebarProvider.MODEL_URL,
        data: {
          model: SidebarProvider.MODEL_NAME,
          messages: messages,
          temperature: 0.3,
          max_tokens: 600,
          stream: true,
        },
        responseType: 'stream',
      });

      await this._handleStreamedResponse(response, webviewView, initialResponse);
    } catch (error) {
      this._handleErrorResponse(error, webviewView);
    }
  }

  private async _handleStreamedResponse(
    response: AxiosResponse, 
    webviewView: vscode.WebviewView, 
    initialResponse: string = ''
  ): Promise<void> {
    let fullResponse = initialResponse;

    return new Promise((resolve, reject) => {
      response.data.on('data', (chunk: any) => {
        try {
          const chunkString = chunk.toString();
          const lines = chunkString.split('\n');

          lines.forEach((line: string) => {
            if (line.startsWith('data: ') && line !== 'data: [DONE]') {
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
        resolve();
      });

      response.data.on('error', (error: Error) => {
        console.error('Stream error:', error);
        reject(error);
      });
    });
  }

  private _handleErrorResponse(error: any, webviewView: vscode.WebviewView): void {
    console.error('Error processing prompt:', error);
    webviewView.webview.postMessage({
      type: 'response',
      content: 'Error processing prompt. Please try again.',
    });
  }

  private async getOpenTabs(): Promise<TabInfo[]> {
    const tabs: TabInfo[] = [];
    vscode.window.tabGroups.all.forEach((group) => {
      group.tabs.forEach((tab) => {
        if (tab.input instanceof vscode.TabInputText) {
          const tabInfo = {
            label: tab.label,
            uri: tab.input.uri.toString(),
          };
          console.log(`[SidebarProvider] Found tab: ${JSON.stringify(tabInfo)}`);
          tabs.push(tabInfo);
        }
      });
    });
    return tabs;
  }

  private handleTabSelection(tabUri: string, isSelected: boolean): void {
    console.log(`[SidebarProvider] Handling tab selection: ${tabUri}, isSelected: ${isSelected}`);
    
    if (isSelected) {
      if (!this.selectedTabs.includes(tabUri)) {
        this.selectedTabs.push(tabUri);
      }
    } else {
      this.selectedTabs = this.selectedTabs.filter((uri) => uri !== tabUri);
    }
    
    console.log(`[SidebarProvider] Current selected tabs: ${this.selectedTabs}`);
  }

  private async getSelectedFilesContent(selectedTabs: string[]): Promise<string> {
    console.log(`[SidebarProvider] Getting content for selected tabs: ${selectedTabs}`);
    
    try {
      const fileContents = await Promise.all(
        selectedTabs.map(async (tabUri) => {
          console.log(`[SidebarProvider] Processing tab URI: ${tabUri}`);
          const uri = vscode.Uri.parse(tabUri);
          
          try {
            const document = await vscode.workspace.openTextDocument(uri);
            const fileContent = document.getText();
            
            console.log(`[SidebarProvider] File content for ${uri.fsPath}:
            ${fileContent.substring(0, 200)}...`);
            
            return `File: ${uri.fsPath}:\n\n${fileContent}`;
          } catch (docError) {
            console.error(`[SidebarProvider] Error opening document for ${uri.fsPath}:`, docError);
            return `Error reading file: ${uri.fsPath}`;
          }
        })
      );

      const combinedContent = fileContents.join('\n\n---\n\n');
      console.log(`[SidebarProvider] Combined file contents:
      ${combinedContent.substring(0, 500)}...`);
      
      return combinedContent;
    } catch (error) {
      console.error('[SidebarProvider] Error in getSelectedFilesContent:', error);
      return '';
    }
  }

  private _getHtmlForWebview(): string {
    const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.html');
    const stylesPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css');
    
    // Convertir la ruta del CSS a una URI que pueda ser usada en el webview
    const stylesUri = this._webviewView?.webview.asWebviewUri(stylesPath);
  
    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');
    
    // Reemplazar o insertar el link al CSS
    htmlContent = htmlContent.replace(
      '</head>', 
      `  <link rel="stylesheet" href="${stylesUri}">
      </head>`
    );
  
    return htmlContent;
  }
}