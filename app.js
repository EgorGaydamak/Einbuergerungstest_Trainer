// -------------------------------------------------------------
// APP STATE & CONSTANTS
// -------------------------------------------------------------
let allQuestions = [];       // Loaded from questions.json
let studyStats = {};         // Chronological stats stored in localStorage
let currentQuestion = null;  // Active question in Training Mode
let currentPack = 'mixed';   // 'mixed' | 'general' | 'be'
let maxCorrect = 3;          // Threshold for mastery
let englishActive = false;   // English translation toggle state
let activeMode = 'training'; // 'training' | 'exam'
let isAnswered = false;      // Track if current training question has been answered

// Simulated Exam variables
let examQuestions = [];      // 33 questions for mock exam
let examAnswers = [];        // User's selections (length 33)
let examEnglishToggled = []; // English toggle flags per question (length 33)
let examFlags = [];          // Flagged for review flags (length 33)
let examCurrentIndex = 0;    // Active exam question index
let examSecondsLeft = 3600;  // 60 minutes
let examTimerInterval = null;

// LocalStorage Keys
const STORAGE_STATS_KEY = 'einbuergerung_study_stats_v2';
const STORAGE_THRESHOLD_KEY = 'einbuergerung_mastery_threshold';
const STORAGE_PACK_KEY = 'einbuergerung_question_pack';
const STORAGE_TODAY_STATS_KEY = 'einbuergerung_today_stats';

let todayStats = {           // Daily practice stats (correct/wrong)
  date: '',
  correct: 0,
  wrong: 0
};

// -------------------------------------------------------------
// INITIALIZATION
// -------------------------------------------------------------
window.onload = function() {
  loadSettings();
  loadQuestionsData();
};

function loadSettings() {
  // Load stats
  const savedStats = localStorage.getItem(STORAGE_STATS_KEY);
  if (savedStats) {
    try {
      studyStats = JSON.parse(savedStats);
    } catch (e) {
      console.error("Failed to parse saved statistics, resetting.", e);
      studyStats = {};
    }
  }

  // Load mastery threshold setting
  const savedThreshold = localStorage.getItem(STORAGE_THRESHOLD_KEY);
  if (savedThreshold) {
    maxCorrect = parseInt(savedThreshold, 10) || 3;
    document.getElementById('max-correct-slider').value = maxCorrect;
    document.getElementById('max-correct-value').innerText = maxCorrect;
  }

  // Set initial slider track progress
  updateSliderProgress(maxCorrect);

  // Load pack selection
  const savedPack = localStorage.getItem(STORAGE_PACK_KEY);
  if (savedPack) {
    currentPack = savedPack;
    const radios = document.getElementsByName('question-pack');
    for (let radio of radios) {
      if (radio.value === currentPack) {
        radio.checked = true;
      }
    }
  }

  // Load today's stats
  loadTodayStats();
}

// -------------------------------------------------------------
// TODAY'S STATISTICS LOGIC
// -------------------------------------------------------------
function loadTodayStats() {
  const saved = localStorage.getItem(STORAGE_TODAY_STATS_KEY);
  const todayStr = getTodayDateString();
  
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      if (parsed.date === todayStr) {
        todayStats = parsed;
        return;
      }
    } catch (e) {
      console.error("Failed to parse today stats", e);
    }
  }
  
  // Reset for a new day
  todayStats = {
    date: todayStr,
    correct: 0,
    wrong: 0
  };
}

