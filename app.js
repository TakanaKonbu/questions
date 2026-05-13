const { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp, collection, getDocs, query, deleteDoc, writeBatch } = window.fb;

let currentUser = null;
let currentQuestionStats = null;

// Auth UI Elements
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

// Dashboard UI Elements
const statsList = document.getElementById('stats-list');
const totalAttemptsSpan = document.getElementById('total-attempts');
const avgSuccessRateSpan = document.getElementById('avg-success-rate');
const resetDataBtn = document.getElementById('reset-data-btn');

// Result UI Elements
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');
const statsBadge = document.getElementById('question-stats');
const successRateSpan = document.getElementById('success-rate');
const statCorrectSpan = document.getElementById('stat-correct');
const statCountSpan = document.getElementById('stat-count');

// --- Navigation Logic ---
function switchView(viewName) {
  console.log("Switching to view:", viewName);
  if (viewName === 'home') {
    homeView.classList.add('active');
    statsView.classList.remove('active');
    navHome.classList.add('active');
    navStats.classList.remove('active');
  } else {
    homeView.classList.remove('active');
    statsView.classList.add('active');
    navHome.classList.remove('active');
    navStats.classList.add('active');
    openDashboard();
  }
}

navHome.addEventListener('click', () => switchView('home'));
navStats.addEventListener('click', () => switchView('stats'));
statsBackBtn.addEventListener('click', () => switchView('home'));

// --- Firebase Auth Logic ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    mainNav.style.display = 'flex';
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName.split(' ')[0];
    updateViewer(); // Refresh to show stats
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
  try {
    await signInWithPopup(auth, provider);
  } catch (error) {
    console.error("Login failed:", error);
    alert("ログインに失敗しました。");
  }
});

logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

let globalStatsData = [];
const statsSortSelect = document.getElementById('stats-sort-select');

if (statsSortSelect) {
  statsSortSelect.addEventListener('change', () => {
    renderStatsList();
  });
}

function findImagePath(year, question) {
  const subject = subjectSelect.value;
  const availableImages = appData.images[subject];
  if (!availableImages) return null;
  
  return availableImages.find(img => {
    const info = getFileInfo(img);
    return info.year == year && info.question == question;
  });
}

window.jumpToQuestion = function(year, question) {
  const imgFile = findImagePath(year, question);
  if (imgFile) {
    const subject = subjectSelect.value;
    selectedImages = [`img/${subject}/${imgFile}`];
    currentIndex = 0;
    updateViewer();
    switchView('home');
    viewer.style.display = 'flex';
    viewer.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(`第${year}回 問${question} の画像データが現在の科目（${subjectSelect.options[subjectSelect.selectedIndex].text}）に見つかりません。`);
  }
};

function renderStatsList() {
  if (globalStatsData.length === 0) {
    statsList.innerHTML = '<div class="no-data" style="text-align:center; padding:2rem; color:var(--text-muted);">まだデータがありません。問題を解いて記録しましょう！</div>';
    return;
  }

  const sortType = statsSortSelect ? statsSortSelect.value : 'rate-asc';
  
  const sortedStats = [...globalStatsData].sort((a, b) => {
    if (sortType === 'rate-asc') return a.rate - b.rate;
    if (sortType === 'rate-desc') return b.rate - a.rate;
    if (sortType === 'question') {
      if (a.year !== b.year) return parseInt(a.year) - parseInt(b.year);
      return a.question - b.question;
    }
  });

  const html = sortedStats.map(stat => {
    let rateClass = 'high-rate';
    if (stat.rate < 40) rateClass = 'low-rate';
    else if (stat.rate < 70) rateClass = 'mid-rate';

    return `
      <div class="stat-item clickable" onclick="jumpToQuestion('${stat.year}', ${stat.question})">
        <div class="stat-info">
          <span class="stat-q-id">第${stat.displayId}</span>
          <span class="stat-details">解答数: ${stat.count}回 / 正解: ${stat.correct}回</span>
        </div>
        <div class="stat-result">
          <span class="stat-percent ${rateClass}">${stat.rate.toFixed(0)}%</span>
        </div>
      </div>
    `;
  }).join('');
  
  statsList.innerHTML = html;
}

