// aiService.ts
import axios from 'axios';
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
        const response = axios({
          method: 'post',
          url: 'http://localhost:1234/v1/chat/completions',
          data: {
            model: 'Qwen/Qwen2.5-Coder-14B-Instruct-GGUF',
            messages: messages,
            temperature: temperature,
            max_tokens: maxTokens,
            stream: true,
          },
          responseType: 'stream',
        });

        let fullResponse = '';

        response
          .then((res) => {
            res.data.on('data', (chunk: any) => {
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
                    }
                  } catch (parseError) {
                    console.error('Error parsing JSON:', parseError);
                  }
                }
              });
            });

            res.data.on('end', () => resolve(fullResponse));
          })
          .catch(reject);
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
    // Procesa contenido de archivos aquí
    return selectedTabs.join(', ');
  }

  public clearMemory(): void {
    this.messageHistory = []; // Reinicia el historial
  }
}

