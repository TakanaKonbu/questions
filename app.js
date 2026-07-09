const { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, getDocs, query, deleteDoc, writeBatch } = window.fb;

// Configure marked.js to preserve line breaks
if (window.marked) {
  if (typeof window.marked.setOptions === 'function') {
    window.marked.setOptions({ breaks: true });
  } else if (typeof window.marked.use === 'function') {
    window.marked.use({ breaks: true });
  }
}

// --- Global State ---
let currentUser = null;
let currentQuestionStats = null;
let appData = { images: { ippan: [], senmon: [] }, explanations: { ippan: {}, senmon: {} }, questions: {}, genres: {} };
let groupedQuestions = { ippan: {}, senmon: {}, mogi_ippan: {}, mogi_senmon: {} };
let selectedImages = [];
let currentIndex = 0;
let globalStatsData = [];
let isExamMode = false;
let examResults = [];

// --- DOM Elements ---
// Auth
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');
const mainNav = document.getElementById('main-nav');

// Navigation
const navHome = document.getElementById('nav-home');
const navStats = document.getElementById('nav-stats');
const homeView = document.getElementById('home-view');
const statsView = document.getElementById('stats-view');
const statsBackBtn = document.getElementById('stats-back-btn');

// Dashboard
const statsList = document.getElementById('stats-list');
const totalAttemptsSpan = document.getElementById('total-attempts');
const avgSuccessRateSpan = document.getElementById('avg-success-rate');
const resetDataBtn = document.getElementById('reset-data-btn');
const statsSortSelect = document.getElementById('stats-sort-select');
const statsSubjectSelect = document.getElementById('stats-subject-select');

// Viewer
const viewer = document.getElementById('viewer');
const examImg = document.getElementById('exam-img');
const statusText = document.getElementById('status-text');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const explanationContent = document.getElementById('explanation-content');
const openExplanationBtn = document.getElementById('open-explanation-btn');
const explanationModal = document.getElementById('explanation-modal');
const closeExplanation = document.querySelector('.close-explanation');
const imageModal = document.getElementById('image-modal');
const fullImg = document.getElementById('full-img');
const closeModal = document.querySelector('.close-modal');

// Stats Badge
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');
const statsBadge = document.getElementById('question-stats');
const successRateSpan = document.getElementById('success-rate');
const statCorrectSpan = document.getElementById('stat-correct');
const statCountSpan = document.getElementById('stat-count');

// Test Settings
const startBtn = document.getElementById('start-btn');
const simpleTestBtn = document.getElementById('simple-test-btn');
const subjectSelect = document.getElementById('subject-select');
const simpleTestModal = document.getElementById('simple-test-modal');
const modalGenreSelect = document.getElementById('modal-genre-select');
const modalQuestionCount = document.getElementById('modal-question-count');
const modalCountDisplay = document.getElementById('modal-count-display');
const modalStartTestBtn = document.getElementById('modal-start-test-btn');
const closeSimpleTest = document.querySelector('.close-simple-test');

// Test Results DOM Elements
const viewResultsBtn = document.getElementById('view-results-btn');
const resultModal = document.getElementById('result-modal');
const closeResult = document.querySelector('.close-result');
const resultScore = document.getElementById('result-score');
const resultPercent = document.getElementById('result-percent');
const resultList = document.getElementById('result-list');
const resultReviewBtn = document.getElementById('result-review-btn');
const resultHomeBtn = document.getElementById('result-home-btn');

// --- Navigation Logic ---
function switchView(viewName) {
  if (viewName === 'home') {
    homeView.classList.add('active');
    statsView.classList.remove('active');
    navHome.classList.add('active');
    navStats.classList.remove('active');
    updateGenreSelect();
  } else {
    homeView.classList.remove('active');
    statsView.classList.add('active');
    navHome.classList.remove('active');
    navStats.classList.add('active');
    openDashboard();
  }
}

