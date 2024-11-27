# VS Code AI Assistant Extension

Esta extensión proporciona un asistente de inteligencia artificial para ayudarte con tareas de desarrollo dentro de Visual Studio Code. Permite interactuar con un modelo de lenguaje, seleccionar contenido de archivos abiertos y generar respuestas inteligentes en función de tus necesidades.

## Características

- **Prompt personalizado**: Ingresa un prompt para consultar al asistente.
- **Integración con tabs abiertas**: Selecciona archivos abiertos para agregar su contenido al prompt.
- **Respuestas interactivas**: Recibe respuestas generadas por IA directamente en la extensión.

## Estructura del Proyecto

- **`src/SidebarProvider.ts`**: Maneja la lógica de comunicación entre el `webview` y la extensión.
- **`media/webview.html`**: Contiene la interfaz del usuario para el `webview`.
- **`media/styles.css`**: Define los estilos del `webview`.
- **`media/script.js`**: Maneja la interacción de la UI en el `webview`.

## Instalación

1. Clona el repositorio:
   ```bash
   git clone https://github.com/tu_usuario/vs-code-ai-assistant.git
   cd vs-code-ai-assistant
