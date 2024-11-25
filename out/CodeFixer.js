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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeFixer = void 0;
const vscode = __importStar(require("vscode"));
const axios_1 = __importDefault(require("axios"));
class CodeFixer {
    async fixCode(code) {
        try {
            const editor = vscode.window.activeTextEditor;
            if (!editor) {
                return;
            }
            const response = await axios_1.default.post("http://localhost:1234/v1/chat/completions ", {
                prompt: `Fix the following code:\n\n${code}`,
                temperature: 0.3,
                max_tokens: 1000,
            });
            const fixedCode = response.data.results[0].text;
            const edit = new vscode.WorkspaceEdit();
            const document = editor.document;
            edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), fixedCode);
            await vscode.workspace.applyEdit(edit);
            await document.save();
            vscode.window.showInformationMessage("Code has been fixed!");
        }
        catch (error) {
            const errorMessage = error instanceof Error ? error.message : "An unknown error occurred";
            vscode.window.showErrorMessage("Failed to fix code: " + errorMessage);
        }
    }
}
exports.CodeFixer = CodeFixer;
//# sourceMappingURL=CodeFixer.js.map