function getTodayDateString() {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function updateTodayStatsUI() {
  const total = todayStats.correct + todayStats.wrong;
  const pct = total > 0 ? Math.round((todayStats.correct / total) * 100) : 0;
  
  const labelEl = document.getElementById('today-ratio-label');
  const correctFill = document.getElementById('today-correct-fill');
  const wrongFill = document.getElementById('today-wrong-fill');
  
  if (total === 0) {
    labelEl.innerText = "Today: 0% (0 Correct / 0 Wrong)";
    correctFill.style.width = "0%";
    wrongFill.style.width = "0%";
  } else {
    labelEl.innerText = `Today: ${pct}% (${todayStats.correct} Correct / ${todayStats.wrong} Wrong)`;
    
    const correctPct = (todayStats.correct / total) * 100;
    const wrongPct = (todayStats.wrong / total) * 100;
    
    correctFill.style.width = `${correctPct}%`;
    wrongFill.style.width = `${wrongPct}%`;
  }
}

// Update Range Slider visual progress indicator (as per CSS guidance)
function updateSliderProgress(val) {
  const slider = document.getElementById('max-correct-slider');
  const percent = ((val - slider.min) / (slider.max - slider.min)) * 100;
  slider.style.setProperty('--progress', `${percent}%`);
}

function loadQuestionsData() {
  const loader = document.getElementById('loader-overlay');
  loader.classList.remove('hidden');

  // If questions are loaded directly via questions.data.js (e.g. opened locally via file://), use immediately
  if (window.QUESTIONS_DATA && Array.isArray(window.QUESTIONS_DATA) && window.QUESTIONS_DATA.length > 0) {
    allQuestions = window.QUESTIONS_DATA;
    loader.classList.add('hidden');
    refreshDashboardStats();
    if (activeMode === 'training') {
      loadNextQuestion();
    }
    return;
  }

  fetch('questions.json')
    .then(response => {
      if (!response.ok) {
        throw new Error("HTTP error " + response.status);
      }
      return response.json();
    })
    .then(data => {
      allQuestions = data;
      loader.classList.add('hidden');
      
      // Initialize view
      refreshDashboardStats();
      if (activeMode === 'training') {
        loadNextQuestion();
      }
    })
    .catch(error => {
      console.error("Failed to load questions.json", error);
      if (window.QUESTIONS_DATA && Array.isArray(window.QUESTIONS_DATA) && window.QUESTIONS_DATA.length > 0) {
        allQuestions = window.QUESTIONS_DATA;
        loader.classList.add('hidden');
        refreshDashboardStats();
        if (activeMode === 'training') {
          loadNextQuestion();
        }
        return;
      }
      loader.innerHTML = `
        <div style="text-align: center; color: #f43f5e; padding: 2rem;">
          <h3>Fehler beim Laden (Error Loading Data)</h3>
          <p>Could not load questions.json. Please make sure the file is in the same directory or run the included launcher script.</p>
        </div>
      `;
    });
}

// -------------------------------------------------------------
// STATISTICS & CATEGORIZATION LOGIC
// -------------------------------------------------------------
function getQuestionState(qId) {
  const qStat = studyStats[qId];
  if (!qStat || qStat.seenCount === 0) {
    return 'unseen';
  }

  // Mastery requirement: last maxCorrect answers in history must be correct in German ('G' or 'C')
  const history = qStat.history || [];
  if (history.length >= maxCorrect) {
    const lastAnswers = history.slice(-maxCorrect);
    if (lastAnswers.every(ans => ans === 'G' || ans === 'C')) {
      return 'mastered';
    }
  }

  // Problematic requirement: Hasn't been mastered, and answered incorrectly at least twice overall (wrongCount >= 2)
  const wrongCount = qStat.wrongCount || 0;
  if (wrongCount >= 2) {
    return 'problematic';
  }

  return 'inprogress';
}

function getActivePool() {
  return allQuestions.filter(q => {
    if (currentPack === 'general') {
      return !q.is_state;
    } else if (currentPack === 'be') {
      return q.state_code === 'BE';
    } else {
      // Mixed: general + Berlin questions (310 total)
      return !q.is_state || q.state_code === 'BE';
    }
  });
}

function refreshDashboardStats() {
  if (allQuestions.length === 0) return;

  const activePool = getActivePool();
  let mastered = 0;
  let inprogress = 0;
  let problematic = 0;
  let unseen = 0;

  activePool.forEach(q => {
    const state = getQuestionState(q.id);
    if (state === 'mastered') mastered++;
    else if (state === 'inprogress') inprogress++;
    else if (state === 'problematic') problematic++;
    else if (state === 'unseen') unseen++;
  });

  // Update elements
  document.getElementById('stats-mastered').innerText = mastered;
  document.getElementById('stats-inprogress').innerText = inprogress;
  document.getElementById('stats-problematic').innerText = problematic;
  document.getElementById('stats-unseen').innerText = unseen;

  // Calculate mastery percentage
  const total = activePool.length;
  const percentage = total > 0 ? Math.round((mastered / total) * 100) : 0;
  document.getElementById('mastery-percentage').innerText = `${percentage}%`;
  document.getElementById('mastery-progress-fill').style.width = `${percentage}%`;

  // Update today's practice ratio bar
  updateTodayStatsUI();
}

// -------------------------------------------------------------
// QUESTION SELECTION ALGORITHM
// -------------------------------------------------------------
function selectNextQuestion() {
  const activePool = getActivePool();
  
  // Filter out mastered questions
  const learningPool = activePool.filter(q => getQuestionState(q.id) !== 'mastered');
  
  if (learningPool.length === 0) {
    return null; // All mastered!
  }

  // Find the minimum seenCount in the learning pool
  let minSeen = Infinity;
  learningPool.forEach(q => {
    const seen = studyStats[q.id]?.seenCount || 0;
    if (seen < minSeen) minSeen = seen;
  });

  // Select candidates with seenCount equal to minSeen
  // This guarantees that we strictly prioritize unseen and least-seen questions first, ensuring all questions are practiced an equal number of times.
  const candidates = learningPool.filter(q => {
    const seen = studyStats[q.id]?.seenCount || 0;
    return seen === minSeen;
  });

  // Return a random question from candidates
  const randomIndex = Math.floor(Math.random() * candidates.length);
  return candidates[randomIndex];
}

// -------------------------------------------------------------
// TRAINING MODE LOOP
// -------------------------------------------------------------
function loadNextQuestion() {
  // Always load new questions in German by default (reset translation toggle)
  document.getElementById('translation-toggle').checked = false;
  englishActive = false;
  syncTranslationVisibility();

  const completeBox = document.getElementById('training-complete-box');
  const questionCard = document.getElementById('main-question-card');
  
  const q = selectNextQuestion();
  
  if (q === null) {
    // Show all-mastered alert
    completeBox.classList.remove('hidden');
    questionCard.classList.add('hidden');
    currentQuestion = null;
    return;
  }
  
  completeBox.classList.add('hidden');
  questionCard.classList.remove('hidden');
  
  currentQuestion = q;
  isAnswered = false;

  // Reset visual card elements
  document.getElementById('explanation-box').classList.add('hidden');
  document.getElementById('btn-next-question').classList.add('hidden');
  
  const choicesContainer = document.querySelector('.choices-container');
  choicesContainer.classList.remove('locked');

  // Reset option buttons classes
  const options = ['a', 'b', 'c', 'd'];
  options.forEach(opt => {
    const btn = document.getElementById(`choice-${opt}`);
    btn.className = 'choice-row';
  });

  // Populate data
  document.getElementById('q-category').innerText = q.category || 'General';
  document.getElementById('q-number').innerText = `Frage ${q.num}`;
  
  // Display question progress details
  const activePool = getActivePool();
  const masteredCount = activePool.filter(item => getQuestionState(item.id) === 'mastered').length;
  document.getElementById('q-progress').innerText = `Unresolved: ${activePool.length - masteredCount} / ${activePool.length}`;

  if (q.is_state) {
    document.getElementById('q-state-badge').classList.remove('hidden');
  } else {
    document.getElementById('q-state-badge').classList.add('hidden');
  }

  // Populate German
  document.getElementById('question-text-de').innerText = q.question;
  document.getElementById('choice-a-de').innerText = q.a;
  document.getElementById('choice-b-de').innerText = q.b;
  document.getElementById('choice-c-de').innerText = q.c;
  document.getElementById('choice-d-de').innerText = q.d;

  // Populate English
  if (q.english) {
    document.getElementById('question-text-en').innerText = q.english.question;
    document.getElementById('choice-a-en').innerText = q.english.a || q.a;
    document.getElementById('choice-b-en').innerText = q.english.b || q.b;
    document.getElementById('choice-c-en').innerText = q.english.c || q.c;
    document.getElementById('choice-d-en').innerText = q.english.d || q.d;
  } else {
    document.getElementById('question-text-en').innerText = "English translation unavailable.";
    document.getElementById('choice-a-en').innerText = "";
    document.getElementById('choice-b-en').innerText = "";
    document.getElementById('choice-c-en').innerText = "";
    document.getElementById('choice-d-en').innerText = "";
  }
}

function selectOption(opt) {
  if (activeMode === 'exam') {
    // Simulated Exam: Select answer
    examAnswers[examCurrentIndex] = opt;
    
    // Update choices classes
    ['a', 'b', 'c', 'd'].forEach(o => {
      const btn = document.getElementById(`choice-${o}`);
      if (o === opt) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });

    // Update navigation grid item state
    const gridBtn = document.getElementById(`exam-grid-${examCurrentIndex}`);
    if (gridBtn) {
      gridBtn.classList.add('answered');
    }

    // Refresh exam sidebar stats
    updateExamSidebarStats();
    return;
  }

  // Training Mode: immediate feedback
  if (isAnswered) return;
  
  isAnswered = true;
  const q = currentQuestion;
  const choicesContainer = document.querySelector('.choices-container');
  choicesContainer.classList.add('locked');

  const chosenBtn = document.getElementById(`choice-${opt}`);
  const correctBtn = document.getElementById(`choice-${q.solution}`);

  const isCorrect = (opt === q.solution);

  // Apply colors
  correctBtn.classList.add('correct');
  if (!isCorrect) {
    chosenBtn.classList.add('wrong');
  }

  // Log stats
  if (!studyStats[q.id]) {
    studyStats[q.id] = {
      seenCount: 0,
      correctWithEnglish: 0,
      correctGermanOnly: 0,
      wrongCount: 0,
      history: []
    };
  }

  const stat = studyStats[q.id];
  stat.seenCount++;

  if (isCorrect) {
    if (englishActive) {
      stat.history.push('E'); // Correct with English translation
      stat.correctWithEnglish++;
    } else {
      stat.history.push('G'); // Correct in German only
      stat.correctGermanOnly++;
    }
  } else {
    stat.history.push('W'); // Wrong answer
    stat.wrongCount++;
  }

  // Cap history at last 10 entries to preserve space
  if (stat.history.length > 10) {
    stat.history = stat.history.slice(-10);
  }

  // Record today's practice stats
  const todayStr = getTodayDateString();
  if (todayStats.date !== todayStr) {
    todayStats.date = todayStr;
    todayStats.correct = 0;
    todayStats.wrong = 0;
  }
  if (isCorrect) {
    todayStats.correct++;
  } else {
    todayStats.wrong++;
  }
  localStorage.setItem(STORAGE_TODAY_STATS_KEY, JSON.stringify(todayStats));

  // Save to disk & refresh
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(studyStats));
  refreshDashboardStats();

  // Populate explanations
  document.getElementById('explanation-text-de').innerText = q.context || "Keine zusätzliche Erklärung vorhanden.";
  if (q.english && q.english.context) {
    document.getElementById('explanation-text-en').innerText = q.english.context;
    document.getElementById('explanation-section-en').classList.remove('hidden');
  } else {
    document.getElementById('explanation-section-en').classList.add('hidden');
  }

  // Render explanation block & show next button
  document.getElementById('explanation-box').classList.remove('hidden');
  
  // Match English section layout in the explanation card to translation toggle state
  const enExSec = document.getElementById('explanation-section-en');
  if (englishActive && q.english && q.english.context) {
    enExSec.classList.remove('hidden');
  } else {
    enExSec.classList.add('hidden');
  }
  
  document.getElementById('btn-next-question').classList.remove('hidden');
}