function updateGenreSelect() {
  const subject = subjectSelect.value;
  const genres = appData.genres && appData.genres[subject];
  modalGenreSelect.innerHTML = '<option value="all">全範囲</option>';
  
  const genreSettings = modalGenreSelect.closest('.test-settings');
  if (genreSettings) {
    if (subject.startsWith('mogi_')) {
      genreSettings.style.display = 'none';
    } else {
      genreSettings.style.display = 'flex';
    }
  }

  if (genres && Object.keys(genres).length > 0) {
    for (const genreName in genres) {
      const option = document.createElement('option');
      option.value = genreName;
      option.textContent = genreName;
      modalGenreSelect.appendChild(option);
    }
  }
}

// --- Event Listeners (Init) ---
navHome.addEventListener('click', () => switchView('home'));
navStats.addEventListener('click', () => switchView('stats'));
statsBackBtn.addEventListener('click', () => switchView('home'));

subjectSelect.addEventListener('change', () => {
  const subject = subjectSelect.value;
  const count = (subject === 'ippan' || subject === 'senmon' || subject === 'mogi_ippan' || subject === 'mogi_senmon') ? 15 : 5;
  startBtn.textContent = (subject.startsWith('mogi_') ? '模擬試験作成' : '過去問作成') + ` (${count}問)`;
  updateGenreSelect();
});

if (statsSortSelect) {
  statsSortSelect.addEventListener('change', () => {
    const selectedSubject = statsSubjectSelect.value;
    const filteredStats = globalStatsData.filter(s => s.subject === selectedSubject);
    renderStatsList(filteredStats);
  });
}

if (statsSubjectSelect) {
  statsSubjectSelect.addEventListener('change', () => renderDashboardFiltered());
}

if (simpleTestBtn) {
  simpleTestBtn.addEventListener('click', () => {
    simpleTestModal.style.display = 'flex';
  });
}

if (closeSimpleTest) {
  closeSimpleTest.addEventListener('click', () => {
    simpleTestModal.style.display = 'none';
  });
}

simpleTestModal.addEventListener('click', (e) => {
  if (e.target === simpleTestModal) simpleTestModal.style.display = 'none';
});

if (modalQuestionCount) {
  modalQuestionCount.addEventListener('input', () => {
    modalCountDisplay.textContent = modalQuestionCount.value;
  });
}

if (modalStartTestBtn) {
  modalStartTestBtn.addEventListener('click', () => {
    simpleTestModal.style.display = 'none';
    generateSimpleTest();
  });
}

// Test Results Event Listeners
if (viewResultsBtn) viewResultsBtn.addEventListener('click', showExamResults);
if (closeResult) closeResult.addEventListener('click', () => { resultModal.style.display = 'none'; });
if (resultModal) {
  resultModal.addEventListener('click', (e) => { if (e.target === resultModal) resultModal.style.display = 'none'; });
}
if (resultReviewBtn) resultReviewBtn.addEventListener('click', () => { resultModal.style.display = 'none'; });
if (resultHomeBtn) {
  resultHomeBtn.addEventListener('click', () => {
    resultModal.style.display = 'none';
    switchView('home');
    viewer.style.display = 'none';
  });
}

// --- Firebase Auth Logic ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    mainNav.style.display = 'flex';
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName.split(' ')[0];
    updateViewer();
  } else {
    currentUser = null;
    loginBtn.style.display = 'block';
    userInfo.style.display = 'none';
    mainNav.style.display = 'none';
    statsBadge.style.display = 'none';
    switchView('home');
  }
});

