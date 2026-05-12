let appData = {
  images: { ippan: [], senmon: [], jitsugi1: [], jitsugi2: [] },
  explanations: { ippan: {} }
};

let selectedImages = [];
let currentIndex = 0;

const startBtn = document.getElementById('start-btn');
const subjectSelect = document.getElementById('subject-select');
const viewer = document.getElementById('viewer');
const examImg = document.getElementById('exam-img');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const statusText = document.getElementById('status-text');

// New DOM elements for data updating
const folderInput = document.getElementById('folder-input');
const updateDataBtn = document.getElementById('update-data-btn');
const dataStatusText = document.getElementById('data-status-text');

function loadDataFromStorage() {
  const storedData = localStorage.getItem('kakomonData');
  if (storedData) {
    appData = JSON.parse(storedData);
    const count = appData.images.ippan.length;
    dataStatusText.textContent = `データ読込済（一般知識: 画像 ${count}枚）`;
  } else {
    dataStatusText.textContent = 'データが読み込まれていません。「読み込む」ボタンを押してください。';
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
    const path = file.webkitRelativePath; // e.g., 過去問/img/ippan/56_01.png
    
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
    alert('データの読み込みと保存が完了しました！\n次回からは自動で読み込まれます。');
  } catch (error) {
    console.error(error);
    alert('保存に失敗しました。');
    dataStatusText.textContent = '保存エラー';
  }
});

// Init on load
loadDataFromStorage();

function getGroup(filename) {
  // Remove extension, trim, and get last 2 digits
  const nameWithoutExt = filename.split('.')[0].trim();
  // Handle case with extra space like "59_ 02"
  const cleaned = nameWithoutExt.replace(/\s+/g, '');
  return cleaned.slice(-2);
}

function generateExam() {
  const subject = subjectSelect.value;
  if (subject !== 'ippan') {
    alert('現在は「一般知識」のみ対応しています。');
    return;
  }

  // Group images by 01-15
  const groups = {};
  for (let i = 1; i <= 15; i++) {
    const key = i.toString().padStart(2, '0');
    groups[key] = [];
  }

  const availableImages = appData.images[subject];
  if (!availableImages || availableImages.length === 0) {
    alert('画像データがありません。「データフォルダを読み込む / 更新」ボタンからフォルダを読み込んでください。');
    return;
  }

  availableImages.forEach(img => {
    const groupKey = getGroup(img);
    if (groups[groupKey]) {
      groups[groupKey].push(img);
    }
  });

  // Randomly pick one from each group
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

let kaisetuCache = {};

const toggleExplanationBtn = document.getElementById('toggle-explanation-btn');
const explanationContent = document.getElementById('explanation-content');

function getFileInfo(path) {
  // Extract XX and YY from path like "img/ippan/56_01.png"
  const filename = path.split('/').pop();
  const nameWithoutExt = filename.split('.')[0].trim();
  const cleaned = nameWithoutExt.replace(/\s+/g, '');
  const parts = cleaned.split('_');
  
  if (parts.length < 2) {
    // Fallback if underscore is missing
    return { year: cleaned.slice(0, 2), question: parseInt(cleaned.slice(-2)) };
  }
  
  return { year: parts[0], question: parseInt(parts[1]) };
}

async function fetchExplanation(year, questionNum) {
  try {
    if (appData.explanations.ippan[year]) {
      const qNumStr = questionNum.toString();
      const text = appData.explanations.ippan[year][qNumStr];
      if (text) {
        return text;
      }
    }
    return "この問題の解説は見つかりませんでした。";
  } catch (error) {
    console.error(error);
    return "解説の読み込み中にエラーが発生しました。";
  }
}

async function updateViewer() {
  if (selectedImages.length === 0) return;
  
  // Reset explanation view
  explanationContent.style.display = 'none';
  toggleExplanationBtn.textContent = '解説を見る';
  explanationContent.innerHTML = '';

  examImg.style.opacity = 0;
  
  const currentPath = selectedImages[currentIndex];
  const { year, question } = getFileInfo(currentPath);

  // Load explanation in background
  const explanation = await fetchExplanation(year, question);
  
  // Pre-process GitHub alerts
  let mdText = explanation.replace(/> \[!(\w+)\]\n((?:> .*\n?)+)/gim, (match, type, content) => {
    let cleanContent = content.replace(/^> /gim, '');
    return `<div class="alert ${type}">\n\n${cleanContent}\n\n</div>`;
  });

  // Render markdown
  explanationContent.innerHTML = marked.parse(mdText);

  // Render math formulas
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

toggleExplanationBtn.addEventListener('click', () => {
  if (explanationContent.style.display === 'none' || explanationContent.style.display === '') {
    explanationContent.style.display = 'block';
    toggleExplanationBtn.textContent = '解説を隠す';
    explanationContent.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  } else {
    explanationContent.style.display = 'none';
    toggleExplanationBtn.textContent = '解説を見る';
  }
});

function next() {
  currentIndex = (currentIndex + 1) % selectedImages.length;
  updateViewer();
}

function prev() {
  currentIndex = (currentIndex - 1 + selectedImages.length) % selectedImages.length;
  updateViewer();
}

startBtn.addEventListener('click', generateExam);
nextBtn.addEventListener('click', next);
prevBtn.addEventListener('click', prev);