// -------------------------------------------------------------
// TRANSLATION TOGGLE LOGIC
// -------------------------------------------------------------
function toggleTranslation(checked) {
  englishActive = checked;
  syncTranslationVisibility();
}

function syncTranslationVisibility() {
  const englishPanel = document.getElementById('question-english-panel');
  const enTexts = document.querySelectorAll('.text-en');
  const explanationEnSection = document.getElementById('explanation-section-en');

  if (englishActive) {
    englishPanel.classList.remove('hidden');
    enTexts.forEach(el => el.classList.remove('hidden'));
    
    // If exam is running, record that English was toggled
    if (activeMode === 'exam') {
      examEnglishToggled[examCurrentIndex] = true;
    } else {
      // Training mode: sync explanation panel if visible
      const expBox = document.getElementById('explanation-box');
      if (!expBox.classList.contains('hidden') && currentQuestion && currentQuestion.english && currentQuestion.english.context) {
        explanationEnSection.classList.remove('hidden');
      }
    }
  } else {
    englishPanel.classList.add('hidden');
    enTexts.forEach(el => el.classList.add('hidden'));
    explanationEnSection.classList.add('hidden');
  }
}

// -------------------------------------------------------------
// SETTINGS UPDATE ACTIONS
// -------------------------------------------------------------
function updateMaxCorrectValue(val) {
  document.getElementById('max-correct-value').innerText = val;
  updateSliderProgress(val);
}

