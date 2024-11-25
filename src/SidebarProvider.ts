import axios from "axios";
import * as vscode from "vscode";

interface TabInfo {
  label: string;
  uri: string;
}

export class SidebarProvider implements vscode.WebviewViewProvider {
  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Asignar el HTML como string
    webviewView.webview.html = this._getHtmlForWebview();

    webviewView.webview.onDidReceiveMessage(async (data: any) => {
      switch (data.type) {
        case "analyze":
          vscode.commands.executeCommand("cursorIA.analyzeCode");
          break;
        case "fix":
          vscode.commands.executeCommand("cursorIA.fixCode");
          break;
        case "getOpenTabs":
          const openTabs = await this.getOpenTabs();
          webviewView.webview.postMessage({
            type: "updateTabs",
            tabs: openTabs,
          });
          break;
        case "sendPrompt":
          const selectedTabs = data.selectedTabs as string[];
          const prompt = data.prompt as string;
          const response = await this.processPrompt(prompt, selectedTabs);
          webviewView.webview.postMessage({
            type: "response",
            content: response,
          });
          break;
      }
    });
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

  private async processPrompt(
    prompt: string,
    selectedTabs: string[]
  ): Promise<string> {
    try {
      // Obtén el contenido de los archivos seleccionados
      const selectedFilesContent =
        selectedTabs.length > 0
          ? await this.getSelectedFilesContent(selectedTabs)
          : "";

      // Construye el mensaje
      const messages = [
        { role: "system", content: "Act as a helpful assistant." },
        { role: "user", content: prompt },
        // Solo añade el contenido de archivos si hay algo seleccionado
        ...(selectedFilesContent
          ? [{ role: "user", content: selectedFilesContent }]
          : []),
      ];

      const response = await axios.post(
        "http://localhost:1234/v1/chat/completions",
        {
          model: "Qwen/Qwen2.5-Coder-14B-Instruct-GGUF",
          messages: messages,
          temperature: 0.7,
          max_tokens: 500,
          stream: false,
        }
      );

      return response.data.choices[0].message.content;
    } catch (error) {
      console.error("Error processing prompt:", error);
      return "Error processing prompt. Please try again.";
    }
  }

  private async getSelectedFilesContent(
    selectedTabs: string[]
  ): Promise<string> {
    const fileContents = await Promise.all(
      selectedTabs.map(async (tabUri) => {
        const uri = vscode.Uri.parse(tabUri);
        const document = await vscode.workspace.openTextDocument(uri);
        return document.getText();
      })
    );
    return fileContents.join("\n\n"); // Concatenar el contenido de todos los archivos seleccionados
  }

  private _getHtmlForWebview(): string {
    return `
      <!DOCTYPE html>
      <html>
      <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <link href="https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/themes/prism-tomorrow.min.css" rel="stylesheet" />
          <style>
              body { 
                  padding: 10px; 
                  display: flex;
                  flex-direction: column;
                  height: 100vh;
                  font-family: Arial, sans-serif;
              }
              textarea { 
                  width: 100%; 
                  height: 100px; 
                  margin-bottom: 10px; 
                  resize: vertical;
                  padding: 5px;
              }
              button { 
                  margin: 5px; 
                  padding: 8px; 
                  cursor: pointer;
                  background-color: #007bff;
                  color: white;
                  border: none;
                  border-radius: 4px;
              }
              button:hover {
                  background-color: #0056b3;
              }
              #tabsContainer {
                  margin: 10px 0;
                  max-height: 150px;
                  min-height: 50px;
                  overflow-y: auto;
                  border: 1px solid #ddd;
                  padding: 10px;
              }
              .tab-checkbox {
                  margin: 5px 0;
              }
              #responseContainer {
                  margin-top: 10px;
                  padding: 10px;
                  background: #1e1e1e;
                  flex-grow: 1;
                  overflow-y: auto;
                  border-radius: 4px;
              }
              #responseContainer pre {
                  white-space: pre-wrap;
                  word-wrap: break-word;
                  color: white;
              }
              .tab-item {
                  display: flex;
                  align-items: center;
                  margin: 4px 0;
              }
              .tab-item input[type="checkbox"] {
                  margin-right: 8px;
              }
          </style>
      </head>
      <body>
          <textarea id="promptInput" placeholder="Enter your prompt here..."></textarea>
          <div id="tabsContainer">
              <h3>Select tabs for context:</h3>
              <div id="tabsList"></div>
          </div>
          <button id="sendButton">Send</button>
          <div id="responseContainer">
              <pre id="response" class="language-javascript"></pre>
          </div>
  
          <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/prism.min.js"></script>
          <script>
              (function() {
                  const vscode = acquireVsCodeApi();
                  let currentTabs = [];
                  let isProcessing = false;
  
                  // Request open tabs when the webview loads
                  window.addEventListener('load', () => {
                      vscode.postMessage({ type: 'getOpenTabs' });
                  });
  
                  // Handle messages from the extension
                  window.addEventListener('message', event => {
                      const message = event.data;
                      switch (message.type) {
                          case 'updateTabs':
                              updateTabsList(message.tabs);
                              break;
                          case 'response':
                              displayResponse(message.content);
                              break;
                      }
                  });
  
                  function updateTabsList(tabs) {
                      currentTabs = tabs;
                      const container = document.getElementById('tabsList');
                      container.innerHTML = '';
                      
                      tabs.forEach((tab, index) => {
                          const tabElement = document.createElement('div');
                          tabElement.className = 'tab-item';
                          
                          const checkbox = document.createElement('input');
                          checkbox.type = 'checkbox';
                          checkbox.id = \`tab-\${index}\`;
                          checkbox.value = tab.uri;
                          
                          const label = document.createElement('label');
                          label.htmlFor = \`tab-\${index}\`;
                          label.textContent = tab.label;
                          
                          tabElement.appendChild(checkbox);
                          tabElement.appendChild(label);
                          container.appendChild(tabElement);
                      });
                  }
  
                  document.getElementById('sendButton').addEventListener('click', () => {
                      // Prevent multiple submissions
                      if (isProcessing) return;
  
                      const promptInput = document.getElementById('promptInput');
                      const prompt = promptInput.value.trim();
                      
                      // Check if prompt is empty
                      if (!prompt) {
                          alert('Please enter a prompt');
                          return;
                      }
  
                      const selectedTabs = Array.from(document.querySelectorAll('.tab-item input:checked'))
                          .map(checkbox => checkbox.value);
  
                      isProcessing = true;
                      vscode.postMessage({
                          type: 'sendPrompt',
                          prompt: prompt,
                          selectedTabs: selectedTabs
                      });
  
                      // Clear prompt input and disable send button temporarily
                      promptInput.value = '';
                  });
  
                  function displayResponse(content) {
                      const responseElement = document.getElementById('response');
                      responseElement.textContent = content;
                      Prism.highlightElement(responseElement);
                      isProcessing = false;
                  }
              })();
          </script>
      </body>
      </html>
    `;
  }
}
