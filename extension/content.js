// Reads the page, exposes actionable controls, and supports element highlighting.

function isVisible(el) {
  const style = window.getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return (
    style &&
    style.display !== "none" &&
    style.visibility !== "hidden" &&
    style.opacity !== "0" &&
    rect.width > 0 &&
    rect.height > 0
  );
}

function extractPageText() {
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      const parent = node.parentElement;
      if (!parent) return NodeFilter.FILTER_REJECT;
      const tag = parent.tagName;
      if (["SCRIPT", "STYLE", "NOSCRIPT", "IFRAME", "SVG"].includes(tag)) return NodeFilter.FILTER_REJECT;
      if (!isVisible(parent)) return NodeFilter.FILTER_REJECT;
      const text = node.textContent.trim();
      if (text.length < 30) return NodeFilter.FILTER_REJECT;
      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const chunks = [];
  while (walker.nextNode()) chunks.push(walker.currentNode.textContent.trim());
  return chunks.join("\n\n");
}

function escapeCssId(id) {
  if (window.CSS && typeof window.CSS.escape === "function") return window.CSS.escape(id);
  return String(id).replace(/([ #;?%&,.+*~':"!^$\[\]()=>|/\\@])/g, "\\$1");
}

function buildSelector(el) {
  if (!el) return "";
  if (el.id) return `#${escapeCssId(el.id)}`;

  const parts = [];
  let current = el;
  let depth = 0;
  while (current && current.nodeType === 1 && depth < 5) {
    let part = current.tagName.toLowerCase();
    if (current.classList && current.classList.length > 0) {
      const cls = Array.from(current.classList).slice(0, 2).join(".");
      if (cls) part += `.${cls}`;
    }
    const parent = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c) => c.tagName === current.tagName
      );
      if (siblings.length > 1) {
        part += `:nth-of-type(${siblings.indexOf(current) + 1})`;
      }
    }
    parts.unshift(part);
    current = current.parentElement;
    depth += 1;
  }
  return parts.join(" > ");
}

function elementLabel(el) {
  const aria = el.getAttribute("aria-label");
  const title = el.getAttribute("title");
  const value = el.value;
  const text = (el.innerText || el.textContent || "").trim().replace(/\s+/g, " ");
  return aria || title || value || text || el.tagName.toLowerCase();
}

function getActionableElements() {
  const candidates = document.querySelectorAll(
    "button, a, [role='button'], input[type='submit'], input[type='button'], [aria-label], [onclick]"
  );
  const seen = new Set();
  const actions = [];

  for (const el of candidates) {
    if (!(el instanceof HTMLElement)) continue;
    if (!isVisible(el)) continue;

    const label = elementLabel(el);
    if (!label || label.length < 2 || label.length > 120) continue;

    const selector = buildSelector(el);
    if (!selector || seen.has(selector)) continue;
    seen.add(selector);

    actions.push({
      selector,
      label,
      tag: el.tagName.toLowerCase(),
    });
    if (actions.length >= 40) break;
  }

  return actions;
}

let highlightEl = null;
let highlightTag = null;
let highlightTarget = null;
let highlightRestore = null;
let highlightTimer = null;

function ensureHighlightStyles() {
  if (document.getElementById("__voicecare_highlight_styles__")) return;
  const style = document.createElement("style");
  style.id = "__voicecare_highlight_styles__";
  style.textContent = `
    @keyframes voicecarePulse {
      0% { box-shadow: 0 0 0 0 rgba(255, 106, 0, 0.9); }
      70% { box-shadow: 0 0 0 12px rgba(255, 106, 0, 0); }
      100% { box-shadow: 0 0 0 0 rgba(255, 106, 0, 0); }
    }
  `;
  document.documentElement.appendChild(style);
}

