"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConsoleManager = void 0;
const vscode = __importStar(require("vscode"));
const child_process_1 = require("child_process");
const util_1 = require("util");
const execAsync = (0, util_1.promisify)(child_process_1.exec);
class ConsoleManager {
    constructor() {
        this.outputChannel = vscode.window.createOutputChannel("CursorIA");
    }
    async runDiagnostics(code) {
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
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            this.outputChannel.appendLine(`Error: ${errorMessage}`);
        }
    }
    async analyze(code) {
        // Implementa aquí tu lógica de análisis
        return {
            hasErrors: code.includes("error"),
            output: "Analysis completed",
        };
    }
}
exports.ConsoleManager = ConsoleManager;
//# sourceMappingURL=ConsoleManager.js.map