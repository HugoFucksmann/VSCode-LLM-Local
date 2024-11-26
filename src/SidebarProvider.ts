import axios from 'axios';
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
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    console.log('[SidebarProvider] Resolving webview view');
    this._webviewView = webviewView; 

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      console.log('[SidebarProvider] Received message:', data.type, data);

      switch (data.type) {
        case 'analyze':
          console.log('[SidebarProvider] Analyze command');
          vscode.commands.executeCommand('cursorIA.analyzeCode');
          break;
        case 'fix':
          console.log('[SidebarProvider] Fix command');
          vscode.commands.executeCommand('cursorIA.fixCode');
          break;
        case 'getOpenTabs':
          console.log('[SidebarProvider] Getting open tabs');
          const openTabs = await this.getOpenTabs();
          console.log('[SidebarProvider] Open tabs:', openTabs);
          webviewView.webview.postMessage({
            type: 'updateTabs',
            tabs: openTabs,
            selectedTabs: this.selectedTabs,
          });
          break;
        case 'sendPrompt':
          console.log('[SidebarProvider] Sending prompt');
          console.log('[SidebarProvider] Selected tabs:', data.selectedTabs);
          console.log('[SidebarProvider] Prompt:', data.prompt);
          await this.sendPrompt(data.prompt, data.selectedTabs, webviewView);
          break;
        case 'toggleTab':
          console.log('[SidebarProvider] Toggling tab:', data.tabUri, 'Selected:', data.isSelected);
          this.handleTabSelection(data.tabUri, data.isSelected);
          webviewView.webview.postMessage({
            type: 'updateSelectedTabs',
            selectedTabs: this.selectedTabs,
          });
          break;
        case 'continueGeneration':
          console.log('[SidebarProvider] Continuing generation');
          await this.continuePrompt(data.currentResponse, data.selectedTabs, webviewView);
          break;
        default:
          console.log('[SidebarProvider] Unknown message type:', data.type);
      }
    });
  }

  private async continuePrompt(currentResponse: string, selectedTabs: string[], webviewView: vscode.WebviewView): Promise<void> {
    try {
      const selectedFilesContent = await this.getSelectedFilesContent(selectedTabs);
      const fullPrompt = `${currentResponse}\n\n${selectedFilesContent}`;
  
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
          temperature: 0.3,
          max_tokens: 800,
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

  private async sendPrompt(prompt: string, selectedTabs: string[], webviewView: vscode.WebviewView): Promise<void> {
    try {
      console.log(`[SidebarProvider] Preparing to send prompt. Selected tabs: ${selectedTabs}`);
      
      const selectedFilesContent = await this.getSelectedFilesContent(selectedTabs);
      
      const fullPrompt = selectedTabs.length > 0 
        ? `${prompt}\n\n---\n\nAdditional Context:\n${selectedFilesContent}` 
        : prompt;
      
      console.log(`[SidebarProvider] Full Prompt:
      ${fullPrompt.substring(0, 500)}...`);
  
      const messages = [
        { role: 'system', content: 'Act as a helpful assistant.' },
        { role: 'user', content: fullPrompt },
      ];
  
      const response = await axios({
        method: 'post',
        url: 'http://localhost:1234/v1/chat/completions',
        data: {
          model: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
          messages: messages,
          temperature: 0.3,
          max_tokens: 1200,
          stream: true,
        },
        responseType: 'stream',
      });
  
      let fullResponse = '';
      response.data.on('data', (chunk: any) => {
        try {
          const chunkString = chunk.toString();
          const lines = chunkString.split('\n');
  
          lines.forEach((line: any) => {
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
      });
    } catch (error) {
      console.error('Error processing prompt:', error);
      webviewView.webview.postMessage({
        type: 'response',
        content: 'Error processing prompt. Please try again.',
      });
    }
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