loginBtn.addEventListener('click', async () => {
  try { await signInWithPopup(auth, provider); }
  catch (error) { alert("ログインに失敗しました。"); }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// --- Test Generation Logic ---
function getFileInfo(path) {
  const filename = path.split('/').pop();
  const nameWithoutExt = filename.split('.')[0].trim();
  const cleaned = nameWithoutExt.replace(/\s+/g, '');
  const parts = cleaned.split('_');
  if (parts.length < 2) {
    return { year: cleaned.slice(0, 2), question: parseInt(cleaned.slice(-2)) };
  }
  return { year: parts[0], question: parseInt(parts[1]) };
}

function initializeGroupedQuestions() {
  const subjects = ["ippan", "senmon", "mogi_ippan", "mogi_senmon"];
  subjects.forEach(subject => {
    groupedQuestions[subject] = {};
    
    // Past exams (images)
    const imageFiles = appData.images[subject] || [];
    imageFiles.forEach(file => {
      const info = getFileInfo(file);
      const key = `${info.year}_${info.question}`;
      if (!groupedQuestions[subject][key]) {
        groupedQuestions[subject][key] = {
          id: key,
          year: info.year,
          question: info.question,
          images: [],
          text: null
        };
      }
      groupedQuestions[subject][key].images.push(`img/${subject}/${file}`);
    });
    
    // Mock exams (texts)
    const qTexts = appData.questions && appData.questions[subject];
    if (qTexts) {
      for (const year in qTexts) {
        for (const question in qTexts[year]) {
          const key = `${year}_${question}`;
          if (!groupedQuestions[subject][key]) {
            groupedQuestions[subject][key] = {
              id: key,
              year: year,
              question: parseInt(question),
              images: [],
              text: qTexts[year][question]
            };
          } else {
            groupedQuestions[subject][key].text = qTexts[year][question];
          }
        }
      }
    }
  });
}

function generateExam() {
  const subject = subjectSelect.value;
  const count = (subject === 'ippan' || subject === 'senmon' || subject === 'mogi_ippan' || subject === 'mogi_senmon') ? 15 : 5;

  const subjectQuestions = groupedQuestions[subject];
  if (!subjectQuestions || Object.keys(subjectQuestions).length === 0) { alert('問題データがありません。'); return; }

  const questionGroups = {};
  for (let i = 1; i <= count; i++) {
    questionGroups[i] = [];
  }

  for (const key in subjectQuestions) {
    const qObj = subjectQuestions[key];
    if (questionGroups[qObj.question]) {
      questionGroups[qObj.question].push(qObj);
    }
  }

  selectedImages = [];
  for (let i = 1; i <= count; i++) {
    const group = questionGroups[i];
    if (group && group.length > 0) {
      selectedImages.push(group[Math.floor(Math.random() * group.length)]);
    }
  }

  currentIndex = 0;
  isExamMode = true;
  examResults = Array(selectedImages.length).fill(null);
  if (viewResultsBtn) viewResultsBtn.style.display = 'block';
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

function generateSimpleTest() {
  const subject = subjectSelect.value;
  const count = parseInt(modalQuestionCount.value);
  const selectedGenre = modalGenreSelect.value;

  let availableQuestions = [];
  const subjectQuestions = groupedQuestions[subject];
  if (subjectQuestions) {
    availableQuestions = Object.values(subjectQuestions);
  }
  
  if (selectedGenre !== 'all') {
    const genreIds = appData.genres[subject]?.[selectedGenre] || [];
    availableQuestions = availableQuestions.filter(qObj => genreIds.includes(qObj.id));
  }

  if (availableQuestions.length === 0) { alert('該当する問題が見つかりませんでした。'); return; }

  selectedImages = [...availableQuestions].sort(() => 0.5 - Math.random()).slice(0, count);
  currentIndex = 0;
  isExamMode = false;
  examResults = Array(selectedImages.length).fill(null);
  if (viewResultsBtn) viewResultsBtn.style.display = 'block';
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

startBtn.addEventListener('click', generateExam);

// --- Viewer Logic ---
function renderMarkdownWithMath(text) {
  if (!text) return '';
  
  const placeholders = [];
  let index = 0;
  
  // 1. Protect display math ($$ ... $$)
  let processedText = text.replace(/\$\$([\s\S]+?)\$\$/g, (match, math) => {
    const placeholder = `EXAMDISPLAYMATH${index}EXAM`;
    placeholders.push({ placeholder, math: `$$${math}$$` });
    index++;
    return placeholder;
  });
  
  // 2. Protect inline math ($ ... $)
  processedText = processedText.replace(/\$([^\$\n]+?)\$/g, (match, math) => {
    const placeholder = `EXAMINLINEMATH${index}EXAM`;
    placeholders.push({ placeholder, math: `$${math}$` });
    index++;
    return placeholder;
  });
  
  // 3. Replace half-width tilde (~) with full-width wave dash (〜) outside math formulas
  // to prevent marked.js from parsing it as strikethrough (del/s) tags.
  processedText = processedText.replace(/~/g, '〜');
  
  // 4. Parse Markdown
  let html = marked.parse(processedText);
  
  // 5. Restore math formulas (using split/join for global replacement)
  placeholders.forEach(item => {
    html = html.split(item.placeholder).join(item.math);
  });
  
  return html;
}

async function fetchExplanation(year, question) {
  const subject = subjectSelect.value;
  const data = appData.explanations[subject]?.[year]?.[question];
  if (data) return typeof data === 'object' ? data.text : data;
  return '# 解説がありません';
}

async function updateViewer() {
  if (selectedImages.length === 0) return;
  explanationContent.innerHTML = '';
  
  const qObj = selectedImages[currentIndex];
  const year = qObj.year;
  const question = qObj.question;
  
  const subject = subjectSelect.value;
  const isMogi = subject.startsWith('mogi_');
  document.getElementById('modal-title').textContent = `${isMogi ? '' : '第'}${year}回 問${question} 解説`;

  if (currentUser && !isExamMode) {
    const stats = await fetchQuestionStats(subject, year, question);
    displayStats(stats);
  } else {
    statsBadge.style.display = 'none';
  }

  updateExamButtonStyles();

  const explanation = await fetchExplanation(year, question);
  let mdText = explanation.replace(/> \[!(\w+)\]\n((?:> .*\n?)+)/gim, (m, type, content) => {
    return `<div class="alert ${type}">\n\n${content.replace(/^> /gim, '')}\n\n</div>`;
  });

  explanationContent.innerHTML = renderMarkdownWithMath(mdText);
  if (window.renderMathInElement) {
    renderMathInElement(explanationContent, {
      delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
      throwOnError: false
    });
  }

  const imgContainer = document.querySelector('.img-container');
  imgContainer.innerHTML = '';
  
  if (qObj.images && qObj.images.length > 0) {
    imgContainer.style.display = 'flex';
    qObj.images.forEach((path, idx) => {
      const img = document.createElement('img');
      img.src = path;
      img.alt = `過去問画像 ${idx + 1}`;
      img.style.opacity = 0;
      img.style.transition = 'opacity 0.3s ease';
      img.style.cursor = 'pointer';
      
      img.addEventListener('click', () => {
        imageModal.style.display = 'flex';
        fullImg.src = path;
      });
      
      imgContainer.appendChild(img);
      
      setTimeout(() => {
        img.style.opacity = 1;
      }, 50);
    });
  } else if (qObj.text) {
    imgContainer.style.display = 'block';
    const textDiv = document.createElement('div');
    textDiv.className = 'exam-text';
    textDiv.style.width = '100%';
    textDiv.style.padding = '1.5rem';
    textDiv.style.textAlign = 'left';
    textDiv.style.overflowY = 'auto';
    textDiv.style.maxHeight = '60vh';
    
    textDiv.innerHTML = renderMarkdownWithMath(qObj.text);
    
    if (window.renderMathInElement) {
      renderMathInElement(textDiv, {
        delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
        throwOnError: false
      });
    }
    
    imgContainer.appendChild(textDiv);
  } else {
    imgContainer.style.display = 'none';
  }

  statusText.textContent = `${currentIndex + 1} / ${selectedImages.length} （${isMogi ? '模擬試験' : '第' + year + '回'}問${question}）`;
}

function next() { if (currentIndex < selectedImages.length - 1) { currentIndex++; updateViewer(); } }
function prev() { if (currentIndex > 0) { currentIndex--; updateViewer(); } }

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);

// --- Explanation Modal ---
if (openExplanationBtn) {
  openExplanationBtn.addEventListener('click', () => {
    explanationModal.style.display = 'flex';
    explanationContent.scrollTop = 0;
  });
}
if (closeExplanation) closeExplanation.addEventListener('click', () => explanationModal.style.display = 'none');
explanationModal.addEventListener('click', (e) => { if (e.target === explanationModal) explanationModal.style.display = 'none'; });

// --- Image Modal ---
examImg.addEventListener('click', () => { imageModal.style.display = 'flex'; fullImg.src = examImg.src; });
if (closeModal) closeModal.addEventListener('click', () => imageModal.style.display = 'none');
imageModal.addEventListener('click', (e) => { if (e.target === imageModal) imageModal.style.display = 'none'; });

// --- Stats Logic ---
async function fetchQuestionStats(subject, year, question) {
  if (!currentUser) return null;
  const key = `${subject}_${year}_${question}`;
  const docRef = doc(db, "users", currentUser.uid, "question_stats", key);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : { correct: 0, count: 0 };
}

async function recordResult(isCorrect) {
  const btn = isCorrect ? correctBtn : incorrectBtn;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 200);

  if (examResults && examResults.length > 0) {
    examResults[currentIndex] = isCorrect;
    updateExamButtonStyles();
    
    // 全問回答済みかつ最後の問題で回答した場合は自動で成績表示
    const unansweredCount = examResults.filter(r => r === null).length;
    if (unansweredCount === 0 && currentIndex === selectedImages.length - 1) {
      setTimeout(() => {
        showExamResults();
      }, 300);
    }
  }

  if (!currentUser) { return; }

  const subject = subjectSelect.value;
  const qObj = selectedImages[currentIndex];
  const year = qObj.year;
  const question = qObj.question;
  const key = `${subject}_${year}_${question}`;
  const docRef = doc(db, "users", currentUser.uid, "question_stats", key);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, { subject: subject, correct: isCorrect ? 1 : 0, count: 1, lastAttemptAt: serverTimestamp() });
    } else {
      await updateDoc(docRef, { subject: subject, correct: increment(isCorrect ? 1 : 0), count: increment(1), lastAttemptAt: serverTimestamp() });
    }
    const stats = await fetchQuestionStats(year, question);
    displayStats(stats);
  } catch (e) { console.error(e); }
}

