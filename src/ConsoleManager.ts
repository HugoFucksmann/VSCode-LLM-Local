import * as vscode from "vscode";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export class ConsoleManager {
  private outputChannel: vscode.OutputChannel;

  constructor() {
    this.outputChannel = vscode.window.createOutputChannel("CursorIA");
  }

  async runDiagnostics(code: string): Promise<void> {
    try {
      this.outputChannel.show();
      this.outputChannel.appendLine("Running diagnostics...");

      // Aquí puedes agregar la lógica específica para analizar el código
      const result = await this.analyze(code);

      if (result.hasErrors) {
        vscode.window
          .showWarningMessage("Issues found in code", "Fix Issues")
          .then((selection) => {
            if (selection === "Fix Issues") {
              vscode.commands.executeCommand("cursorIA.fixCode");
            }
          });
      }

      this.outputChannel.appendLine(result.output);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An unknown error occurred";
      this.outputChannel.appendLine(`Error: ${errorMessage}`);
    }
  }

  private async analyze(code: string) {
    // Implementa aquí tu lógica de análisis
    return {
      hasErrors: code.includes("error"),
      output: "Analysis completed",
    };
  }
}
