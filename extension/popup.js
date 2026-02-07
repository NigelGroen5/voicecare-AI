document.addEventListener("DOMContentLoaded", () => {
  const micButton = document.getElementById("micBtn");
  const statusEl = document.getElementById("status");
  const chips = document.getElementById("chips");
  const toast = document.getElementById("toast");

  let listening = false;
  let toastTimer = null;

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1200);
  }

  micButton.addEventListener("click", () => {
    listening = !listening;

    micButton.classList.toggle("listening", listening);
    statusEl.textContent = listening ? "Listening…" : "Ready";

    showToast(listening ? "Listening…" : "Stopped");
  });

  chips.addEventListener("click", async (e) => {
    const btn = e.target.closest(".chip");
    if (!btn) return;

    const prompt = btn.dataset.prompt || btn.textContent.trim();

    try {
      await navigator.clipboard.writeText(prompt);
      showToast("Copied prompt ✅");
    } catch {
      showToast("Clipboard blocked ❌");
    }
  });
});