function saveMasteryThreshold(val) {
  maxCorrect = parseInt(val, 10) || 3;
  localStorage.setItem(STORAGE_THRESHOLD_KEY, maxCorrect);
  refreshDashboardStats();
  
  // Reload current question in case it became mastered
  if (activeMode === 'training') {
    loadNextQuestion();
  }
}

function updatePackSelection() {
  const radios = document.getElementsByName('question-pack');
  for (let radio of radios) {
    if (radio.checked) {
      currentPack = radio.value;
      break;
    }
  }
  localStorage.setItem(STORAGE_PACK_KEY, currentPack);
  refreshDashboardStats();
  
  // Reset view to fetch questions matching the new pack
  if (activeMode === 'training') {
    loadNextQuestion();
  }
}

// -------------------------------------------------------------
// RESET STATISTICS DIALOGS
// -------------------------------------------------------------
function confirmResetStats() {
  const modal = document.getElementById('modal-confirm-reset');
  modal.showModal();
}

function closeResetModal() {
  const modal = document.getElementById('modal-confirm-reset');
  modal.close();
}

function executeResetStats() {
  localStorage.removeItem(STORAGE_STATS_KEY);
  studyStats = {};
  
  // Reset today's stats as well
  todayStats = {
    date: getTodayDateString(),
    correct: 0,
    wrong: 0
  };
  localStorage.setItem(STORAGE_TODAY_STATS_KEY, JSON.stringify(todayStats));

  refreshDashboardStats();
  closeResetModal();

  if (activeMode === 'training') {
    loadNextQuestion();
  } else {
    // If in exam, force back to training
    switchMode('training');
  }
}

