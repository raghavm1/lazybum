document.addEventListener("DOMContentLoaded", function () {
  const apiAdderForm = document.getElementById("apiAdder");
  const submitButtonAPI = document.getElementById("submitButtonAPI");
  const output = document.getElementById("output");
  const textInputAPI = document.getElementById("textInput");
  const apiAdderContainer = document.getElementById("apiAdderContainer");
  const formContainer = document.getElementById("formContainer");
  const removerContainer = document.getElementById("removerContainer");
  const removerButton = document.getElementById("removeAPIkey");
  const userQueryForm = document.getElementById("queryForm");
  const queryInput = document.getElementById("queryInput");

  chrome.storage.sync.get(["oai_key"], function (result) {
    if (result.oai_key) {
      apiAdderContainer.style.display = "none";
      formContainer.style.display = "block";
    } else {
      apiAdderContainer.style.display = "block";
      formContainer.style.display = "none";
    }
  });

  apiAdderForm.addEventListener("submit", function (event) {
    event.preventDefault();
    const api_key = textInputAPI.value;

    chrome.storage.sync.set({ oai_key: api_key }, function () {
      console.log("API key saved successfully.");
      apiAdderContainer.style.display = "none";
      formContainer.style.display = "block";
      output.textContent = "API key saved!";
    });
  });

  removerButton.addEventListener("click", () => {
    chrome.storage.sync.remove(["oai_key"], () => {
      console.log("API key removed");
      apiAdderContainer.style.display = "block";
      formContainer.style.display = "none";
      output.textContent = "API key removed!";
    });
  });

  function displayChatHistory() {
    const chatContainer = document.getElementById("chatHistory");

    // Get current tab URL to fetch the correct history
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const urlKey = createUrlKey(tabs[0].url);
        const historyKey = `chatHistory_${urlKey}`;

        chrome.storage.local.get([historyKey], (result) => {
          const history = result[historyKey] || [];
          chatContainer.innerHTML = "";

          history.forEach((message) => {
            const messageDiv = document.createElement("div");
            messageDiv.className = `chat-message ${message.role}-message`;
            messageDiv.textContent = message.content;
            chatContainer.appendChild(messageDiv);
          });

          chatContainer.scrollTop = chatContainer.scrollHeight;
        });
      }
    });
  }

  function createSelectionPreview(selectedText) {
    if (!selectedText) return null;

    const previewDiv = document.createElement("div");
    previewDiv.className = "selection-preview";

    const truncatedText =
      selectedText.length > 100
        ? selectedText.slice(0, 100) + "..."
        : selectedText;

    previewDiv.innerHTML = `
      <div class="selected-text-bubble">
        <span class="selection-label">Selected Text:</span>
        <p>${truncatedText}</p>
      </div>
    `;
    return previewDiv;
  }

  userQueryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = queryInput.value;
    const chatContainer = document.getElementById("chatHistory");

    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: () => window.getSelection().toString().trim(),
        },
        (results) => {
          const selectedText =
            results && results[0] && results[0].result ? results[0].result : "";

          if (selectedText) {
            const selectionPreview = createSelectionPreview(selectedText);
            chatContainer.appendChild(selectionPreview);
          }

          const userMessageDiv = document.createElement("div");
          userMessageDiv.className = "chat-message user-message";
          userMessageDiv.textContent = query;
          chatContainer.appendChild(userMessageDiv);

          const loadingDiv = document.createElement("div");
          loadingDiv.className = "loading-dots";
          loadingDiv.innerHTML = "<span></span><span></span><span></span>";
          chatContainer.appendChild(loadingDiv);

          chatContainer.scrollTop = chatContainer.scrollHeight;

          queryInput.value = "";
          autoResize();

          chrome.runtime.sendMessage(
            {
              action: "getPageContent",
              query: query,
              selectedText: selectedText,
            },
            (response) => {
              loadingDiv.remove();

              if (response.error) {
                const errorDiv = document.createElement("div");
                errorDiv.className = "chat-message assistant-message";
                errorDiv.textContent = `Error: ${response.error}`;
                chatContainer.appendChild(errorDiv);
              } else if (
                response.data &&
                response.data.choices &&
                response.data.choices.length > 0
              ) {
                const assistantMessageDiv = document.createElement("div");
                assistantMessageDiv.className =
                  "chat-message assistant-message";
                assistantMessageDiv.textContent =
                  response.data.choices[0].message.content;
                chatContainer.appendChild(assistantMessageDiv);
              }
              chatContainer.scrollTop = chatContainer.scrollHeight;
            }
          );
        }
      );
    });
  });

  function autoResize() {
    queryInput.style.height = "auto";
    queryInput.style.height = queryInput.scrollHeight + "px";
  }

  queryInput.addEventListener("input", autoResize);

  autoResize();

  document.getElementById("clearHistory").addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        const urlKey = createUrlKey(tabs[0].url);
        const historyKey = `chatHistory_${urlKey}`;

        chrome.storage.local.remove([historyKey], () => {
          console.log("Chat history cleared for current page");
          displayChatHistory(); // Refresh the display
        });
      }
    });
  });

  function checkForSelectedText() {
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      chrome.scripting.executeScript(
        {
          target: { tabId: tabs[0].id },
          function: () => window.getSelection().toString().trim(),
        },
        (results) => {
          const selectedText = results && results[0] && results[0].result;
          const queryInput = document.getElementById("queryInput");

          if (selectedText) {
            queryInput.placeholder = "Ask about the selected text...";
          } else {
            queryInput.placeholder = "Ask a question about this page...";
          }
        }
      );
    });
  }

  checkForSelectedText();

  return true;
});

function createUrlKey(url) {
  try {
    const urlObj = new URL(url);
    const key = (urlObj.hostname + urlObj.pathname)
      .replace(/[^a-zA-Z0-9]/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 100);

    return key || "default";
  } catch (e) {
    return "default";
  }
}
