c// listens for messages from popup and content scripts, coordinates actions

hrome.tabs.sendMessage(tabId, { action: "GET_PAGE_TEXT" }, (response) => {
  const pageText = response.text;
  // send pageText to Gemini API
});