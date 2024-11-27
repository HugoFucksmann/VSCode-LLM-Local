// sidebarProvider.ts
import * as vscode from 'vscode';
import * as fs from 'fs';
import { WebviewMessageHandler } from './handlers/webviewMessageHandler';
import { AIService } from './services/aiService';
import { FileService } from './services/fileService';

export class SidebarProvider implements vscode.WebviewViewProvider {
  private _webviewView?: vscode.WebviewView;
  private messageHandler: WebviewMessageHandler;

  constructor(private readonly _extensionUri: vscode.Uri) {
    const aiService = new AIService();
    const fileService = new FileService();
    this.messageHandler = new WebviewMessageHandler(aiService, fileService);
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

    webviewView.webview.onDidReceiveMessage(async (data) => {
      await this.messageHandler.handleMessage(data, webviewView);
    });
  }

  private _getHtmlForWebview(): string {
    const htmlPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.html');
    const stylesPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'styles.css');
    const jsPath = vscode.Uri.joinPath(this._extensionUri, 'media', 'webview.js');

    const stylesUri = this._webviewView?.webview.asWebviewUri(stylesPath);
    const sjUri = this._webviewView?.webview.asWebviewUri(jsPath);

    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    htmlContent = htmlContent.replace(
      '</head>',
      `  <link rel="stylesheet" href="${stylesUri}">
       <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/prism.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/components/prism-javascript.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/prism/1.27.0/components/prism-markdown.min.js"></script>
  <script src="https://cdnjs.cloudflare.com/ajax/libs/marked/4.0.0/marked.min.js"></script>
  
      </head>`,
    );

    // Inserta el script "webview.js" justo antes de la etiqueta </body>
    htmlContent = htmlContent.replace(
      '</body>',
      `  <script src="${sjUri}"></script>
      </body>`,
    );

    return htmlContent;
  }
}