function placeHighlightOverlay(target, note) {
  const rect = target.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;

  if (!highlightEl) {
    highlightEl = document.createElement("div");
    highlightEl.style.position = "fixed";
    highlightEl.style.border = "4px solid #ff6a00";
    highlightEl.style.borderRadius = "10px";
    highlightEl.style.boxShadow = "0 0 0 9999px rgba(0, 0, 0, 0.2)";
    highlightEl.style.zIndex = "2147483647";
    highlightEl.style.pointerEvents = "none";
    document.documentElement.appendChild(highlightEl);
  }

  if (!highlightTag) {
    highlightTag = document.createElement("div");
    highlightTag.style.position = "fixed";
    highlightTag.style.background = "#ff6a00";
    highlightTag.style.color = "#fff";
    highlightTag.style.font = "700 14px/1.2 system-ui, -apple-system, Segoe UI, sans-serif";
    highlightTag.style.padding = "8px 10px";
    highlightTag.style.borderRadius = "8px";
    highlightTag.style.zIndex = "2147483647";
    highlightTag.style.pointerEvents = "none";
    document.documentElement.appendChild(highlightTag);
  }

  highlightEl.style.left = `${Math.max(rect.left - 6, 0)}px`;
  highlightEl.style.top = `${Math.max(rect.top - 6, 0)}px`;
  highlightEl.style.width = `${rect.width + 12}px`;
  highlightEl.style.height = `${rect.height + 12}px`;
  highlightTag.textContent = note;
  highlightTag.style.left = `${Math.max(rect.left, 8)}px`;
  highlightTag.style.top = `${Math.max(rect.top - 38, 8)}px`;
}

function clearHighlight() {
  if (highlightTimer) {
    window.clearTimeout(highlightTimer);
    highlightTimer = null;
  }
  if (highlightEl) {
    highlightEl.remove();
    highlightEl = null;
  }
  if (highlightTag) {
    highlightTag.remove();
    highlightTag = null;
  }
  if (highlightTarget && highlightRestore) {
    highlightTarget.style.outline = highlightRestore.outline;
    highlightTarget.style.outlineOffset = highlightRestore.outlineOffset;
    highlightTarget.style.boxShadow = highlightRestore.boxShadow;
    highlightTarget.style.transition = highlightRestore.transition;
    highlightTarget.style.animation = highlightRestore.animation;
  }
  highlightTarget = null;
  highlightRestore = null;
  window.removeEventListener("scroll", updateHighlightPosition, true);
  window.removeEventListener("resize", updateHighlightPosition, true);
}

function updateHighlightPosition() {
  if (!highlightTarget) return;
  placeHighlightOverlay(highlightTarget, highlightTag?.textContent || "Click here");
}

function highlightSelector(selector, note = "Click here") {
  const target = document.querySelector(selector);
  if (!target || !(target instanceof HTMLElement)) {
    return { ok: false, reason: "Target element not found on page" };
  }
  if (!isVisible(target)) {
    return { ok: false, reason: "Target element is not visible" };
  }

  clearHighlight();
  ensureHighlightStyles();

  target.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
  highlightTarget = target;
  highlightRestore = {
    outline: target.style.outline,
    outlineOffset: target.style.outlineOffset,
    boxShadow: target.style.boxShadow,
    transition: target.style.transition,
    animation: target.style.animation,
  };

  target.style.transition = "box-shadow 120ms ease, outline 120ms ease";
  target.style.outline = "4px solid #ff6a00";
  target.style.outlineOffset = "3px";
  target.style.boxShadow = "0 0 0 6px rgba(255, 106, 0, 0.35)";
  target.style.animation = "voicecarePulse 1.2s ease-out 6";

  const syncOverlay = () => placeHighlightOverlay(target, note);
  window.requestAnimationFrame(syncOverlay);
  window.setTimeout(syncOverlay, 250);
  window.setTimeout(syncOverlay, 700);
  window.addEventListener("scroll", updateHighlightPosition, true);
  window.addEventListener("resize", updateHighlightPosition, true);

  highlightTimer = window.setTimeout(clearHighlight, 10000);
  return { ok: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "GET_PAGE_TEXT") {
    sendResponse({
      text: extractPageText(),
      url: location.href,
      title: document.title,
    });
    return true;
  }

  if (msg.action === "GET_ACTIONABLE_ELEMENTS") {
    sendResponse({ actions: getActionableElements() });
    return true;
  }

  if (msg.action === "HIGHLIGHT_SELECTOR") {
    sendResponse(highlightSelector(msg.selector, msg.note || "Click here"));
    return true;
  }
});
