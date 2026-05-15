const { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, getDocs, query, deleteDoc, writeBatch } = window.fb;

// --- Global State ---
let currentUser = null;
let currentQuestionStats = null;
let appData = { images: { ippan: [] }, explanations: { ippan: {} }, genres: {} };
let selectedImages = [];
let currentIndex = 0;
let globalStatsData = [];

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
  const count = (subject === 'ippan' || subject === 'senmon') ? 15 : 5;
  startBtn.textContent = `過去問作成 (${count}問)`;
  updateGenreSelect();
});

if (statsSortSelect) {
  statsSortSelect.addEventListener('change', () => renderStatsList());
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

function getGroup(filename) {
  const nameWithoutExt = filename.split('.')[0].trim();
  const cleaned = nameWithoutExt.replace(/\s+/g, '');
  return cleaned.slice(-2);
}

function generateExam() {
  const subject = subjectSelect.value;
  if (subject !== 'ippan') { alert('現在は「一般知識」のみ対応しています。'); return; }

  const groups = {};
  for (let i = 1; i <= 15; i++) groups[i.toString().padStart(2, '0')] = [];

  const availableImages = appData.images[subject];
  if (!availableImages || availableImages.length === 0) { alert('画像データがありません。'); return; }

  availableImages.forEach(img => {
    const groupKey = getGroup(img);
    if (groups[groupKey]) groups[groupKey].push(img);
  });

  selectedImages = [];
  for (let i = 1; i <= 15; i++) {
    const group = groups[i.toString().padStart(2, '0')];
    if (group && group.length > 0) {
      selectedImages.push(`img/ippan/${group[Math.floor(Math.random() * group.length)]}`);
    }
  }
  currentIndex = 0;
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

function generateSimpleTest() {
  const subject = subjectSelect.value;
  const count = parseInt(modalQuestionCount.value);
  const selectedGenre = modalGenreSelect.value;
  let availableImages = appData.images[subject] || [];
  
  if (selectedGenre !== 'all') {
    const genreIds = appData.genres[subject]?.[selectedGenre] || [];
    availableImages = availableImages.filter(img => {
      const info = getFileInfo(img);
      return genreIds.includes(`${info.year}_${info.question}`);
    });
  }

  if (availableImages.length === 0) { alert('該当する問題が見つかりませんでした。'); return; }

  selectedImages = [...availableImages].sort(() => 0.5 - Math.random()).slice(0, count).map(img => `img/${subject}/${img}`);
  currentIndex = 0;
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

startBtn.addEventListener('click', generateExam);

// --- Viewer Logic ---
async function fetchExplanation(year, question) {
  const subject = subjectSelect.value;
  const data = appData.explanations[subject]?.[year]?.[question];
  if (data) return typeof data === 'object' ? data.text : data;
  return '# 解説がありません';
}

async function updateViewer() {
  if (selectedImages.length === 0) return;
  explanationContent.innerHTML = '';
  examImg.style.opacity = 0;
  
  const currentPath = selectedImages[currentIndex];
  const { year, question } = getFileInfo(currentPath);
  document.getElementById('modal-title').textContent = `第${year}回 問${question} 解説`;

  if (currentUser) {
    const stats = await fetchQuestionStats(year, question);
    displayStats(stats);
  }

  const explanation = await fetchExplanation(year, question);
  let mdText = explanation.replace(/> \[!(\w+)\]\n((?:> .*\n?)+)/gim, (m, type, content) => {
    return `<div class="alert ${type}">\n\n${content.replace(/^> /gim, '')}\n\n</div>`;
  });

  explanationContent.innerHTML = marked.parse(mdText);
  if (window.renderMathInElement) {
    renderMathInElement(explanationContent, {
      delimiters: [{left: '$$', right: '$$', display: true}, {left: '$', right: '$', display: false}],
      throwOnError: false
    });
  }

  setTimeout(() => {
    examImg.src = currentPath;
    examImg.style.opacity = 1;
    statusText.textContent = `${currentIndex + 1} / ${selectedImages.length} （第${year}回問${question}）`;
  }, 200);
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
async function fetchQuestionStats(year, question) {
  if (!currentUser) return null;
  const docRef = doc(db, "users", currentUser.uid, "question_stats", `${year}_${question}`);
  const snap = await getDoc(docRef);
  return snap.exists() ? snap.data() : { correct: 0, count: 0 };
}

async function recordResult(isCorrect) {
  if (!currentUser) { alert("ログインが必要です。"); return; }
  const { year, question } = getFileInfo(selectedImages[currentIndex]);
  const docRef = doc(db, "users", currentUser.uid, "question_stats", `${year}_${question}`);
  const btn = isCorrect ? correctBtn : incorrectBtn;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 200);

  try {
    const snap = await getDoc(docRef);
    if (!snap.exists()) {
      await setDoc(docRef, { correct: isCorrect ? 1 : 0, count: 1, lastAttemptAt: serverTimestamp() });
    } else {
      await updateDoc(docRef, { correct: increment(isCorrect ? 1 : 0), count: increment(1), lastAttemptAt: serverTimestamp() });
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
async function openDashboard() {
  if (!currentUser) return;
  statsList.innerHTML = '<div style="text-align:center; padding:2rem;">取得中...</div>';
  try {
    const q = query(collection(db, "users", currentUser.uid, "question_stats"));
    const snap = await getDocs(q);
    globalStatsData = [];
    let totalAttempts = 0, totalCorrect = 0;

    snap.forEach((doc) => {
      const data = doc.data();
      const parts = doc.id.split('_');
      const year = parts[0], question = parseInt(parts[1]);
      const rate = data.count > 0 ? ((data.correct / data.count) * 100) : 0;
      globalStatsData.push({ id: doc.id, year, question, displayId: `${year}回 問${question}`, ...data, rate });
      totalAttempts += data.count;
      totalCorrect += data.correct;
    });

    totalAttemptsSpan.textContent = totalAttempts;
    avgSuccessRateSpan.textContent = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0;
    renderStatsList();
  } catch (e) { console.error(e); }
}

function renderStatsList() {
  if (globalStatsData.length === 0) { statsList.innerHTML = '<div style="text-align:center; padding:2rem;">データなし</div>'; return; }
  const sortType = statsSortSelect ? statsSortSelect.value : 'rate-asc';
  const sorted = [...globalStatsData].sort((a, b) => {
    if (sortType === 'rate-asc') return a.rate - b.rate;
    if (sortType === 'rate-desc') return b.rate - a.rate;
    if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
    return a.question - b.question;
  });

  statsList.innerHTML = sorted.map(stat => `
    <div class="stat-item clickable" onclick="jumpToQuestion('${stat.year}', ${stat.question})">
      <div class="stat-info"><span class="stat-q-id">第${stat.displayId}</span><br><small>解答:${stat.count}/正解:${stat.correct}</small></div>
      <div class="stat-result"><span class="stat-percent ${stat.rate < 40 ? 'low-rate' : stat.rate < 70 ? 'mid-rate' : 'high-rate'}">${stat.rate.toFixed(0)}%</span></div>
    </div>
  `).join('');
}

window.jumpToQuestion = function(year, question) {
  const subject = subjectSelect.value;
  const imgFile = appData.images[subject].find(img => {
    const info = getFileInfo(img);
    return info.year == year && info.question == question;
  });
  if (imgFile) {
    selectedImages = [`img/${subject}/${imgFile}`];
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
}

loadDataFromStorage();
updateGenreSelect();