// -------------------------------------------------------------
// MODE SELECTION SWITCH (Training vs Simulated Exam)
// -------------------------------------------------------------
function switchMode(newMode) {
  if (activeMode === newMode) return;

  // Always reset translation when switching modes
  document.getElementById('translation-toggle').checked = false;
  englishActive = false;
  syncTranslationVisibility();

  // Cleanup active mode
  if (activeMode === 'exam') {
    clearInterval(examTimerInterval);
  }

  activeMode = newMode;
  
  // Toggle tab buttons visual classes
  document.getElementById('btn-mode-training').classList.toggle('active', activeMode === 'training');
  document.getElementById('btn-mode-exam').classList.toggle('active', activeMode === 'exam');

  // Toggle sidebars
  document.getElementById('settings-card').classList.toggle('hidden', activeMode !== 'training');
  document.getElementById('exam-card-sidebar').classList.toggle('hidden', activeMode !== 'exam');

  // Hide result screen
  document.getElementById('exam-result-card').classList.add('hidden');
  
  // Reset questions card
  document.getElementById('main-question-card').classList.remove('hidden');
  document.getElementById('btn-flag-exam').classList.toggle('hidden', activeMode !== 'exam');
  document.getElementById('exam-navigation-buttons').classList.toggle('hidden', activeMode !== 'exam');

  if (activeMode === 'training') {
    loadNextQuestion();
  } else {
    startExam();
  }
}

