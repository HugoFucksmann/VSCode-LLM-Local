import * as vscode from 'vscode';
import { SidebarProvider } from './SidebarProvider';
import { CodeAnalysisService, CodeAnalysisResult } from './services/codeAnalysisService';
import { AIService } from './services/aiService';

export function activate(context: vscode.ExtensionContext) {
  const sidebarProvider = new SidebarProvider(context.extensionUri);

  context.subscriptions.push(vscode.window.registerWebviewViewProvider('cursorIA.sidebar', sidebarProvider));

  let disposable = vscode.commands.registerCommand('cursorIA.openPanel', () => {
    vscode.commands.executeCommand('cursorIA.sidebar.focus');
  });

  context.subscriptions.push(disposable);

  // Comando para buscar código similar
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorIA.findSimilarCode', async () => {
      const aiService = new AIService();
      
      // Obtener el texto seleccionado
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No hay un editor activo');
        return;
      }

      const selection = editor.selection;
      const text = editor.document.getText(selection);
      
      if (!text) {
        vscode.window.showInformationMessage('Por favor selecciona algún código para buscar similares');
        return;
      }

      // Obtener todos los archivos del workspace
      const files = await vscode.workspace.findFiles('**/*.{ts,js,tsx,jsx}');
      const fileContents = await Promise.all(
        files.map(async file => {
          const document = await vscode.workspace.openTextDocument(file);
          return document.getText();
        })
      );

      try {
        const results = await aiService.findSimilarText(text, fileContents);
        
        // Mostrar resultados en un QuickPick
        const items = results.map((result: { text: string; similarity: number }) => ({
          label: `Similitud: ${(result.similarity * 100).toFixed(2)}%`,
          detail: result.text.substring(0, 200) + '...', // Mostrar los primeros 200 caracteres
        }));

        vscode.window.showQuickPick(items, {
          placeHolder: 'Código similar encontrado',
          matchOnDetail: true
        });
      } catch (error: any) {
        vscode.window.showErrorMessage('Error al buscar código similar: ' + error.message);
      }
    })
  );

  // Comando para analizar código
  context.subscriptions.push(
    vscode.commands.registerCommand('cursorIA.analyzeCode', async () => {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        vscode.window.showInformationMessage('No hay un editor activo');
        return;
      }

      const document = editor.document;
      const position = editor.selection.active;
      const code = document.getText();

      const analysisService = new CodeAnalysisService();

      try {
        // Parsear el código
        const ast = analysisService.parseCode(code);

        // Encontrar el nodo en la posición del cursor
        const result: CodeAnalysisResult | null = analysisService.findNodeAtPosition(
          ast,
          position.line + 1,
          position.character
        );

        if (!result) {
          vscode.window.showInformationMessage('No se encontró un nodo válido en la posición actual');
          return;
        }

        // Obtener sugerencias del modelo
        const suggestions = await analysisService.getSuggestions(result.code);

        // Mostrar las sugerencias al usuario
        const action = await vscode.window.showInformationMessage(
          'Sugerencias de mejora encontradas. ¿Desea aplicarlas?',
          'Aplicar',
          'Cancelar'
        );

        if (action === 'Aplicar') {
          const edit = new vscode.WorkspaceEdit();
          // Aquí implementarías la lógica para aplicar los cambios
          // usando analysisService.applyChanges()
          await vscode.workspace.applyEdit(edit);
        }
      } catch (error: unknown) {
        if (error instanceof Error) {
          vscode.window.showErrorMessage('Error al analizar el código: ' + error.message);
        } else {
          vscode.window.showErrorMessage('Error desconocido al analizar el código');
        }
      }
    })
  );
}
