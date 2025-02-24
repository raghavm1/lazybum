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
    return true;
  }
});

function getBodyContent() {
  const textContent = document.body.innerText;
  const htmlContent = document.documentElement.outerHTML;

  const title = document.title;
  const url = window.location.href;

  const mainContent = Array.from(
    document.querySelectorAll('main, article, [role="main"]')
  )
    .map((el) => el.innerText)
    .join("\n");

  const headings = Array.from(
    document.querySelectorAll("h1, h2, h3, h4, h5, h6")
  )
    .map((h) => `${h.tagName}: ${h.innerText}`)
    .join("\n");

  return {
    title,
    url,
    mainContent,
    headings,
    textContent,
    htmlContent,
  };
}

function callOpenAIAPI(pageContent, query, sendResponse) {
  chrome.storage.sync.get(["oai_key"], (result) => {
    const apiKey = result.oai_key;
    if (!apiKey) {
      sendResponse({ error: "API key is not set." });
      return;
    }

    chrome.storage.local.get(["chatHistory"], (result) => {
      let history = result.chatHistory || [];

      const currentSessionMessages = history.filter((msg) => {
        return true;
      });

      const contentSummary = `
Page Title: ${pageContent.title}
URL: ${pageContent.url}
Main Headings:
${pageContent.headings}

Main Content:
${pageContent.mainContent.slice(0, 5000)}
      `.trim();

      const systemMessage =
        currentSessionMessages.length > 0
          ? `You are an AI assistant analyzing a webpage. Here's the content: ${contentSummary}\n\nPrevious conversation context:\n${currentSessionMessages
              .map(
                (msg) =>
                  `${msg.role === "user" ? "Question" : "Answer"}: ${
                    msg.content
                  }`
              )
              .join("\n")}`
          : `You are an AI assistant analyzing a webpage. Here's the content: ${contentSummary}`;

      history.push({
        role: "user",
        content: query,
      });

      history = history.slice(-5);

      fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: systemMessage,
            },
            ...history,
          ],
          max_tokens: 150,
        }),
      })
        .then((response) => response.json())
        .then((data) => {
          if (data.choices && data.choices[0]) {
            history.push({
              role: "assistant",
              content: data.choices[0].message.content,
            });
            chrome.storage.local.set({ chatHistory: history });
          }
          sendResponse({ data: data });
        })
        .catch((error) => sendResponse({ error: error.message }));
    });
  });
  return true;
}
