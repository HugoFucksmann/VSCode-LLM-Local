(function () {
  const vscode = acquireVsCodeApi();
  let currentTabs = [];
  let isProcessing = false;
  let currentResponse = '';
  const chatContainer = document.getElementById('chatContainer');
  const promptInput = document.getElementById('promptInput');
  const sendButton = document.getElementById('sendButton');
  const continueButton = document.getElementById('continueButton');
  const clearMemoryButton = document.getElementById('clearMemory');

  function addMessage(content, type = 'system') {
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', `${type}-message`);

    // Separar el texto en partes (bloques de código y texto normal)
    const parts = content.split(/(```[\s\S]*?```)/);

    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Es un bloque de código
        const codeContent = part.slice(3, -3).trim();
        const codeElement = document.createElement('pre');
        codeElement.classList.add('code-block');
        codeElement.innerHTML = Prism.highlight(codeContent, Prism.languages.javascript, 'javascript');
        messageDiv.appendChild(codeElement);
      } else {
        // Es texto normal
        const textElement = document.createElement('p');
        textElement.textContent = part.trim();
        messageDiv.appendChild(textElement);
      }
    });

    chatContainer.appendChild(messageDiv);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }

  // Request open tabs when the webview loads
  window.addEventListener('load', () => {
    vscode.postMessage({ type: 'getOpenTabs' });

    sendButton.addEventListener('click', () => {
      const prompt = promptInput.value;
      if (!prompt.trim()) return;

      // Añadir mensaje del usuario
      addMessage(prompt, 'user');

      const selectedTabs = currentTabs.filter((tab) => tab.element.checked).map((tab) => tab.uri);

      vscode.postMessage({
        type: 'sendPrompt',
        prompt,
        selectedTabs,
      });

      // Limpiar input
      promptInput.value = '';

      // Clear all checkboxes
      clearAllCheckboxes();
    });

    // Evento para el botón "Continuar Generando"
    continueButton.addEventListener('click', () => {
      if (isProcessing) return;
      isProcessing = true;
      continueGeneration();
    });

    // Evento para el botón "Clear Memory"
    clearMemoryButton.addEventListener('click', () => {
      vscode.postMessage({ type: 'clearMemory' });
      chatContainer.innerHTML = ''; // Limpiar chat
      currentResponse = '';
    });
  });

  // Handle messages from the extension
  window.addEventListener('message', (event) => {
    const message = event.data;

    switch (message.type) {
      case 'updateTabs':
        updateTabs(message.tabs);
        break;
      case 'partialResponse':
      case 'response':
        currentResponse = message.content;
        addMessage(message.content);
        break;
      case 'memoryCleared':
        console.log('Memory successfully cleared');
      case 'loading':
        toggleLoadingSpinner(message.content);
        break;
        break;
    }
  });

  function toggleLoadingSpinner(isLoading) {
    const spinner = document.getElementById('loadingSpinner');
    if (isLoading) {
      spinner.style.display = 'inline-block';
    } else {
      spinner.style.display = 'none';
    }
  }

  function updateTabs(tabs) {
    const fileList = document.getElementById('fileList');
    fileList.innerHTML = '';

    currentTabs = tabs.map((tab) => {
      const item = document.createElement('div');
      item.classList.add('file-item');

      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.classList.add('file-checkbox');
      checkbox.value = tab.uri;

      checkbox.addEventListener('change', (event) => {
        item.classList.toggle('selected', event.target.checked);
        vscode.postMessage({
          type: 'toggleTab',
          tabUri: tab.uri,
          isSelected: event.target.checked,
        });
      });

      const label = document.createElement('span');
      label.textContent = tab.label;
      label.classList.add('file-label');

      item.appendChild(checkbox);
      item.appendChild(label);
      fileList.appendChild(item);

      return {
        uri: tab.uri,
        checked: false,
        element: checkbox,
      };
    });
  }

  // Add this code to handle the dropdown
  const fileSelector = document.getElementById('fileSelector');
  const fileDropdown = document.getElementById('fileDropdown');

  fileSelector.addEventListener('click', (e) => {
    e.stopPropagation();
    const rect = fileSelector.getBoundingClientRect();
    fileDropdown.style.bottom = `${window.innerHeight - rect.top + 10}px`;
    fileDropdown.style.left = `${rect.left}px`;
    fileDropdown.classList.toggle('active');
  });

  document.addEventListener('click', (e) => {
    if (!fileDropdown.contains(e.target) && !fileSelector.contains(e.target)) {
      fileDropdown.classList.remove('active');
    }
  });

  // Prevent closing when clicking inside dropdown
  fileDropdown.addEventListener('click', (e) => {
    e.stopPropagation();
  });

  async function continueGeneration() {
    vscode.postMessage({
      type: 'continueGeneration',
      currentResponse: currentResponse,
    });
  }

  let fullConversation = ''; // Almacena la conversación completa
  function updateResponse(content) {
    currentResponse = content;
    const responseElement = document.getElementById('response');
    responseElement.innerHTML = ''; // Limpiar contenido previo

    // Separar el texto en partes (bloques de código y texto normal)
    const parts = content.split(/(```[\s\S]*?```)/); // Dividir por bloques de código delimitados

    parts.forEach((part) => {
      if (part.startsWith('```') && part.endsWith('```')) {
        // Es un bloque de código
        const codeContent = part.slice(3, -3).trim(); // Remover las comillas de inicio y fin
        const codeElement = document.createElement('pre'); // Contenedor del código
        codeElement.className = 'code-block'; // Clase para estilo
        codeElement.innerHTML = Prism.highlight(codeContent, Prism.languages.javascript, 'javascript'); // Resaltar
        responseElement.appendChild(codeElement); // Añadir al contenedor principal
      } else {
        // Es texto normal
        const textElement = document.createElement('p');
        textElement.textContent = part.trim();
        responseElement.appendChild(textElement);
      }
    });
  }

  function showContinueButton() {
    document.getElementById('continueButton').style.display = 'block';
  }

  function hideContinueButton() {
    document.getElementById('continueButton').style.display = 'none';
  }

  function clearAllCheckboxes() {
    currentTabs.forEach((tab) => {
      tab.element.checked = false;
      tab.element.closest('.file-item').classList.remove('selected');
    });
  }
})();
