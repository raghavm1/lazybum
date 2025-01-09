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

  userQueryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const query = queryInput.value;
    console.log("processing");
    output.textContent = "Processing...";

    chrome.runtime.sendMessage(
      { action: "getPageContent", query: query },
      (response) => {
        if (response.error) {
          output.textContent = `Error: ${response.error}`;
        } else if (
          response.data &&
          response.data.choices &&
          response.data.choices.length > 0
        ) {
          console.log("Got it");
          output.textContent = response.data.choices[0].message.content;
          document.getElementById("output").textContent = JSON.stringify(
            output.textContent,
            null,
            2
          );
        } else {
          output.textContent = JSON.stringify(response.data);
        }
      }
    );
  });
  return true;
});
