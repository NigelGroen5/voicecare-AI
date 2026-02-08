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

function sendTabMessage(tabId, payload) {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message || 'Tab message failed'));
        return;
      }
      resolve(response);
    });
  });
}

function tokenize(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((t) => t.length > 2);
}

function selectBestAction(actions, question) {
  if (!Array.isArray(actions) || actions.length === 0) return null;
  const qTokens = new Set(tokenize(question));
  if (qTokens.size === 0) return null;

  const intentHints = {
    appointment: ['appointment', 'book', 'schedule', 'visit'],
    signin: ['sign', 'login', 'log', 'account'],
    register: ['register', 'signup', 'create', 'join'],
    checkout: ['checkout', 'buy', 'purchase', 'cart', 'pay'],
    contact: ['contact', 'support', 'help', 'call', 'email'],
    menu: ['menu', 'navigation', 'nav'],
  };

  let best = null;
  let bestScore = -1;
  for (const action of actions) {
    const label = String(action?.label || '').toLowerCase();
    const tokens = tokenize(label);
    if (tokens.length === 0) continue;

    let score = 0;
    for (const t of tokens) {
      if (qTokens.has(t)) score += 3;
    }

    for (const words of Object.values(intentHints)) {
      const qHasIntent = words.some((w) => qTokens.has(w));
      const labelHasIntent = words.some((w) => label.includes(w));
      if (qHasIntent && labelHasIntent) score += 4;
    }

    if (action.tag === 'button') score += 1;
    if (score > bestScore) {
      bestScore = score;
      best = action;
    }
  }

  return bestScore > 0 ? best : null;
}

function isNotFoundAnswer(text) {
  const value = String(text || '').toLowerCase();
  return value.includes("i can’t find that on this page") || value.includes("i can't find that on this page");
}

function buildHeuristicGuideAnswer(question, action) {
  const label = action?.label || 'that button';
  return [
    'Step 1. Look for the highlighted area on the page.',
    `Step 2. Click "${label}".`,
    'Step 3. If needed, follow the next prompt on the page.',
    `I picked this based on your request: "${question}".`,
  ].join('\n');
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

  if (msg.action === 'ASK_QUESTION') {
    (async () => {
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab?.id) {
          sendResponse({ error: 'No active tab' });
          return;
        }

        const page = await sendTabMessage(tab.id, { action: 'GET_PAGE_TEXT' });
        const actionablesResponse = await sendTabMessage(tab.id, { action: 'GET_ACTIONABLE_ELEMENTS' });
        const actions = actionablesResponse?.actions || [];
        const heuristicTarget = selectBestAction(actions, msg.question);

        // Ask backend for guided steps + target selector.
        let guideData = null;
        const guideRes = await fetch(BACKEND_URL + '/guide', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            question: msg.question,
            title: page.title,
            url: page.url,
            text: page.text,
            actions,
            language: 'en',
          }),
        });
        if (guideRes.ok) {
          guideData = await guideRes.json();
        }

        // Fallback to normal Q&A if guided call fails.
        let answer = guideData?.answer;
        if (!answer) {
          const res = await fetch(BACKEND_URL + '/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              question: msg.question,
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
          answer = data.answer;
        }

        let highlight = null;
        const selectedTarget = guideData?.target?.selector ? guideData.target : heuristicTarget;

        if (selectedTarget?.selector) {
          try {
            highlight = await sendTabMessage(tab.id, {
              action: 'HIGHLIGHT_SELECTOR',
              selector: selectedTarget.selector,
              note: `Next: ${selectedTarget.label || 'Click here'}`,
            });
          } catch (highlightErr) {
            highlight = { ok: false, reason: highlightErr.message || 'Failed to highlight target' };
          }
        }

        if (isNotFoundAnswer(answer) && selectedTarget?.selector) {
          answer = buildHeuristicGuideAnswer(msg.question, selectedTarget);
        }

        // Get TTS audio for the answer
        let audioData = null;
        try {
          const ttsRes = await fetch(BACKEND_URL + '/speak', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: answer }),
          });

          if (ttsRes.ok) {
            const ttsData = await ttsRes.json();
            if (ttsData.audio) {
              audioData = ttsData.audio;
            }
          }
        } catch (ttsError) {
          console.error('TTS error:', ttsError);
          // Continue even if TTS fails
        }

        sendResponse({ answer, audio: audioData, highlight });
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
