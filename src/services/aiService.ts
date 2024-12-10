// aiService.ts
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as vscode from 'vscode';
import { AIServiceInterface, Message } from './types';

export class AIService implements AIServiceInterface {
  private messageHistory: Message[] = [];
  private async processStreamedResponse(
    messages: Message[],
    maxTokens: number = 600,
    temperature: number = 0.2,
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      try {
        const modelProcess = spawn('ollama', ['run', 'qwen2.5-coder:7b']);

        let fullResponse = '';

        modelProcess.stdout.on('data', (data) => {
          fullResponse += data.toString();
        });

        modelProcess.stderr.on('data', (data) => {
          console.error(`Error: ${data}`);
        });

        modelProcess.on('close', (code) => {
          if (code !== 0) {
            reject(new Error(`Model process exited with code ${code}`));
          } else {
            resolve(fullResponse);
          }
        });

        // Enviar el mensaje al modelo
        modelProcess.stdin.write(JSON.stringify({
          messages: messages,
          temperature: temperature,
          max_tokens: maxTokens,
        }));
        modelProcess.stdin.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  public async sendPrompt(prompt: string, selectedTabs: string[]): Promise<string> {
    const selectedFilesContent =
      selectedTabs.length > 0
        ? `\n\n---\n\nAdditional Context:\n${await this.getSelectedFilesContent(selectedTabs)}`
        : '';

    const fullPrompt = `${prompt}${selectedFilesContent}`;

    const userMessage: Message = { role: 'user', content: fullPrompt };
    this.messageHistory.push(userMessage);

    const response = await this.processStreamedResponse(this.messageHistory);

    const assistantMessage: Message = { role: 'assistant', content: response };
    this.messageHistory.push(assistantMessage);

    return response;
  }

  public async continueGeneration(currentResponse: string, selectedTabs: string[]): Promise<string> {
    const selectedFilesContent =
      selectedTabs.length > 0
        ? `\n\n---\n\nAdditional Context:\n${await this.getSelectedFilesContent(selectedTabs)}`
        : '';

    const continuationPrompt: Message = {
      role: 'user',
      content: `continue${selectedFilesContent}`,
    };

    this.messageHistory.push(continuationPrompt);

    const response = await this.processStreamedResponse(this.messageHistory);

    const assistantMessage: Message = { role: 'assistant', content: response };
    this.messageHistory.push(assistantMessage);

    return response;
  }

  private async getSelectedFilesContent(selectedTabs: string[]): Promise<string> {
    try {
      const fileContents = await Promise.all(
        selectedTabs.map(async (tabUri) => {
          try {
            const uri = vscode.Uri.parse(tabUri);
            const filePath = uri.fsPath;
            const content = fs.readFileSync(filePath, 'utf8');
            return `File: ${filePath}:\n\n${content}`;
          } catch (error) {
            console.error(`Error reading file: ${tabUri}`, error);
            return `Error reading file: ${tabUri}`;
          }
        })
      );
      return fileContents.join('\n\n---\n\n');
    } catch (error) {
      console.error('Error in getSelectedFilesContent:', error);
      return '';
    }
  }

  public clearMemory(): void {
    this.messageHistory = []; // Reinicia el historial
  }

  private cosineSimilarity(embedding1: number[], embedding2: number[]): number {
    const dotProduct = embedding1.reduce((sum, value, i) => sum + value * embedding2[i], 0);
    const magnitude1 = Math.sqrt(embedding1.reduce((sum, value) => sum + value * value, 0));
    const magnitude2 = Math.sqrt(embedding2.reduce((sum, value) => sum + value * value, 0));
    return dotProduct / (magnitude1 * magnitude2);
  }

  public async findSimilarText(query: string, textList: string[]): Promise<Array<{text: string, similarity: number}>> {
    try {
      const results = await Promise.all(
        textList.map(async (text) => {
          const similarity = this.cosineSimilarity([0], [0]); // dummy values
          return { text, similarity };
        })
      );

      // Ordenar por similitud descendente
      return results.sort((a, b) => b.similarity - a.similarity);
    } catch (error) {
      console.error('Error in findSimilarText:', error);
      throw error;
    }
  }
}
