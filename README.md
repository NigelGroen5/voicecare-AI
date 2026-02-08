# VoiceCare AI 🗣️✨  
A voice-first Chrome extension that helps **elderly and accessibility-focused users** understand and navigate websites by turning confusing pages into **clear explanations + spoken guidance** using **AI + Gradium TTS**.

---

## 🚀 What is VoiceCare AI?

VoiceCare AI lets users ask questions like:

- “Is this safe?”
- “What is this page asking me to do?”
- “How do I get what I want here?”

…and get back a **simple, human-friendly answer**, **read aloud** with natural speech.

This project aligns with the **QHacks 2026 “Golden Age”** theme by building technology that **endures and uplifts**—making the web more inclusive for users who are often left behind as services go digital.

---

## ✨ Features (MVP)

- 🎙️ **Voice Input** — Speak your question naturally  
- 🧠 **AI Explanations** — Gemini summarizes and clarifies page intent  
- 🔊 **Text-to-Speech Output** — Gradium reads answers out loud  
- 🌐 **Works on any webpage** — content scripts extract context  
- 🧩 **Simple popup UI** — optimized for clarity and accessibility  

---

## 🧱 Tech Stack

- **Chrome Extension** (Manifest V3)  
- **JavaScript / HTML / CSS**  
- **Web Speech API** (Speech Recognition)  
- **Google Gemini API** (LLM reasoning + summarization)  
- **Gradium TTS API** (Natural speech synthesis)  
- **Node.js** (optional local orchestration / proxy)  

---

## 📁 Project Structure

```txt
.
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
├── server.js                  # optional local server (proxy)
├── gemini.js                  # Gemini helper
├── gradium.js                 # Gradium helper
├── gradium-server.js          # optional Gradium server wrapper
├── package.json
└── README.md

```

## ✅ Setup

1) Install Node dependencies (only if using local server)
npm install

2) Add API keys (recommended)

Create a .env file in the project root:

GRADIUM_API_KEY=gd_your_key_here
GEMINI_API_KEY=your_gemini_key_here


⚠️ Note: Do NOT hardcode API keys into extension files for production.
For a hackathon MVP, keys can be proxied through a local Node server.

## 🧪 Running Locally (Optional)

If your extension calls a local server (ex: Gemini/Gradium proxy), start it:

npm run start

Or if you have a dedicated Gradium server script:

npm run start:gradium

---

## 🧩 Load the Chrome Extension

Open: chrome://extensions

Enable Developer mode

Click Load unpacked

Select your project folder

Pin the extension and open it on any webpage

---

## 🎙️ Microphone Troubleshooting

If you see NotAllowedError or the mic won’t work:

Go to chrome://settings/content/microphone

Allow mic access + select the correct device

On macOS: System Settings → Privacy & Security → Microphone → enable Chrome

Close other apps using the mic (Zoom/Discord/Meet)

Reload the extension

Note: You do not add "microphone" to manifest.json permissions — Chrome doesn’t support that permission name.

---

## 🏗️ How it Works (High Level)

content.js extracts the page content

User speaks → SpeechRecognition transcribes

Popup sends message → background.js

Background calls Gemini to generate a simplified explanation

Background calls Gradium TTS to generate audio

Popup plays the returned audio for the user

---

## 🏆 Built For

QHacks 2026 — Gradium Prize Track
Theme: Golden Age — technology that endures, supports communities, and improves quality of life for future generations.

---

## 🔮 What’s Next

🟡 Focus Mode: highlight the part of the screen the assistant is referring to

🧭 Step-by-step guidance (form filling, safe clicks, navigation)

🌍 Multi-language support for seniors and newcomers

👥 Caregiver mode (trusted family assistance)

---

## 👨‍💻 Team

Built at QHacks 2026 in Kingston, Ontario.