// --- Dashboard Logic ---
async function openDashboard() {
  console.log("--- openDashboard Start ---");
  if (!currentUser) {
    console.error("No user logged in");
    return;
  }
  
  statsList.innerHTML = '<div class="loading" style="text-align:center; padding:2rem;">データを取得中...</div>';
  
  try {
    console.log("Fetching stats from Firestore for UID:", currentUser.uid);
    const q = query(collection(db, "users", currentUser.uid, "question_stats"));
    const querySnapshot = await getDocs(q);
    console.log("Query completed. Snapshot size:", querySnapshot.size);
    
    globalStatsData = [];
    let totalAttempts = 0;
    let totalCorrect = 0;

    querySnapshot.forEach((doc) => {
      const data = doc.data();
      const parts = doc.id.split('_');
      const year = parts[0];
      const question = parseInt(parts[1]);
      const displayId = `${year}回 問${question}`;
      
      const rate = data.count > 0 ? ((data.correct / data.count) * 100) : 0;
      globalStatsData.push({ id: doc.id, year, question, displayId, ...data, rate });
      totalAttempts += data.count;
      totalCorrect += data.correct;
    });

    totalAttemptsSpan.textContent = totalAttempts;
    avgSuccessRateSpan.textContent = totalAttempts > 0 ? ((totalCorrect / totalAttempts) * 100).toFixed(1) : 0;

    renderStatsList();

  } catch (error) {
    console.error("Dashboard error:", error);
    statsList.innerHTML = `<div class="error" style="color:red; padding:2rem;">データの取得に失敗しました。<br>理由: ${error.message}</div>`;
  }
}

if (resetDataBtn) {
  resetDataBtn.addEventListener('click', async () => {
    if (!currentUser) return;
    if (!confirm("すべての学習記録を削除します。この操作は取り消せません。よろしいですか？")) return;

    try {
      const q = query(collection(db, "users", currentUser.uid, "question_stats"));
      const querySnapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      querySnapshot.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      alert("データを削除しました。");
      switchView('home');
      updateViewer();
    } catch (error) {
      console.error("Error resetting data:", error);
      alert("データの削除に失敗しました。");
    }
  });
}

// --- Firestore Stats Logic ---
async function fetchQuestionStats(year, question) {
  if (!currentUser) return null;
  const docId = `${year}_${question}`;
  const docRef = doc(db, "users", currentUser.uid, "question_stats", docId);
  const docSnap = await getDoc(docRef);
  
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return { correct: 0, count: 0 };
}

async function recordResult(isCorrect) {
  if (!currentUser) {
    alert("学習記録を保存するにはログインが必要です。");
    return;
  }

  const currentPath = selectedImages[currentIndex];
  const { year, question } = getFileInfo(currentPath);
  const docId = `${year}_${question}`;
  const docRef = doc(db, "users", currentUser.uid, "question_stats", docId);

  const btn = isCorrect ? correctBtn : incorrectBtn;
  btn.classList.add('active');
  setTimeout(() => btn.classList.remove('active'), 200);

  try {
    const docSnap = await getDoc(docRef);
    if (!docSnap.exists()) {
      await setDoc(docRef, {
        correct: isCorrect ? 1 : 0,
        count: 1,
        lastAttemptAt: serverTimestamp()
      });
    } else {
      await updateDoc(docRef, {
        correct: increment(isCorrect ? 1 : 0),
        count: increment(1),
        lastAttemptAt: serverTimestamp()
      });
    }
    // Update UI immediately
    const updatedStats = await fetchQuestionStats(year, question);
    displayStats(updatedStats);
  } catch (error) {
    console.error("Error recording result:", error);
  }
}

function displayStats(stats) {
  if (!stats || stats.count === 0) {
    statsBadge.style.display = 'none';
    return;
  }
  
  const rate = ((stats.correct / stats.count) * 100).toFixed(0);
  successRateSpan.textContent = rate;
  statCorrectSpan.textContent = stats.correct;
  statCountSpan.textContent = stats.count;
  statsBadge.style.display = 'flex';
}

correctBtn.addEventListener('click', () => recordResult(true));
incorrectBtn.addEventListener('click', () => recordResult(false));

// --- Original App Logic ---
let appData = { images: { ippan: [] }, explanations: { ippan: {} } };
let selectedImages = [];
let currentIndex = 0;

const startBtn = document.getElementById('start-btn');
const subjectSelect = document.getElementById('subject-select');
const viewer = document.getElementById('viewer');
const examImg = document.getElementById('exam-img');
const statusText = document.getElementById('status-text');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');

const questionCountInput = document.getElementById('question-count');
const countDisplay = document.getElementById('count-display');
const simpleTestBtn = document.getElementById('simple-test-btn');

async function loadDataFromStorage() {
  const saved = localStorage.getItem('kakomonData');
  if (saved) {
    appData = JSON.parse(saved);
  } else if (typeof PRELOADED_DATA !== 'undefined') {
    appData = PRELOADED_DATA;
  }
}

loadDataFromStorage();

function getGroup(filename) {
  const nameWithoutExt = filename.split('.')[0].trim();
  const cleaned = nameWithoutExt.replace(/\s+/g, '');
  return cleaned.slice(-2);
}