function displayStats(stats) {
  if (!stats || stats.count === 0) { statsBadge.style.display = 'none'; return; }
  successRateSpan.textContent = ((stats.correct / stats.count) * 100).toFixed(0);
  statCorrectSpan.textContent = stats.correct;
  statCountSpan.textContent = stats.count;
  statsBadge.style.display = 'flex';
}

correctBtn.addEventListener('click', () => recordResult(true));
incorrectBtn.addEventListener('click', () => recordResult(false));

// --- Dashboard ---
const genreStatsSection = document.getElementById('genre-stats-section');
const genreStatsList = document.getElementById('genre-stats-list');

async function openDashboard() {
  if (!currentUser) return;
  statsList.innerHTML = '<div style="text-align:center; padding:2rem;">取得中...</div>';
  try {
    const q = query(collection(db, "users", currentUser.uid, "question_stats"));
    const snap = await getDocs(q);
    globalStatsData = [];

    snap.forEach((doc) => {
      const data = doc.data();
      const id = doc.id;
      let subject = data.subject;
      let year, question;
      const parts = id.split('_');
      if (parts.length >= 3) {
        question = parseInt(parts[parts.length - 1]);
        year = parts[parts.length - 2];
        subject = subject || parts.slice(0, parts.length - 2).join('_');
      } else if (parts.length === 2) {
        subject = subject || "ippan";
        year = parts[0];
        question = parseInt(parts[1]);
      } else {
        subject = subject || "ippan";
        year = "unknown";
        question = 0;
      }

      const rate = data.count > 0 ? ((data.correct / data.count) * 100) : 0;
      const isMogi = subject.startsWith('mogi_');
      globalStatsData.push({
        id: `${year}_${question}`,
        subject,
        year,
        question,
        displayId: isMogi ? `模擬試験 ${year}回 問${question}` : `${year}回 問${question}`,
        ...data,
        rate
      });
    });

    renderDashboardFiltered();
  } catch (e) { console.error(e); }
}

