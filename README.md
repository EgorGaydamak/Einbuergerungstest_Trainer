# Einbürgerungstest Trainer (Berlin) 🇩🇪

An interactive, responsive training web application to study for the German naturalization test (*Einbürgerungstest* / *Leben in Deutschland*), including official general questions and state-specific questions for Berlin.

---

## 🚀 How to Start the App (Schnellstart)

You can run this app on **Mac, Windows, or Linux** without any complicated setup.

### Option 1: Double-Click to Open (Einfachste Methode)
1. Double-click **`index.html`** in your file manager.
2. It will open in your default browser (Safari, Chrome, Firefox, Edge) and work immediately!

---

### Option 2: Run via Local Server (One-Click Launchers)
If you prefer running through a local web server:

- **On Mac:** Double-click **`start_mac.command`**
  *(If macOS displays an unidentified developer prompt on the first run, right-click `start_mac.command` and choose "Open")*
- **On Windows:** Double-click **`start_windows.bat`**

The launcher starts a lightweight local server and automatically opens `http://localhost:8000` in your web browser.

---

## ✨ Features (Funktionen)

- **Training Mode (Übungsmodus):**
  - Continuous loop of questions.
  - Prioritizes unseen and least-practiced questions fairly.
  - Instant visual feedback (green/red) and official German explanations.
  - Optional English side-by-side translation toggle.
- **Simulated Exam (Prüfungssimulation):**
  - Exactly 33 questions (30 general + 3 Berlin) adhering to official BAMF exam composition.
  - 60-minute countdown timer, question sheet navigation grid, and review flagging.
  - Complete scorecard and question-by-question review sheet upon submission.
- **Progress Tracking (Lernfortschritt):**
  - **Mastered:** Questions answered correctly in German several times in a row.
  - **Problematic:** Questions answered incorrectly at least twice.
  - **In Progress / Unseen:** Keeps track of what you still need to practice.
  - **Today's Ratio Gauge:** Shows your daily success rate.
  - *All progress is saved privately in your browser's local storage and persists across sessions.*
