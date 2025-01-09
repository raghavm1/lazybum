// background.js

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getPageContent") {
    console.log("request received in background");
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        sendResponse({ error: "Error accessing tabs" });
        return;
      }

      if (tabs.length === 0) {
        console.error("No active tab found");
        sendResponse({ error: "No active tab found" });
        return;
      }

      const activeTab = tabs[0];
      if (!activeTab.id) {
        console.error("Active tab has no ID");
        sendResponse({ error: "Active tab has no ID" });
        return;
      }

      chrome.scripting.executeScript(
        {
          target: { tabId: activeTab.id },
          function: getBodyContent,
        },
        (results) => {
          if (chrome.runtime.lastError) {
            console.error(chrome.runtime.lastError);
            sendResponse({ error: chrome.runtime.lastError.message });
          } else if (!results || results.length === 0) {
            sendResponse({ error: "Failed to get page content" });
          } else {
            const bodyContent = results[0].result;
            callOpenAIAPI(bodyContent, request.query, sendResponse);
          }
        }
      );
    });
    return true; // Indicates we will send a response asynchronously
  }
});

function getBodyContent() {
  return document.body.innerText;
}

function callOpenAIAPI(bodyContent, query, sendResponse) {
  chrome.storage.sync.get(["oai_key"], (result) => {
    const apiKey = result.oai_key;
    if (!apiKey) {
      sendResponse({ error: "API key is not set." });
      return;
    }
    console.log("about to ask openai...");
    fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o", // Use the correct model name
        messages: [
          // { role: "user", content: "Say this is a test" },
          {
            role: "user",
            content: `Given the following webpage content: "${bodyContent.slice(
              0,
              20000
            )}", answer this question and don't be too verbose: "${query}"`,
          },
        ],
        max_tokens: 150,
      }),
    })
      .then((response) => response.json())
      .then((data) => sendResponse({ data: data }))
      .catch((error) => sendResponse({ error: error.message }));
  });
  return true;
}