function renderDashboardFiltered() {
  const selectedSubject = statsSubjectSelect.value;
  const filteredStats = globalStatsData.filter(s => s.subject === selectedSubject);
  
  let totalAttempts = 0, totalCorrect = 0;
  filteredStats.forEach(s => {
    totalAttempts += s.count;
    totalCorrect += s.correct;
  });

  totalAttemptsSpan.textContent = totalAttempts;
  avgSuccessRateSpan.textContent = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0;

  renderGenreStats(selectedSubject, filteredStats);
  renderStatsList(filteredStats);
}

function renderGenreStats(subject, filteredStats) {
  const genres = appData.genres && appData.genres[subject];
  
  if (!genres || Object.keys(genres).length === 0 || filteredStats.length === 0) {
    if (genreStatsSection) genreStatsSection.style.display = 'none';
    return;
  }
  
  if (genreStatsSection) genreStatsSection.style.display = 'block';
  let html = '';
  
  for (const genreName in genres) {
    const questionIds = genres[genreName];
    let genreCount = 0;
    let genreCorrect = 0;
    
    questionIds.forEach(qId => {
      const stat = filteredStats.find(s => s.id === qId);
      if (stat) {
        genreCount += stat.count;
        genreCorrect += stat.correct;
      }
    });
    
    let rate = 0;
    let rateClass = 'low-rate';
    let detailsText = '未学習';
    
    if (genreCount > 0) {
      rate = (genreCorrect / genreCount) * 100;
      detailsText = `${genreCount}問中 ${genreCorrect}問正解`;
      if (rate >= 70) rateClass = 'high-rate';
      else if (rate >= 40) rateClass = 'mid-rate';
    } else {
       rateClass = '';
    }
    
    let fillStyle = rateClass === 'high-rate' ? 'background-color: var(--success);' :
                    rateClass === 'mid-rate' ? 'background-color: var(--warning);' :
                    rateClass === 'low-rate' ? 'background-color: var(--danger);' :
                    'background-color: var(--border);';
                    
    html += `
      <div class="genre-stat-card">
        <div class="genre-stat-header">
          <span class="genre-stat-name">${genreName}</span>
          <span class="genre-stat-rate ${rateClass}">${genreCount > 0 ? rate.toFixed(0) + '%' : '--%'}</span>
        </div>
        <div class="genre-progress-bg">
          <div class="genre-progress-fill" style="width: ${rate}%; ${fillStyle}"></div>
        </div>
        <div class="genre-stat-details">${detailsText}</div>
      </div>
    `;
  }
  
  if (genreStatsList) genreStatsList.innerHTML = html;
}

