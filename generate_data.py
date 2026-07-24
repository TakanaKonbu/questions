import os
import json
import re

data = {
    "images": {"ippan": [], "senmon": []},
    "explanations": {"ippan": {}, "senmon": {}},
    "questions": {},
    "genres": {}
}

# Process images and explanations for both subjects (Past Exams)
for subject in ["ippan", "senmon"]:
    # Process images
    img_dir = f"img/{subject}"
    if os.path.exists(img_dir):
        images = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
        data["images"][subject] = sorted(images)
    
    # Process explanations
    kaisetu_dir = f"kaisetu/{subject}"
    if os.path.exists(kaisetu_dir):
        for root, _, files in os.walk(kaisetu_dir):
            for file in files:
                if file.endswith('.md'):
                    match = re.search(r'(\d+)\.md', file)
                    if match:
                        year = match.group(1)
                        
                        with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                            content = f.read()
                        
                        parts = re.split(r'\n(?=#+\s*問\d+)', '\n' + content)
                        
                        if year not in data["explanations"][subject]:
                            data["explanations"][subject][year] = {}
                        
                        for part in parts:
                            q_match = re.search(r'^#+\s*問(\d+)', part.strip())
                            if q_match:
                                question = str(int(q_match.group(1)))
                                data["explanations"][subject][year][question] = part.strip()

# Process mock exams (mogi)
mogi_base = "mogi"
subjects_mogi = {
    "一般": "mogi_ippan",
    "専門": "mogi_senmon"
}

for ja_sub, en_sub in subjects_mogi.items():
    sub_dir = os.path.join(mogi_base, ja_sub, "模擬試験")
    if os.path.exists(sub_dir):
        dirs = [d for d in os.listdir(sub_dir) if os.path.isdir(os.path.join(sub_dir, d)) and not d.startswith('.')]
        for mogi_num in sorted(dirs):
            mogi_dir = os.path.join(sub_dir, mogi_num)
            
            for file in os.listdir(mogi_dir):
                if not file.endswith('.md') or file.startswith('.'):
                    continue
                
                file_path = os.path.join(mogi_dir, file)
                if "問題用紙" in file:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    parts = re.split(r'\n(?=(?:#+\s*)?【?問\d+】?)', '\n' + content)
                    if en_sub not in data["questions"]:
                        data["questions"][en_sub] = {}
                    if mogi_num not in data["questions"][en_sub]:
                        data["questions"][en_sub][mogi_num] = {}
                        
                    for part in parts:
                        q_match = re.search(r'^(?:#+\s*)?【?問(\d+)】?', part.strip())
                        if q_match:
                            question = str(int(q_match.group(1)))
                            data["questions"][en_sub][mogi_num][question] = part.strip()
                            
                elif "解答と解説" in file or "解答" in file or "解説" in file:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    parts = re.split(r'\n(?=(?:#+\s*)?【?問\d+】?)', '\n' + content)
                    if en_sub not in data["explanations"]:
                        data["explanations"][en_sub] = {}
                    if mogi_num not in data["explanations"][en_sub]:
                        data["explanations"][en_sub][mogi_num] = {}
                        
                    for part in parts:
                        q_match = re.search(r'^(?:#+\s*)?【?問(\d+)】?', part.strip())
                        if q_match:
                            question = str(int(q_match.group(1)))
                            data["explanations"][en_sub][mogi_num][question] = part.strip()

# Process genres
if os.path.exists('genres.json'):
    with open('genres.json', 'r', encoding='utf-8') as f:
        data["genres"] = json.load(f)

# Write to data.js
with open('data.js', 'w', encoding='utf-8') as f:
    f.write(f"const PRELOADED_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

print("data.js generated successfully!")
