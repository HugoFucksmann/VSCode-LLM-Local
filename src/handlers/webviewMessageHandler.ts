// webviewMessageHandler.ts
import * as vscode from 'vscode';
import { FileService } from '../services/fileService';
import { WebviewMessageHandlerInterface } from '../services/types';
import { AIService } from '../services/aiService';

export class WebviewMessageHandler implements WebviewMessageHandlerInterface {
  private aiService: AIService;
  private fileService: FileService;
  private selectedTabs: string[] = [];

  constructor(aiService: AIService, fileService: FileService) {
    this.aiService = aiService;
    this.fileService = fileService;
  }

  public async handleMessage(data: any, webviewView: vscode.WebviewView): Promise<void> {
    console.log('[WebviewMessageHandler] Received message:', data.type, data);

    switch (data.type) {
      case 'clearMemory':
        await this.aiService.clearMemory(); // Llama al método para limpiar la memoria
        webviewView.webview.postMessage({ type: 'memoryCleared' }); // Opcional: notifica al webview
        break;
      case 'getOpenTabs':
        const openTabs = await this.fileService.getOpenTabs();
        webviewView.webview.postMessage({
          type: 'updateTabs',
          tabs: openTabs,
          selectedTabs: this.selectedTabs,
        });
        break;
      case 'sendPrompt':
        await this.handleSendPrompt(data, webviewView);
        break;
      case 'toggleTab':
        this.handleTabToggle(data, webviewView);
        break;
      case 'continueGeneration':
        await this.handleContinueGeneration(data, webviewView);
        break;

      default:
        console.log('[WebviewMessageHandler] Unknown message type:', data.type);
    }
  }

  private handleTabToggle(data: any, webviewView: vscode.WebviewView): void {
    const { tabUri, isSelected } = data;

    if (isSelected) {
      if (!this.selectedTabs.includes(tabUri)) {
        this.selectedTabs.push(tabUri);
      }
    } else {
      this.selectedTabs = this.selectedTabs.filter((uri) => uri !== tabUri);
    }

    webviewView.webview.postMessage({
      type: 'updateSelectedTabs',
      selectedTabs: this.selectedTabs,
    });
  }

  private isLoading: boolean = false;
  private async handleSendPrompt(data: any, webviewView: vscode.WebviewView): Promise<void> {
    this.setLoadingState(true, webviewView); // Indicar que se está cargando

    try {
      const response = await this.aiService.sendPrompt(data.prompt, data.selectedTabs || this.selectedTabs);

      // Enviar respuesta completa directamente
      webviewView.webview.postMessage({
        type: 'response',
        content: response,
      });
    } catch (error) {
      console.error('Error processing prompt:', error);
      webviewView.webview.postMessage({
        type: 'response',
        content: 'Error processing prompt. Please try again.',
      });
    } finally {
      this.setLoadingState(false, webviewView); // Indicar que ha terminado de cargar
    }
  }

  private setLoadingState(isLoading: boolean, webviewView: vscode.WebviewView): void {
    this.isLoading = isLoading;
    webviewView.webview.postMessage({
      type: 'loading',
      content: this.isLoading,
    });
  }

  private async handleContinueGeneration(data: any, webviewView: vscode.WebviewView): Promise<void> {
    try {
      const response = await this.aiService.continueGeneration(
        data.currentResponse,
        data.selectedTabs || this.selectedTabs,
      );

      webviewView.webview.postMessage({
        type: 'response',
        content: response,
      });
    } catch (error) {
      console.error('Error continuing generation:', error);
      webviewView.webview.postMessage({
        type: 'response',
        content: 'Error continuing generation. Please try again.',
      });
    }
  }
}
