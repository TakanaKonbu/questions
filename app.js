const ippanImages = [
  "56_01.png", "56_02.png", "56_03.png", "56_04.png", "56_05.png", "56_06.png", "56_07.png", "56_08.png", "56_09.png", "56_10.png", "56_11.png", "56_12.png", "56_13.png", "56_14.png", "56_15.png",
  "57_01.png", "57_02.png", "57_03.png", "57_04.png", "57_05.png", "57_06.png", "57_07.png", "57_08.png", "57_09.png", "57_10.png", "57_11.png", "57_12.png", "57_13.png", "57_14.png", "57_15.png",
  "58_01.png", "58_02.png", "58_03.png", "58_04.png", "58_05.png", "58_06.png", "58_07.png", "58_08.png", "58_09.png", "58_10.png", "58_11.png", "58_12.png", "58_13.png", "58_14.png", "58_15.png",
  "59_01.PNG", "59_ 02.PNG", "59_03.PNG", "59_04.PNG", "59_05.PNG", "59_06.PNG", "59_07.PNG", "59_08.PNG", "59_09.PNG", "59_10.PNG", "59_11.PNG", "59_12.PNG", "59_13.PNG", "59_14.PNG", "59_15.PNG"
];

let selectedImages = [];
let currentIndex = 0;

const startBtn = document.getElementById('start-btn');
const subjectSelect = document.getElementById('subject-select');
const viewer = document.getElementById('viewer');
const examImg = document.getElementById('exam-img');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const statusText = document.getElementById('status-text');

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

  ippanImages.forEach(img => {
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
    // kaisetuData is loaded from kaisetu_data.js
    if (window.kaisetuData && window.kaisetuData[year]) {
      const qNumStr = questionNum.toString();
      const text = window.kaisetuData[year][qNumStr];
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
    statusText.textContent = `${currentIndex + 1} / ${selectedImages.length}`;
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