// -------------------------------------------------------------
// SIMULATED EXAM IMPLEMENTATION
// -------------------------------------------------------------
function startExam() {
  if (allQuestions.length === 0) return;

  // Always reset translation when starting a new exam
  document.getElementById('translation-toggle').checked = false;
  englishActive = false;
  syncTranslationVisibility();

  // Compose exam paper: 33 questions total
  // Comprises: 30 random general questions, 3 random Berlin state questions
  const generalPool = allQuestions.filter(q => !q.is_state);
  const bePool = allQuestions.filter(q => q.state_code === 'BE');

  // Select 30 unique random indices from general questions
  const selectedGeneral = selectRandomUnique(generalPool, 30);
  // Select 3 unique random indices from Berlin questions
  const selectedBE = selectRandomUnique(bePool, 3);

  examQuestions = [...selectedGeneral, ...selectedBE];
  
  // Initialize state arrays
  examAnswers = Array(33).fill(null);
  examEnglishToggled = Array(33).fill(false);
  examFlags = Array(33).fill(false);
  
  examCurrentIndex = 0;
  
  // Render navigation sheet grid
  const gridContainer = document.getElementById('exam-question-grid');
  gridContainer.innerHTML = '';
  for (let i = 0; i < 33; i++) {
    const btn = document.createElement('button');
    btn.id = `exam-grid-${i}`;
    btn.className = 'exam-grid-btn';
    btn.innerText = i + 1;
    btn.onclick = () => loadExamQuestion(i);
    gridContainer.appendChild(btn);
  }

  // Set timer: 60 minutes = 3600 seconds
  examSecondsLeft = 3600;
  updateTimerDisplay();
  clearInterval(examTimerInterval);
  examTimerInterval = setInterval(tickExamTimer, 1000);

  // Load first exam question
  loadExamQuestion(0);
  updateExamSidebarStats();
}

function selectRandomUnique(pool, count) {
  const poolCopy = [...pool];
  const selected = [];
  for (let i = 0; i < count; i++) {
    if (poolCopy.length === 0) break;
    const randIdx = Math.floor(Math.random() * poolCopy.length);
    selected.push(poolCopy.splice(randIdx, 1)[0]);
  }
  return selected;
}

function updateTimerDisplay() {
  const mins = Math.floor(examSecondsLeft / 60);
  const secs = examSecondsLeft % 60;
  
  const paddedMins = String(mins).padStart(2, '0');
  const paddedSecs = String(secs).padStart(2, '0');
  
  document.getElementById('exam-timer').innerText = `${paddedMins}:${paddedSecs}`;
}

function tickExamTimer() {
  examSecondsLeft--;
  updateTimerDisplay();
  
  if (examSecondsLeft <= 0) {
    clearInterval(examTimerInterval);
    alert("Zeit abgelaufen! (Time's up!) Your exam paper will be submitted automatically.");
    executeSubmitExam();
  }
}

function updateExamSidebarStats() {
  const answered = examAnswers.filter(ans => ans !== null).length;
  const flagged = examFlags.filter(f => f === true).length;
  
  document.getElementById('exam-total-answered').innerText = `${answered}/33`;
  document.getElementById('exam-total-flagged').innerText = flagged;
}

function loadExamQuestion(idx) {
  if (idx < 0 || idx >= 33) return;

  // Save current question English translation state before loading next
  if (document.getElementById('translation-toggle').checked) {
    examEnglishToggled[examCurrentIndex] = true;
  }

  // Always load new exam questions in German by default (reset translation toggle)
  document.getElementById('translation-toggle').checked = false;
  englishActive = false;
  syncTranslationVisibility();

  examCurrentIndex = idx;
  const q = examQuestions[idx];

  // Update navigation grid active highlights
  for (let i = 0; i < 33; i++) {
    const btn = document.getElementById(`exam-grid-${i}`);
    if (btn) {
      btn.classList.toggle('current', i === idx);
    }
  }

  // Reset elements
  const choicesContainer = document.querySelector('.choices-container');
  choicesContainer.classList.remove('locked');
  document.getElementById('explanation-box').classList.add('hidden');
  document.getElementById('btn-next-question').classList.add('hidden');

  // Populate data
  document.getElementById('q-category').innerText = q.category || 'General';
  document.getElementById('q-number').innerText = `Frage ${q.num}`;
  document.getElementById('q-progress').innerText = `Exam: ${idx + 1} / 33`;

  if (q.is_state) {
    document.getElementById('q-state-badge').classList.remove('hidden');
  } else {
    document.getElementById('q-state-badge').classList.add('hidden');
  }

  // Populate German
  document.getElementById('question-text-de').innerText = q.question;
  document.getElementById('choice-a-de').innerText = q.a;
  document.getElementById('choice-b-de').innerText = q.b;
  document.getElementById('choice-c-de').innerText = q.c;
  document.getElementById('choice-d-de').innerText = q.d;

  // Populate English
  if (q.english) {
    document.getElementById('question-text-en').innerText = q.english.question;
    document.getElementById('choice-a-en').innerText = q.english.a || q.a;
    document.getElementById('choice-b-en').innerText = q.english.b || q.b;
    document.getElementById('choice-c-en').innerText = q.english.c || q.c;
    document.getElementById('choice-d-en').innerText = q.english.d || q.d;
  } else {
    document.getElementById('question-text-en').innerText = "English translation unavailable.";
    document.getElementById('choice-a-en').innerText = "";
    document.getElementById('choice-b-en').innerText = "";
    document.getElementById('choice-c-en').innerText = "";
    document.getElementById('choice-d-en').innerText = "";
  }

  // Reset and set visual classes for choices based on previous selections
  const savedAns = examAnswers[idx];
  ['a', 'b', 'c', 'd'].forEach(o => {
    const btn = document.getElementById(`choice-${o}`);
    btn.className = 'choice-row';
    if (o === savedAns) {
      btn.classList.add('selected');
    }
  });

  // Sync Flag button style
  const flagBtn = document.getElementById('btn-flag-exam');
  const isFlagged = examFlags[idx];
  flagBtn.classList.toggle('active', isFlagged);
  document.getElementById('flag-btn-text').innerText = isFlagged ? "Flagged for Review" : "Flag for Review";
}