function renderStatsList(filteredStats) {
  if (filteredStats.length === 0) { statsList.innerHTML = '<div style="text-align:center; padding:2rem;">データなし</div>'; return; }
  const sortType = statsSortSelect ? statsSortSelect.value : 'rate-asc';
  const sorted = [...filteredStats].sort((a, b) => {
    if (sortType === 'rate-asc') return a.rate - b.rate;
    if (sortType === 'rate-desc') return b.rate - a.rate;
    if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
    return a.question - b.question;
  });

  statsList.innerHTML = sorted.map(stat => {
    const isMogi = stat.subject.startsWith('mogi_');
    const prefix = isMogi ? '' : '第';
    return `
      <div class="stat-item clickable" onclick="jumpToQuestion('${stat.year}', ${stat.question})">
        <div class="stat-info"><span class="stat-q-id">${prefix}${stat.displayId}</span><br><small>解答:${stat.count}/正解:${stat.correct}</small></div>
        <div class="stat-result"><span class="stat-percent ${stat.rate < 40 ? 'low-rate' : stat.rate < 70 ? 'mid-rate' : 'high-rate'}">${stat.rate.toFixed(0)}%</span></div>
      </div>
    `;
  }).join('');
}

window.jumpToQuestion = function(year, question) {
  const subject = statsSubjectSelect.value;
  subjectSelect.value = subject;
  subjectSelect.dispatchEvent(new Event('change'));
  
  const key = `${year}_${question}`;
  const qObj = groupedQuestions[subject]?.[key];
  if (qObj) {
    selectedImages = [qObj];
    currentIndex = 0;
    updateViewer();
    switchView('home');
    viewer.style.display = 'flex';
    viewer.scrollIntoView({ behavior: 'smooth' });
  }
};

