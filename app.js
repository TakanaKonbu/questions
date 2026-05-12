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

function updateViewer() {
  if (selectedImages.length === 0) return;
  
  examImg.style.opacity = 0;
  setTimeout(() => {
    examImg.src = selectedImages[currentIndex];
    examImg.style.opacity = 1;
    statusText.textContent = `${currentIndex + 1} / ${selectedImages.length}`;
  }, 200);
}

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
