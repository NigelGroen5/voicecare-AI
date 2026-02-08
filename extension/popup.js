document.addEventListener("DOMContentLoaded", async () => {
  const micButton = document.getElementById("micBtn");
  const statusEl = document.getElementById("status");
  const chips = document.getElementById("chips");
  const toast = document.getElementById("toast");
  const outputEl = document.getElementById("output");

  let listening = false;
  let toastTimer = null;
  let recognition = null;
  let recognitionActive = false;

  function errorToText(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    const name = err.name || "Error";
    const message = err.message || String(err);
    return `${name}: ${message}`;
  }

  // Initialize speech recognition if available
  if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = 'en-US';
    recognition.onstart = () => {
      recognitionActive = true;
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      showToast(`Heard: "${transcript}"`);
      handleQuestion(transcript);
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", {
        error: event.error,
        message: event.message,
        type: event.type,
        timeStamp: event.timeStamp
      });

      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        showToast("Microphone/Speech permission denied");
        showOutput(
          "Speech recognition was blocked.\n\nFix:\n1) Open chrome://settings/content/microphone\n2) Allow microphone + pick the right device\n3) Reload the extension",
          true
        );
      } else if (event.error === "audio-capture") {
        showToast("Mic not available");
        showOutput(
          "No microphone was found or it's in use.\n\nFix:\n1) Plug in/enable a mic\n2) Close apps using the mic (Meet/Discord/etc.)\n3) Try again",
          true
        );
      } else if (event.error === "no-speech") {
        showToast("No speech detected");
      } else {
        showToast(`Error: ${event.error}`);
      }

      stopListening();
    };


    recognition.onend = () => {
      recognitionActive = false;
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

    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("This browser does not support microphone capture");
      }

      // Force a real mic permission/device check before speech recognition.
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());

      listening = true;
      micButton.classList.add("listening");
      statusEl.textContent = "Listening…";
      showToast("Listening…");
      recognition.start();
    } catch (err) {
      const details = errorToText(err);
      console.error("Microphone permission error:", err);

      if (err?.name === "NotAllowedError" && /dismissed/i.test(err?.message || "")) {
        showToast("Mic permission dismissed");
        showOutput(
          "Microphone prompt was dismissed.\n\nOpening a setup tab so you can grant permission from a stable page.",
          true
        );
        chrome.tabs.create({ url: chrome.runtime.getURL("mic-permission.html") });
        listening = false;
        micButton.classList.remove("listening");
        statusEl.textContent = "Ready";
        return;
      }

      showToast("Mic failed");
      showOutput(
        `Mic failed: ${details}\n\nFix:\n1) Open chrome://settings/content/microphone\n2) Allow microphone + select the right device\n3) Close other apps using the mic\n4) Reload the extension`,
        true
      );

      listening = false;
      micButton.classList.remove("listening");
      statusEl.textContent = "Ready";
    }
  }


  function stopListening() {
    listening = false;
    micButton.classList.remove("listening");
    statusEl.textContent = "Ready";

    if (recognition && recognitionActive) {
      recognitionActive = false;
      try { recognition.stop(); } catch {}
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
      // Call startListening synchronously from click handler to maintain user gesture
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
