// types.ts
import * as vscode from 'vscode';

export interface TabInfo {
  label: string;
  uri: string;
}

export interface Message {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface AIServiceInterface {
  sendPrompt(prompt: string, selectedTabs: string[]): Promise<string>;
  continueGeneration(currentResponse: string, selectedTabs: string[]): Promise<string>;
  clearMemory(): void;
  findSimilarText(query: string, textList: string[]): Promise<Array<{text: string, similarity: number}>>;
}

export interface FileServiceInterface {
  getOpenTabs(): Promise<TabInfo[]>;
  getSelectedFilesContent(selectedTabs: string[]): Promise<string>;
}

export interface WebviewMessageHandlerInterface {
  handleMessage(data: any, webviewView: vscode.WebviewView): Promise<void>;
}
