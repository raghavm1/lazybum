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
            bodyContent.selectedText = request.selectedText;
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

    const urlKey = createUrlKey(pageContent.url);
    const historyKey = `chatHistory_${urlKey}`;

    chrome.storage.local.get([historyKey], (result) => {
      let history = result[historyKey] || [];
      const currentSessionMessages = history.filter((msg) => true);

      // adding selection tesxt if it exists
      const selectedTextSection = pageContent.selectedText
        ? `\n\nSELECTED TEXT:
=========================
"${pageContent.selectedText}"
=========================

The user's question is specifically about the text selected above.`
        : "";

      const contentSummary = `
Page Title: ${pageContent.title}
URL: ${pageContent.url}
${selectedTextSection}

Additional Page Context:
----------------------
${pageContent.mainContent}
      `.trim();

      const systemMessage = `You are an AI assistant analyzing a webpage. ${
        pageContent.selectedText
          ? "Focus specifically on the selected text when answering."
          : "Analyze the general page content."
      }

${contentSummary}`;

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
            // Save history with URL-specific key
            const saveData = {};
            saveData[historyKey] = history;
            chrome.storage.local.set(saveData);
          }
          sendResponse({ data: data });
        })
        .catch((error) => sendResponse({ error: error.message }));
    });
  });
  return true;
}

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
