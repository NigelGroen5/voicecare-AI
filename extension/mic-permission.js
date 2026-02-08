const statusEl = document.getElementById("status");
const enableBtn = document.getElementById("enableBtn");
const closeBtn = document.getElementById("closeBtn");

function setStatus(message) {
  statusEl.textContent = `Status: ${message}`;
}

async function enableMic() {
  try {
    setStatus("requesting permission...");
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((track) => track.stop());
    setStatus("microphone permission granted. Return to the extension popup and click mic again.");
  } catch (err) {
    const name = err?.name || "Error";
    const message = err?.message || String(err);
    setStatus(`failed (${name}: ${message}). Check chrome://settings/content/microphone and try again.`);
  }
}

enableBtn.addEventListener("click", enableMic);
closeBtn.addEventListener("click", () => window.close());
