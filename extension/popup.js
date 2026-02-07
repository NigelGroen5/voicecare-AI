document.addEventListener("DOMContentLoaded", () => {
  const micButton = document.getElementById("micBtn");
  const statusEl = document.getElementById("status");
  const chips = document.getElementById("chips");
  const toast = document.getElementById("toast");
  const outputEl = document.getElementById("output");

  let listening = false;
  let toastTimer = null;
  let recognition = null;

  // Initialize speech recognition if available
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      showToast(`Heard: "${transcript}"`);
      handleQuestion(transcript);
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      if (event.error === 'not-allowed') {
        showToast("Microphone access denied");
        showOutput("Please allow microphone access:\n1. Click the extension icon\n2. Click the lock/site info icon in the address bar\n3. Set microphone to 'Allow'\n4. Reload the extension", true);
      } else if (event.error === 'no-speech') {
        showToast("No speech detected");
      } else {
        showToast(`Error: ${event.error}`);
      }
      stopListening();
    };

    recognition.onend = () => {
      stopListening();
    };
  }

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
  }

  async function startListening() {
    if (!recognition) {
      showToast("Speech recognition not supported");
      return;
    }

    // Request microphone permission first
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop the stream immediately - we just needed to get permission
      stream.getTracks().forEach(track => track.stop());

      listening = true;
      micButton.classList.add("listening");
      statusEl.textContent = "Listening…";
      showToast("Listening…");
      recognition.start();
    } catch (err) {
      console.error('Microphone permission error:', err);
      if (err.name === 'NotAllowedError') {
        showToast("Microphone access denied. Please allow microphone access in your browser settings.");
        showOutput("To enable microphone:\n1. Click the lock/info icon in the address bar\n2. Allow microphone access\n3. Reload the extension", true);
      } else {
        showToast(`Microphone error: ${err.message}`);
      }
    }
  }

  function stopListening() {
    listening = false;
    micButton.classList.remove("listening");
    statusEl.textContent = "Ready";
    if (recognition) {
      recognition.stop();
    }
  }

  function showOutput(text, isError = false) {
    outputEl.textContent = text;
    outputEl.className = isError ? "output error" : "output";
    outputEl.style.display = text ? "block" : "none";
  }

  // Function to play audio from base64 WAV
  async function playAudio(base64Audio) {
    try {
      // Convert base64 to audio blob
      const binaryString = atob(base64Audio);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'audio/wav' });
      const url = URL.createObjectURL(blob);

      // Create and play audio
      const audio = new Audio(url);
      await audio.play();

      // Clean up after playing
      audio.onended = () => {
        URL.revokeObjectURL(url);
      };
    } catch (error) {
      console.error('Error playing audio:', error);
      showToast('Could not play audio');
    }
  }

  function showLoading() {
    outputEl.textContent = "Thinking…";
    outputEl.className = "output loading";
    outputEl.style.display = "block";
  }

  async function handleQuestion(question) {
    showLoading();

    try {
      // Send question to background script
      const response = await chrome.runtime.sendMessage({
        action: 'ASK_QUESTION',
        question: question
      });

      if (!response) {
        showOutput('No response from background script. Try reloading the extension.', true);
        showToast("Extension error");
        return;
      }

      if (response.error) {
        showOutput(response.error, true);
        showToast("Error occurred");
      } else if (response.answer) {
        showOutput(response.answer);
        showToast("Answer ready!");
        // Play audio if available
        if (response.audio) {
          playAudio(response.audio);
        }
      } else {
        showOutput('Unexpected response format from server', true);
        showToast("Response error");
      }
    } catch (error) {
      console.error('Error asking question:', error);
      showOutput(`Failed to get answer: ${error.message}\n\nMake sure:\n1. Backend server is running (npm run server)\n2. Extension has necessary permissions\n3. Try reloading the extension`, true);
      showToast("Connection error");
    }
  }

  micButton.addEventListener("click", () => {
    if (listening) {
      stopListening();
      showToast("Stopped");
    } else {
      startListening();
    }
  });

  chips.addEventListener("click", async (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;

    const prompt = btn.dataset.prompt || btn.textContent.trim();
    showToast(`Asking: "${prompt}"`);
    handleQuestion(prompt);
  });
});
