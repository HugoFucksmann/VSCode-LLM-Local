import * as vscode from "vscode";
import axios from "axios";

export class CodeFixer {
  async fixCode(code: string): Promise<void> {
    try {
      const editor = vscode.window.activeTextEditor;
      if (!editor) {
        return;
      }

      const response = await axios.post(
        "http://localhost:1234/v1/chat/completions ",
        {
          prompt: `Fix the following code:\n\n${code}`,
          temperature: 0.3,
          max_tokens: 1000,
        }
      );

      const fixedCode = response.data.results[0].text;

      const edit = new vscode.WorkspaceEdit();
      const document = editor.document;

      edit.replace(
        document.uri,
        new vscode.Range(0, 0, document.lineCount, 0),
        fixedCode
      );

      await vscode.workspace.applyEdit(edit);
      await document.save();

      vscode.window.showInformationMessage("Code has been fixed!");
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      vscode.window.showErrorMessage("Failed to fix code: " + errorMessage);
    }
  }
}
