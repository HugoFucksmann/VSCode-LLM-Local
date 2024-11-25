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
exports.activate = activate;
const vscode = __importStar(require("vscode"));
const SidebarProvider_1 = require("./SidebarProvider");
const ConsoleManager_1 = require("./ConsoleManager");
const CodeFixer_1 = require("./CodeFixer");
function activate(context) {
    const sidebarProvider = new SidebarProvider_1.SidebarProvider(context.extensionUri);
    const consoleManager = new ConsoleManager_1.ConsoleManager();
    const codeFixer = new CodeFixer_1.CodeFixer();
    context.subscriptions.push(vscode.window.registerWebviewViewProvider("cursorIA.sidebar", sidebarProvider));
    let disposable = vscode.commands.registerCommand("cursorIA.openPanel", () => {
        vscode.commands.executeCommand("cursorIA.sidebar.focus");
    });
    context.subscriptions.push(disposable);
    // Register message handlers
    context.subscriptions.push(vscode.commands.registerCommand("cursorIA.analyzeCode", async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const text = activeEditor.document.getText();
            await consoleManager.runDiagnostics(text);
        }
    }));
    context.subscriptions.push(vscode.commands.registerCommand("cursorIA.fixCode", async () => {
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const text = activeEditor.document.getText();
            await codeFixer.fixCode(text);
        }
    }));
}
//# sourceMappingURL=extension.js.map