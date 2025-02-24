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
    chrome.storage.local.get(["chatHistory"], (result) => {
      const history = result.chatHistory || [];
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

  userQueryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = queryInput.value;

    const chatContainer = document.getElementById("chatHistory");
    const userMessageDiv = document.createElement("div");
    userMessageDiv.className = "chat-message user-message";
    userMessageDiv.textContent = query;
    chatContainer.appendChild(userMessageDiv);

    const loadingDiv = document.createElement("div");
    loadingDiv.className = "loading-dots";
    loadingDiv.innerHTML = "<span></span><span></span><span></span>";
    chatContainer.appendChild(loadingDiv);
    loadingDiv.style.display = "block";

    chatContainer.scrollTop = chatContainer.scrollHeight;

    queryInput.value = "";
    autoResize();

    chrome.runtime.sendMessage(
      { action: "getPageContent", query: query },
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
          assistantMessageDiv.className = "chat-message assistant-message";
          assistantMessageDiv.textContent =
            response.data.choices[0].message.content;
          chatContainer.appendChild(assistantMessageDiv);
        } else {
          const errorDiv = document.createElement("div");
          errorDiv.className = "chat-message assistant-message";
          errorDiv.textContent = JSON.stringify(response.data);
          chatContainer.appendChild(errorDiv);
        }
        chatContainer.scrollTop = chatContainer.scrollHeight;
      }
    );
  });

  function autoResize() {
    queryInput.style.height = "auto";
    queryInput.style.height = queryInput.scrollHeight + "px";
  }

  queryInput.addEventListener("input", autoResize);

  autoResize();

  document.getElementById("clearHistory").addEventListener("click", () => {
    chrome.storage.local.remove(["chatHistory"], () => {
      output.textContent = "Chat history cleared!";
    });
  });

  return true;
});