function toggleExamFlag() {
  const idx = examCurrentIndex;
  examFlags[idx] = !examFlags[idx];

  // Update navigation grid item
  const gridBtn = document.getElementById(`exam-grid-${idx}`);
  if (gridBtn) {
    gridBtn.classList.toggle('flagged', examFlags[idx]);
  }

  // Update button visual
  const flagBtn = document.getElementById('btn-flag-exam');
  flagBtn.classList.toggle('active', examFlags[idx]);
  document.getElementById('flag-btn-text').innerText = examFlags[idx] ? "Flagged for Review" : "Flag for Review";

  updateExamSidebarStats();
}

function navigateExamQuestion(dir) {
  const nextIdx = examCurrentIndex + dir;
  if (nextIdx >= 0 && nextIdx < 33) {
    loadExamQuestion(nextIdx);
  }
}

// -------------------------------------------------------------
// EXAM SUBMISSION & GRADING
// -------------------------------------------------------------
function confirmSubmitExam() {
  // Count answered
  const answered = examAnswers.filter(ans => ans !== null).length;
  const msg = `You have answered ${answered} out of 33 questions. Are you ready to submit your exam paper for grading?`;
  
  document.getElementById('confirm-submit-message').innerText = msg;
  document.getElementById('modal-confirm-submit').showModal();
}

function closeSubmitModal() {
  document.getElementById('modal-confirm-submit').close();
}

