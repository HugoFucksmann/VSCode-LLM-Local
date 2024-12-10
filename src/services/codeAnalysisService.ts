import * as parser from '@babel/parser';
import traverse, { NodePath } from '@babel/traverse';
import * as t from '@babel/types';

export interface CodeAnalysisResult {
    node: t.Node;
    path: string;
    code: string;
}

export class CodeAnalysisService {
    // Analiza el código y devuelve el AST
    public parseCode(code: string): t.File {
        return parser.parse(code, {
            sourceType: 'module',
            plugins: ['typescript', 'jsx'],
        });
    }

    // Encuentra el nodo específico en el código basado en la posición del cursor
    public findNodeAtPosition(ast: t.File, line: number, column: number): CodeAnalysisResult | null {
        let targetNode: t.Node | null = null;
        let nodePath = '';

        traverse(ast, {
            enter(path: NodePath, state: any) {
                const loc = path.node.loc;
                if (loc && 
                    loc.start.line <= line && 
                    loc.end.line >= line &&
                    loc.start.column <= column &&
                    loc.end.column >= column) {
                    // Encontrar el nodo más específico
                    if (!targetNode || 
                        (targetNode.loc &&
                         (loc.end.line - loc.start.line < targetNode.loc.end.line - targetNode.loc.start.line))) {
                        targetNode = path.node;
                        nodePath = path.scope.path.toString();
                    }
                }
            }
        });

        if (!targetNode) {
            return null;
        }

        return {
            node: targetNode,
            path: nodePath,
            code: this.getNodeCode(targetNode)
        };
    }

    // Extrae el código del nodo
    private getNodeCode(node: t.Node): string {
        if (node.loc) {
            // Aquí normalmente extraerías el código original basado en la ubicación
            return node.type;
        }
        return '';
    }

    // Envía el código al modelo de IA y obtiene sugerencias
    public async getSuggestions(code: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const modelProcess = require('child_process').spawn('ollama', ['run', 'qwen2.5-coder:7b']);

            let fullResponse = '';

            modelProcess.stdout.on('data', (data: Buffer) => {
                fullResponse += data.toString();
            });

            modelProcess.stderr.on('data', (data: Buffer) => {
                console.error(`Error: ${data.toString()}`);
            });

            modelProcess.on('close', (code: number) => {
                if (code !== 0) {
                    reject(new Error(`Model process exited with code ${code}`));
                } else {
                    resolve(fullResponse);
                }
            });

            // Enviar el mensaje al modelo
            modelProcess.stdin.write(JSON.stringify({
                messages: [
                    {
                        role: 'system',
                        content: 'Analiza el siguiente código y sugiere mejoras manteniendo la funcionalidad existente:'
                    },
                    {
                        role: 'user',
                        content: code
                    }
                ],
                temperature: 0.2,
                max_tokens: 500
            }));
            modelProcess.stdin.end();
        });
    }

    // Aplica los cambios sugeridos al código original
    public applyChanges(originalCode: string, modifiedNode: string, nodeLocation: { start: number, end: number }): string {
        return originalCode.slice(0, nodeLocation.start) + 
               modifiedNode + 
               originalCode.slice(nodeLocation.end);
    }
}