function generateExam() {
  const subject = subjectSelect.value;
  if (subject !== 'ippan') {
    alert('現在は「一般知識」のみ対応しています。');
    return;
  }

  const groups = {};
  for (let i = 1; i <= 15; i++) {
    const key = i.toString().padStart(2, '0');
    groups[key] = [];
  }

  const availableImages = appData.images[subject];
  if (!availableImages || availableImages.length === 0) {
    alert('画像データがありません。');
    return;
  }

  availableImages.forEach(img => {
    const groupKey = getGroup(img);
    if (groups[groupKey]) {
      groups[groupKey].push(img);
    }
  });

  selectedImages = [];
  for (let i = 1; i <= 15; i++) {
    const key = i.toString().padStart(2, '0');
    const group = groups[key];
    if (group && group.length > 0) {
      const randomImg = group[Math.floor(Math.random() * group.length)];
      selectedImages.push(`img/ippan/${randomImg}`);
    }
  }

  currentIndex = 0;
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

function generateSimpleTest() {
  const subject = subjectSelect.value;
  const count = parseInt(questionCountInput.value);

  const availableImages = appData.images[subject];
  if (!availableImages || availableImages.length === 0) {
    alert('画像データがありません。');
    return;
  }

  const shuffled = [...availableImages].sort(() => 0.5 - Math.random());
  selectedImages = shuffled.slice(0, count).map(img => `img/${subject}/${img}`);

  currentIndex = 0;
  updateViewer();
  viewer.style.display = 'flex';
  viewer.scrollIntoView({ behavior: 'smooth' });
}

if (questionCountInput) {
  questionCountInput.addEventListener('input', () => {
    countDisplay.textContent = questionCountInput.value;
  });
}

async function fetchExplanation(year, question) {
  const subject = subjectSelect.value;
  const yearData = appData.explanations[subject]?.[year];
  if (yearData && yearData[question]) {
    const data = yearData[question];
    return typeof data === 'object' ? data.text : data;
  }
  return '# 解説がありません\nデータフォルダが正しく読み込まれているか確認してください。';
}

async function updateViewer() {
  if (selectedImages.length === 0) return;
  
  explanationContent.innerHTML = '';
  examImg.style.opacity = 0;
  
  const currentPath = selectedImages[currentIndex];
  const { year, question } = getFileInfo(currentPath);

  document.getElementById('modal-title').textContent = `第${year}回 問${question} 解説`;

  // Fetch and display stats
  if (currentUser) {
    const stats = await fetchQuestionStats(year, question);
    displayStats(stats);
  } else {
    statsBadge.style.display = 'none';
  }

  const explanation = await fetchExplanation(year, question);
  
  let mdText = explanation.replace(/> \[!(\w+)\]\n((?:> .*\n?)+)/gim, (match, type, content) => {
    let cleanContent = content.replace(/^> /gim, '');
    return `<div class="alert ${type}">\n\n${cleanContent}\n\n</div>`;
  });

  explanationContent.innerHTML = marked.parse(mdText);

  if (window.renderMathInElement) {
    renderMathInElement(explanationContent, {
      delimiters: [
        {left: '$$', right: '$$', display: true},
        {left: '$', right: '$', display: false},
        {left: '\\(', right: '\\)', display: false},
        {left: '\\[', right: '\\]', display: true}
      ],
      throwOnError: false
    });
  }

  setTimeout(() => {
    examImg.src = currentPath;
    examImg.style.opacity = 1;
    statusText.textContent = `${currentIndex + 1} / ${selectedImages.length} （第${year}回問${question}）`;
  }, 200);
}

const explanationContent = document.getElementById('explanation-content');

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

function next() {
  if (currentIndex < selectedImages.length - 1) {
    currentIndex++;
    updateViewer();
  }
}

function prev() {
  if (currentIndex > 0) {
    currentIndex--;
    updateViewer();
  }
}

prevBtn.addEventListener('click', prev);
nextBtn.addEventListener('click', next);
startBtn.addEventListener('click', generateExam);
if (simpleTestBtn) simpleTestBtn.addEventListener('click', generateSimpleTest);

const openExplanationBtn = document.getElementById('open-explanation-btn');
const explanationModal = document.getElementById('explanation-modal');
const closeExplanation = document.querySelector('.close-explanation');

if (openExplanationBtn) {
  openExplanationBtn.addEventListener('click', () => {
    explanationModal.style.display = 'flex';
    explanationContent.scrollTop = 0;
  });
}

if (closeExplanation) {
  closeExplanation.addEventListener('click', () => {
    explanationModal.style.display = 'none';
  });
}

explanationModal.addEventListener('click', (e) => {
  if (e.target === explanationModal) {
    explanationModal.style.display = 'none';
  }
});

// Fullscreen Modal Logic
const modal = document.getElementById('image-modal');
const fullImg = document.getElementById('full-img');
const closeModal = document.querySelector('.close-modal');

examImg.addEventListener('click', () => {
  modal.style.display = 'flex';
  fullImg.src = examImg.src;
});

if (closeModal) {
  closeModal.addEventListener('click', () => {
    modal.style.display = 'none';
  });
}

modal.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});
