// reads the website and stores text to send to gemini api

// Utility: check if element is visible
function isVisible(el) {
  const style = window.getComputedStyle(el);
  return (
    style &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    el.offsetParent !== null
  );
}

// Extract readable text from page
function extractPageText() {
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode(node) {
        const parent = node.parentElement;
        if (!parent) return NodeFilter.FILTER_REJECT;

        const tag = parent.tagName;
        if (
          ["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG"].includes(tag)
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        if (!isVisible(parent)) {
          return NodeFilter.FILTER_REJECT;
        }

        const text = node.textContent.trim();
        if (text.length < 30) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      }
    }
  );

  const chunks = [];
  while (walker.nextNode()) {
    chunks.push(walker.currentNode.textContent.trim());
  }

  return chunks.join("\n\n");
}

// Store text locally in the content script
let pageTextCache = null;

// Extract once on load
pageTextCache = extractPageText();

// Listen for request from popup/background
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_PAGE_TEXT") {
    sendResponse({
      text: pageTextCache,
      url: location.href,
      title: document.title
    });
    return true; // Required for async response
  }
});
