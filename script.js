let QUESTION_BANK = [];
const loadedTopicFiles = new Set();

const examFilter = document.getElementById("examFilter");
const topicFilter = document.getElementById("topicFilter");
const questionCountInput = document.getElementById("questionCount");
const secondsPerQuestionInput = document.getElementById("secondsPerQuestion");
const practiceMode = document.getElementById("practiceMode");
const negativeMarkingSelect = document.getElementById("negativeMarking");

const startBtn = document.getElementById("startBtn");
const submitBtn = document.getElementById("submitBtn");
const nextBtn = document.getElementById("nextBtn");
const restartBtn = document.getElementById("restartBtn");

const quizSection = document.getElementById("quizSection");
const resultSection = document.getElementById("resultSection");
const questionMeta = document.getElementById("questionMeta");
const questionTopic = document.getElementById("questionTopic");
const questionText = document.getElementById("questionText");
const optionsWrap = document.getElementById("options");
const timerEl = document.getElementById("timer");
const feedback = document.getElementById("feedback");
const scoreLine = document.getElementById("scoreLine");
const resultDetails = document.getElementById("resultDetails");
const dataStatus = document.getElementById("dataStatus");

let sessionQuestions = [];
let currentIndex = 0;
let selectedOption = null;
let score = 0;
let timerId = null;
let timeLeft = 30;
let answers = [];
let currentMode = "exam";
let negativeMarkingOn = false;
let mockScore = 0;
const CORRECT_MARKS = 1;
const NEGATIVE_MARKS = 0.25;
let questionStartedAt = 0;

function uniqueTopics(items) {
  return [...new Set(items.map((q) => q.topic))];
}