if (resetDataBtn) {
  resetDataBtn.addEventListener('click', async () => {
    if (!currentUser || !confirm("すべて削除しますか？")) return;
    const snap = await getDocs(query(collection(db, "users", currentUser.uid, "question_stats")));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    location.reload();
  });
}

// --- Init ---
async function loadDataFromStorage() {
  if (typeof PRELOADED_DATA !== 'undefined') appData = PRELOADED_DATA;
  initializeGroupedQuestions();
}

loadDataFromStorage();
updateGenreSelect();

// --- Test Results Helpers ---
function updateExamButtonStyles() {
  correctBtn.style.opacity = '1';
  incorrectBtn.style.opacity = '1';
  correctBtn.classList.remove('selected');
  incorrectBtn.classList.remove('selected');

  if (examResults && examResults.length > 0 && examResults[currentIndex] !== null) {
    const isCorrect = examResults[currentIndex];
    if (isCorrect) {
      correctBtn.classList.add('selected');
      incorrectBtn.style.opacity = '0.4';
    } else {
      incorrectBtn.classList.add('selected');
      correctBtn.style.opacity = '0.4';
    }
  }
}

function showExamResults() {
  if (selectedImages.length === 0) return;

  const unansweredCount = examResults.filter(r => r === null).length;
  if (unansweredCount > 0) {
    if (!confirm(`未解答の問題が ${unansweredCount} 問あります。結果を表示しますか？`)) {
      return;
    }
  }

  const correctCount = examResults.filter(r => r === true).length;
  const totalCount = selectedImages.length;
  const percentage = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0;

  resultScore.textContent = `${correctCount} / ${totalCount}`;
  resultPercent.textContent = `正解率 ${percentage}%`;

  resultList.innerHTML = selectedImages.map((qObj, idx) => {
    const year = qObj.year;
    const question = qObj.question;
    const result = examResults[idx];
    let badgeClass = 'unanswered';
    let badgeText = '未解答';

    if (result === true) {
      badgeClass = 'correct';
      badgeText = '正解';
    } else if (result === false) {
      badgeClass = 'incorrect';
      badgeText = '不正解';
    }

    const subject = subjectSelect.value;
    const isMogi = subject.startsWith('mogi_');
    const labelText = isMogi ? `模擬試験 ${year}回 問${question}` : `第${year}回 問${question}`;

    return `
      <div class="stat-item clickable" onclick="openExamResultExplanation(${idx})">
        <div class="stat-info">
          <span class="stat-q-label">問${idx + 1}：${labelText}</span>
          <span class="stat-q-sub">クリックで解説を表示</span>
        </div>
        <div class="stat-result">
          <span class="result-badge ${badgeClass}">${badgeText}</span>
        </div>
      </div>
    `;
  }).join('');

  resultModal.style.display = 'flex';
}

window.openExamResultExplanation = async function(idx) {
  if (idx < 0 || idx >= selectedImages.length) return;

  // 該当問題へ移動
  currentIndex = idx;
  await updateViewer();

  // 結果モーダルを閉じ、解説モーダルを開く
  resultModal.style.display = 'none';
  explanationModal.style.display = 'flex';
  explanationContent.scrollTop = 0;
};
