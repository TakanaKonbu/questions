let appData = { images: { ippan: [] }, explanations: { ippan: {} } };
let selectedImages = [];
let currentIndex = 0;

const startBtn = document.getElementById('start-btn');
const subjectSelect = document.getElementById('subject-select');
const folderInput = document.getElementById('folder-input');
const updateDataBtn = document.getElementById('update-data-btn');
const dataStatusText = document.getElementById('data-status-text');
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
    const count = appData.images.ippan.length;
    dataStatusText.textContent = `保存済みデータを使用中（一般知識: 画像 ${count}枚）`;
  } else if (typeof PRELOADED_DATA !== 'undefined') {
    appData = PRELOADED_DATA;
    const count = appData.images.ippan.length;
    dataStatusText.textContent = `プリロード済みデータを使用中（一般知識: 画像 ${count}枚）`;
  } else {
    dataStatusText.textContent = 'データが読み込まれていません。';
  }
}

updateDataBtn.addEventListener('click', () => {
  folderInput.click();
});

folderInput.addEventListener('change', async (e) => {
  const files = e.target.files;
  if (files.length === 0) return;

  dataStatusText.textContent = 'データをスキャン中...';
  
  appData = {
    images: { ippan: [], senmon: [], jitsugi1: [], jitsugi2: [] },
    explanations: { ippan: {} }
  };

  const mdRegex = /(^|\n)(#\s*問(\d+)[:：]?\s*.*?)(?=\n#\s*問|$)/igs;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const path = file.webkitRelativePath; 
    
    if (path.includes('/img/ippan/') && /\.(png|jpg|jpeg)$/i.test(file.name)) {
      appData.images.ippan.push(file.name);
    }
    
    if (path.includes('/kaisetu/ippan/') && file.name.endsWith('.md')) {
      const year = file.name.split('.')[0].trim();
      const text = await file.text();
      const matches = [...text.matchAll(mdRegex)];
      
      if (!appData.explanations.ippan[year]) {
        appData.explanations.ippan[year] = {};
      }
      
      matches.forEach(match => {
        const fullText = match[2].trim();
        const qNum = match[3].trim();
        appData.explanations.ippan[year][qNum] = fullText;
      });
    }
  }

  try {
    localStorage.setItem('kakomonData', JSON.stringify(appData));
    loadDataFromStorage();
    alert('データの読み込みと保存が完了しました！');
  } catch (error) {
    console.error(error);
    alert('保存に失敗しました。');
  }
});

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
    // 採点用データ（オブジェクト）か以前の形式（テキスト）かチェック
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
