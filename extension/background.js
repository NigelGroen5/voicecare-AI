// Listens for messages from popup and content scripts; gets page text and calls backend (Gemini).

const BACKEND_URL = 'http://localhost:3000';

function isDriveOrDocs(url) {
  if (!url) return false;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    return host === 'drive.google.com' || host === 'docs.google.com';
  } catch {
    return false;
  }
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === 'GET_CURRENT_TAB_URL') {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      sendResponse({ url: tabs[0]?.url || '' });
    });
    return true;
  }

  if (msg.action === 'GET_GUIDE') {
    (async () => {
      try {
        const res = await fetch(BACKEND_URL + '/summarize', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guide: msg.guide || 'create-document-drive' }),
        });
        const data = await res.json();
        if (!res.ok) {
          sendResponse({ error: data.error || 'Backend error' });
          return;
        }
        sendResponse({ summary: data.summary });
      } catch (e) {
        const m = e.message || 'Something went wrong';
        const hint = (m.includes('fetch') || m.includes('Failed') || m.includes('Network'))
          ? ' Run "npm run server" in the project folder and try again.' : '';
        sendResponse({ error: m + hint });
      }
    })();
    return true;
  }

  if (msg.action !== 'SUMMARIZE_PAGE') return;
  (async () => {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        sendResponse({ error: 'No active tab' });
        return;
      }
      const page = await new Promise((resolve, reject) => {
        chrome.tabs.sendMessage(tab.id, { action: 'GET_PAGE_TEXT' }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error('Could not read page. Try refreshing the tab.'));
            return;
          }
          resolve(response);
        });
      });
      const res = await fetch(BACKEND_URL + '/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: page.title,
          url: page.url,
          text: page.text,
          language: 'en',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        sendResponse({ error: data.error || 'Backend error' });
        return;
      }
      sendResponse({ summary: data.summary });
    } catch (e) {
      const msg = e.message || 'Something went wrong';
      const hint =
        msg.includes('fetch') || msg.includes('Failed') || msg.includes('Network')
          ? ' Run "npm run server" in the project folder and try again.'
          : '';
      sendResponse({ error: msg + hint });
    }
  })();
  return true;
});
