// Summarize page, optional Drive guide, Read aloud via Gradium.

const btn = document.getElementById('btn');
const guideBtn = document.getElementById('guideBtn');
const readBtn = document.getElementById('readBtn');
const stopBtn = document.getElementById('stopBtn');
const out = document.getElementById('out');

const BACKEND = 'http://localhost:3000';

let lastSummary = '';
let currentAudio = null;

function show(msg, kind) {
  out.textContent = msg || '';
  out.className = kind || '';
}

function setSummary(summary) {
  lastSummary = summary || '';
  readBtn.style.display = lastSummary ? 'inline-block' : 'none';
  stopBtn.style.display = lastSummary ? 'inline-block' : 'none';
}

function stopReading() {
  if (currentAudio) {
    currentAudio.pause();
    currentAudio.currentTime = 0;
    currentAudio = null;
  }
}

async function readAloud() {
  if (!lastSummary) return;
  stopReading();
  readBtn.disabled = true;
  show('Generating Gradium voice…', 'loading');

  try {
    const res = await fetch(BACKEND + '/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: lastSummary }),
    });
    const data = await res.json();
    if (!res.ok) {
      show('Error: ' + (data.error || res.statusText), 'error');
      readBtn.disabled = false;
      return;
    }
    if (!data.audio) {
      show('No audio returned.', 'error');
      readBtn.disabled = false;
      return;
    }
    show(lastSummary, '');
    const audio = new Audio('data:audio/wav;base64,' + data.audio);
    currentAudio = audio;
    audio.onended = () => { readBtn.disabled = false; };
    audio.onerror = () => {
      show('Playback error.', 'error');
      readBtn.disabled = false;
    };
    await audio.play();
  } catch (e) {
    show('Error: ' + (e.message || 'Could not reach server. Run: npm run server'), 'error');
    readBtn.disabled = false;
  }
}

readBtn.addEventListener('click', readAloud);
stopBtn.addEventListener('click', stopReading);

window.addEventListener('pagehide', stopReading);

// Show "How do I create a document?" when on Google Drive or Docs
chrome.runtime.sendMessage({ action: 'GET_CURRENT_TAB_URL' }, (response) => {
  if (chrome.runtime.lastError) return;
  const url = response?.url || '';
  if (url.includes('drive.google.com') || url.includes('docs.google.com')) {
    guideBtn.style.display = 'inline-block';
  }
});

guideBtn.addEventListener('click', () => {
  stopReading();
  setSummary('');
  guideBtn.disabled = true;
  show('Getting step-by-step guide… (keep this popup open)', 'loading');

  const timeout = setTimeout(() => {
    if (out.textContent.startsWith('Getting step-by-step')) {
      guideBtn.disabled = false;
      show('Took too long. Is the server running? Run: npm run server', 'error');
    }
  }, 25000);

  chrome.runtime.sendMessage({ action: 'GET_GUIDE', guide: 'create-document-drive' }, (response) => {
    clearTimeout(timeout);
    guideBtn.disabled = false;
    if (chrome.runtime.lastError) {
      show('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    if (!response) {
      show('No response. Keep the popup open and try again. Run: npm run server', 'error');
      return;
    }
    if (response.error) {
      show('Error: ' + response.error, 'error');
      return;
    }
    const summary = response.summary || '(No guide returned)';
    show(summary, '');
    setSummary(summary);
  });
});

btn.addEventListener('click', () => {
  stopReading();
  setSummary('');
  btn.disabled = true;
  show('Reading page and asking Gemini… (keep this popup open)', 'loading');

  const timeout = setTimeout(() => {
    if (out.textContent.startsWith('Reading page')) {
      btn.disabled = false;
      show(
        'Took too long. Is the server running? In the project folder run: npm run server',
        'error'
      );
    }
  }, 25000);

  chrome.runtime.sendMessage({ action: 'SUMMARIZE_PAGE' }, (response) => {
    clearTimeout(timeout);
    btn.disabled = false;
    if (chrome.runtime.lastError) {
      show('Error: ' + chrome.runtime.lastError.message, 'error');
      return;
    }
    if (!response) {
      show('No response. Keep the popup open and try again. Run: npm run server', 'error');
      return;
    }
    if (response.error) {
      show('Error: ' + response.error, 'error');
      return;
    }
    const summary = response.summary || '(No summary returned)';
    show(summary, '');
    setSummary(summary);
  });
});