function shuffle(array) {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getFilteredQuestions() {
  const exam = examFilter.value;
  const topic = topicFilter.value;
  return QUESTION_BANK.filter((q) => {
    const examMatch = exam === "all" || q.exam === exam;
    const topicMatch = topic === "all" || q.topic === topic;
    return examMatch && topicMatch;
  });
}

function getManifestItems() {
  return Array.isArray(window.QUESTION_MANIFEST) ? window.QUESTION_MANIFEST : [];
}

function loadScriptFile(path) {
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = path;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Failed to load ${path}`));
    document.head.appendChild(script);
  });
}

async function ensureTopicQuestionsLoaded(exam, topic) {
  const manifest = getManifestItems();
  const needed = manifest.filter((m) => (exam === "all" || m.exam === exam) && (topic === "all" || m.topic === topic));
  const toLoad = needed.filter((m) => !loadedTopicFiles.has(m.file));
  for (const item of toLoad) {
    await loadScriptFile(item.file);
    loadedTopicFiles.add(item.file);
  }
  const topicMap = window.TOPIC_QUESTION_DATA || {};
  QUESTION_BANK = Object.values(topicMap).flat();
}

function loadManifestOnlyMode() {
  const manifest = getManifestItems();
  const total = manifest.reduce((sum, m) => sum + (m.count || 0), 0);
  dataStatus.textContent = `Data mode: Local topic files (offline ready). Current bank: ${total}+ questions.`;
}

function loadTopics() {
  const exam = examFilter.value;
  const manifest = getManifestItems();
  const topics = uniqueTopics(manifest.filter((m) => exam === "all" || m.exam === exam).map((m) => ({ topic: m.topic })));
  topicFilter.innerHTML = `<option value="all">All Topics</option>${topics
    .map((t) => `<option value="${t}">${t}</option>`)
    .join("")}`;
}

function renderQuestion() {
  const q = sessionQuestions[currentIndex];
  questionStartedAt = Date.now();
  selectedOption = null;
  feedback.classList.add("hidden");
  feedback.innerHTML = "";
  submitBtn.disabled = false;
  nextBtn.classList.toggle("hidden", currentMode !== "learn");
  optionsWrap.innerHTML = "";

  questionMeta.textContent = `Question ${currentIndex + 1} / ${sessionQuestions.length}`;
  questionTopic.textContent = `${q.topic} | ${q.exam === "central" ? "Central" : "AP"} Focus`;
  questionText.textContent = q.question;

  q.options.forEach((opt, index) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "option-btn";
    btn.textContent = `${String.fromCharCode(65 + index)}. ${opt}`;
    btn.addEventListener("click", () => {
      [...optionsWrap.children].forEach((el) => el.classList.remove("selected"));
      btn.classList.add("selected");
      selectedOption = index;
      if (currentMode === "learn") {
        submitAnswer(false);
      }
    });
    optionsWrap.appendChild(btn);
  });

  if (currentMode === "learn") {
    clearInterval(timerId);
    submitBtn.classList.add("hidden");
    timerEl.textContent = "No timer (Learn Mode)";
  } else {
    startTimer();
    submitBtn.classList.remove("hidden");
    timerEl.textContent = `${timeLeft}s`;
  }
}

function startTimer() {
  clearInterval(timerId);
  timeLeft = Number(secondsPerQuestionInput.value) || 30;
  timerEl.textContent = `${timeLeft}s`;

  timerId = setInterval(() => {
    timeLeft -= 1;
    timerEl.textContent = `${timeLeft}s`;
    if (timeLeft <= 0) {
      clearInterval(timerId);
      submitAnswer(true);
    }
  }, 1000);
}

function styleOptions(correctIndex, chosenIndex) {
  [...optionsWrap.children].forEach((btn, idx) => {
    btn.disabled = true;
    if (idx === correctIndex) btn.classList.add("correct");
    if (chosenIndex !== null && idx === chosenIndex && idx !== correctIndex) btn.classList.add("wrong");
  });
}

function submitAnswer(isAuto = false) {
  const q = sessionQuestions[currentIndex];
  clearInterval(timerId);
  const timeTakenSec = Math.max(1, Math.round((Date.now() - questionStartedAt) / 1000));

  const chosen = selectedOption;
  const isCorrect = chosen === q.answerIndex;
  if (isCorrect) {
    score += 1;
    if (currentMode === "mock") mockScore += CORRECT_MARKS;
  } else if (currentMode === "mock" && negativeMarkingOn && chosen !== null) {
    mockScore -= NEGATIVE_MARKS;
  }

  styleOptions(q.answerIndex, chosen);
  submitBtn.disabled = true;
  nextBtn.classList.remove("hidden");
  feedback.classList.remove("hidden");

  feedback.innerHTML = `
    <p class="${isCorrect ? "ok" : "not-ok"}">
      ${isCorrect ? "Correct!" : isAuto ? "Time up!" : "Incorrect."}
    </p>
    <h4>Right Answer:</h4>
    <p>${String.fromCharCode(65 + q.answerIndex)}. ${q.options[q.answerIndex]}</p>
    <h4>Easy 30-second method:</h4>
    <p>${q.explanation}</p>
    <h4>Shortcut Trick:</h4>
    <p>${q.trick}</p>
  `;

  answers.push({
    question: q.question,
    topic: q.topic,
    chosen: chosen === null ? "Not attempted" : q.options[chosen],
    correct: q.options[q.answerIndex],
    isCorrect,
    isAttempted: chosen !== null,
    timeTakenSec,
    marksDelta:
      currentMode !== "mock"
        ? 0
        : isCorrect
          ? CORRECT_MARKS
          : chosen === null || !negativeMarkingOn
            ? 0
            : -NEGATIVE_MARKS
  });
}

function buildOverallStats() {
  const total = answers.length;
  const attempted = answers.filter((a) => a.isAttempted).length;
  const correct = answers.filter((a) => a.isCorrect).length;
  const wrong = answers.filter((a) => a.isAttempted && !a.isCorrect).length;
  const unattempted = total - attempted;
  const accuracy = attempted === 0 ? 0 : (correct / attempted) * 100;
  const totalTimeSec = answers.reduce((sum, a) => sum + a.timeTakenSec, 0);
  const avgTimeSec = total === 0 ? 0 : totalTimeSec / total;

  return {
    total,
    attempted,
    correct,
    wrong,
    unattempted,
    accuracy,
    totalTimeSec,
    avgTimeSec
  };
}

function buildTopicSummary() {
  const stats = {};
  answers.forEach((a) => {
    if (!stats[a.topic]) {
      stats[a.topic] = { total: 0, correct: 0, attempted: 0, time: 0 };
    }
    stats[a.topic].total += 1;
    if (a.isCorrect) stats[a.topic].correct += 1;
    if (a.isAttempted) stats[a.topic].attempted += 1;
    stats[a.topic].time += a.timeTakenSec;
  });
  return Object.entries(stats)
    .map(([topic, v]) => {
      const percent = v.attempted === 0 ? 0 : Math.round((v.correct / v.attempted) * 100);
      const avgTime = (v.time / v.total).toFixed(1);
      return `<div class="result-item"><strong>${topic}</strong><p>Accuracy: ${v.correct}/${v.attempted} (${percent}%) | Avg Time: ${avgTime}s</p></div>`;
    })
    .join("");
}

function showResults() {
  quizSection.classList.add("hidden");
  resultSection.classList.remove("hidden");

  if (currentMode === "mock") {
    scoreLine.textContent = `Mock Score: ${mockScore.toFixed(2)} | Correct: ${score}/${sessionQuestions.length} | Negative marking: ${negativeMarkingOn ? "On" : "Off"}`;
  } else {
    scoreLine.textContent = `You scored ${score} out of ${sessionQuestions.length}.`;
  }

  const answerCards = answers
    .map(
      (a, idx) => `
      <div class="result-item">
        <strong>Q${idx + 1}: ${a.topic}</strong>
        <p>${a.question}</p>
        <p>Your answer: ${a.chosen}</p>
        <p>Correct answer: ${a.correct}</p>
        <p>Time: ${a.timeTakenSec}s</p>
        <p class="${a.isCorrect ? "ok" : "not-ok"}">${a.isCorrect ? "Correct" : "Needs revision"}</p>
        ${currentMode === "mock" ? `<p>Marks: ${a.marksDelta > 0 ? "+" : ""}${a.marksDelta}</p>` : ""}
      </div>
    `
    )
    .join("");

  const stats = buildOverallStats();
  resultDetails.innerHTML = `
    <h3>Overall Analysis</h3>
    <div class="result-item">
      <p>Total Questions: ${stats.total}</p>
      <p>Attempted: ${stats.attempted} | Unattempted: ${stats.unattempted}</p>
      <p>Correct: ${stats.correct} | Wrong: ${stats.wrong}</p>
      <p>Accuracy: ${stats.accuracy.toFixed(2)}%</p>
      <p>Total Time: ${stats.totalTimeSec}s | Avg Time/Question: ${stats.avgTimeSec.toFixed(1)}s</p>
    </div>
    <h3>Topic-wise Performance</h3>
    ${buildTopicSummary()}
    <h3>Question Review</h3>
    ${answerCards}
  `;
}

async function startSession() {
  await ensureTopicQuestionsLoaded(examFilter.value, topicFilter.value);
  const pool = getFilteredQuestions();
  const requested = Number(questionCountInput.value) || 5;
  currentMode = practiceMode.value;
  negativeMarkingOn = currentMode === "mock" && negativeMarkingSelect.value === "on";

  if (pool.length === 0) {
    alert("No questions available for selected filter.");
    return;
  }

  sessionQuestions = shuffle(pool).slice(0, Math.min(requested, pool.length));
  currentIndex = 0;
  score = 0;
  mockScore = 0;
  answers = [];
  resultSection.classList.add("hidden");
  quizSection.classList.remove("hidden");
  renderQuestion();
}

examFilter.addEventListener("change", loadTopics);
startBtn.addEventListener("click", () => {
  startSession().catch((error) => {
    alert(`Could not load selected topic file. ${error.message}`);
  });
});
submitBtn.addEventListener("click", () => submitAnswer(false));
nextBtn.addEventListener("click", () => {
  currentIndex += 1;
  if (currentIndex >= sessionQuestions.length) {
    showResults();
  } else {
    renderQuestion();
  }
});
restartBtn.addEventListener("click", () => {
  resultSection.classList.add("hidden");
  quizSection.classList.add("hidden");
});

window.TOPIC_QUESTION_DATA = window.TOPIC_QUESTION_DATA || {};
loadManifestOnlyMode();
loadTopics();
