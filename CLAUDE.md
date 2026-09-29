# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Running the App

No build step or package manager — open `index.html` directly in a browser, or serve it locally:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

The `start_mac.command` and `start_windows.bat` launchers do the same thing.

## Architecture

This is a zero-dependency vanilla JS/HTML/CSS single-page app. All logic lives in three files:

- **`app.js`** — all application logic: state management, question selection algorithm, Training Mode, Simulated Exam Mode, localStorage persistence, DOM manipulation
- **`index.html`** — full static DOM structure for both modes (Training and Exam), including modals; sections are toggled visible/hidden by JS
- **`style.css`** — all styling including responsive layout, theme variables, and component styles
- **`questions.data.js`** — question bank as a JS file (assigned to a global `window.QUESTIONS_DATA`), loaded before `app.js` so it works without a local server (avoids CORS on `file://`)
- **`questions.json`** — same question data in JSON format (source of truth for edits)

## Key Data Structures

**`studyStats`** (persisted in localStorage as `einbuergerung_study_stats_v2`): keyed by question `id`, each value has `{ correctStreak, totalCorrect, totalWrong, seen }`. Used to compute mastered/problematic/in-progress/unseen counts.

**Question object shape** (from `questions.data.js`):
```js
{
  id: number,
  category: string,
  state: string | null,       // null = general, "SH" = Schleswig-Holstein
  question_de: string,
  question_en: string,
  options: [{ letter, text_de, text_en }],  // always 4 options A–D
  correct_letter: "a"|"b"|"c"|"d",
  explanation_de: string,
  explanation_en: string
}
```

**Exam composition**: exactly 33 questions — 30 randomly sampled from the general pool (300 questions) + 3 randomly sampled from the SH state pool (10 questions), matching the official BAMF exam structure.

## Mastery Logic

A question is **mastered** when `correctStreak >= maxCorrect` (default 3) and those streaks were answered in German (without English translation toggled on). Mastered questions are excluded from the training pool. The mastery threshold is configurable 1–5 and persisted in localStorage.

## Modifying Questions

Edit `questions.json` first (canonical), then regenerate `questions.data.js` to keep them in sync. `questions.data.js` must assign the array to `window.QUESTIONS_DATA` so the `file://` protocol works.
