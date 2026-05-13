const { auth, db, provider, signInWithPopup, signOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, increment, serverTimestamp } = window.fb;

let currentUser = null;
let currentQuestionStats = null;

// Auth UI Elements
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfo = document.getElementById('user-info');
const userPhoto = document.getElementById('user-photo');
const userName = document.getElementById('user-name');

// Result UI Elements
const correctBtn = document.getElementById('correct-btn');
const incorrectBtn = document.getElementById('incorrect-btn');
const statsBadge = document.getElementById('question-stats');
const successRateSpan = document.getElementById('success-rate');
const statCorrectSpan = document.getElementById('stat-correct');
const statCountSpan = document.getElementById('stat-count');

// --- Firebase Auth Logic ---
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    loginBtn.style.display = 'none';
    userInfo.style.display = 'flex';
    userPhoto.src = user.photoURL;
    userName.textContent = user.displayName.split(' ')[0];
    updateViewer(); // Refresh to show stats
  } else {
    currentUser = null;
    loginBtn.style.display = 'block';
    userInfo.style.display = 'none';
    statsBadge.style.display = 'none';
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
