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

    const stylesUri = this._webviewView?.webview.asWebviewUri(stylesPath);

    let htmlContent = fs.readFileSync(htmlPath.fsPath, 'utf8');

    htmlContent = htmlContent.replace(
      '</head>',
      `  <link rel="stylesheet" href="${stylesUri}">
      </head>`,
    );

    return htmlContent;
  }
}