function executeSubmitExam() {
  closeSubmitModal();
  clearInterval(examTimerInterval);

  // Sync final question's translation status
  if (document.getElementById('translation-toggle').checked) {
    examEnglishToggled[examCurrentIndex] = true;
  }

  let score = 0;
  const todayStr = getTodayDateString();

  // Process grading and update learning statistics
  examQuestions.forEach((q, idx) => {
    const userAns = examAnswers[idx];
    const isCorrect = (userAns === q.solution);
    const engUsed = examEnglishToggled[idx];

    if (isCorrect) score++;

    // Update studyStats
    if (!studyStats[q.id]) {
      studyStats[q.id] = {
        seenCount: 0,
        correctWithEnglish: 0,
        correctGermanOnly: 0,
        wrongCount: 0,
        history: []
      };
    }

    const stat = studyStats[q.id];
    stat.seenCount++;

    if (isCorrect) {
      if (engUsed) {
        stat.history.push('E'); // Correct with English translation
        stat.correctWithEnglish++;
      } else {
        stat.history.push('G'); // Correct in German only
        stat.correctGermanOnly++;
      }
    } else {
      stat.history.push('W'); // Wrong answer
      stat.wrongCount++;
    }

    if (stat.history.length > 10) {
      stat.history = stat.history.slice(-10);
    }

    // Update today's practice stats
    if (todayStats.date !== todayStr) {
      todayStats.date = todayStr;
      todayStats.correct = 0;
      todayStats.wrong = 0;
    }
    if (isCorrect) {
      todayStats.correct++;
    } else {
      todayStats.wrong++;
    }
  });

  // Save today's stats to disk
  localStorage.setItem(STORAGE_TODAY_STATS_KEY, JSON.stringify(todayStats));

  // Save changes
  localStorage.setItem(STORAGE_STATS_KEY, JSON.stringify(studyStats));
  refreshDashboardStats();

  // Show exam results layout
  document.getElementById('main-question-card').classList.add('hidden');
  document.getElementById('exam-card-sidebar').classList.add('hidden');

  const resultCard = document.getElementById('exam-result-card');
  resultCard.classList.remove('hidden');

  // Highlight score results
  const pass = (score >= 17);
  resultCard.className = pass ? 'exam-result-card passed' : 'exam-result-card failed';
  document.getElementById('result-status-icon').innerText = pass ? '🏆' : '❌';
  document.getElementById('result-title').innerText = pass ? 'Test Bestanden! (Test Passed)' : 'Nicht Bestanden (Failed)';
  document.getElementById('result-score').innerText = score;
  document.getElementById('result-verdict').innerText = pass ? 'Passed (Bestanden)' : 'Failed (Nicht Bestanden)';
  
  const pct = Math.round((score / 33) * 100);
  document.getElementById('result-pct').innerText = `Success Rate: ${pct}% (Minimum 17 answers required)`;

  // Generate question-by-question review markup
  const reviewContainer = document.getElementById('review-items-container');
  reviewContainer.innerHTML = '';

  examQuestions.forEach((q, idx) => {
    const userAns = examAnswers[idx];
    const isCorrect = (userAns === q.solution);
    const engUsed = examEnglishToggled[idx];

    const row = document.createElement('div');
    let statusClass = 'unanswered';
    let verdictText = 'Unanswered (Unbeantwortet)';

    if (userAns !== null) {
      if (isCorrect) {
        statusClass = 'correct';
        verdictText = 'Correct (Richtig)';
      } else {
        statusClass = 'wrong';
        verdictText = 'Incorrect (Falsch)';
      }
    }

    row.className = `review-row ${statusClass}`;
    
    // Compile option letter displays
    let answersGridHTML = '';
    const choices = ['a', 'b', 'c', 'd'];
    choices.forEach(letter => {
      let optionClass = '';
      if (letter === q.solution) {
        optionClass = 'correct-ans';
      } else if (letter === userAns) {
        optionClass = 'user-select';
      }

      const textDe = q[letter];
      const textEn = engUsed && q.english ? `<span class="review-ans-en">(${q.english[letter]})</span>` : '';
      
      answersGridHTML += `
        <div class="review-ans-item ${optionClass}">
          <span class="review-ans-label">${letter.toUpperCase()}:</span>
          <span>${textDe}</span>
          ${textEn}
        </div>
      `;
    });

    // Compile translations if relevant
    const enTextBlock = (engUsed && q.english) ? `<p style="font-size:0.9rem; color:var(--text-muted); margin-bottom: 0.5rem;">${q.english.question}</p>` : '';
    const contextDe = q.context ? `<p style="font-size:0.85rem; line-height:1.4; color:var(--text-main); margin-top:0.5rem;"><strong>Erklärung:</strong> ${q.context}</p>` : '';
    const contextEn = (engUsed && q.english && q.english.context) ? `<p style="font-size:0.85rem; line-height:1.4; color:var(--text-muted); margin-top:0.25rem;"><strong>Context:</strong> ${q.english.context}</p>` : '';

    row.innerHTML = `
      <div class="review-row-header">
        <span class="review-q-num">Question ${idx + 1} (${q.num})</span>
        <span class="review-verdict-badge">${verdictText}</span>
      </div>
      <p class="review-q-text">${q.question}</p>
      ${enTextBlock}
      <div class="review-answers-grid">
        ${answersGridHTML}
      </div>
      ${contextDe}
      ${contextEn}
    `;

    reviewContainer.appendChild(row);
  });
}

function restartExam() {
  document.getElementById('exam-result-card').classList.add('hidden');
  document.getElementById('exam-card-sidebar').classList.remove('hidden');
  document.getElementById('main-question-card').classList.remove('hidden');
  startExam();
}
