import os
import json
import re

data = {
    "images": {"ippan": []},
    "explanations": {"ippan": {}},
    "genres": {}
}

# Process images
img_dir = "img/ippan"
if os.path.exists(img_dir):
    images = [f for f in os.listdir(img_dir) if f.lower().endswith(('.png', '.jpg', '.jpeg'))]
    data["images"]["ippan"] = sorted(images)

# Process explanations
kaisetu_dir = "kaisetu/ippan"
if os.path.exists(kaisetu_dir):
    for root, _, files in os.walk(kaisetu_dir):
        for file in files:
            if file.endswith('.md'):
                match = re.search(r'(\d+)\.md', file)
                if match:
                    year = match.group(1)
                    
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    parts = re.split(r'\n(?=# 問\d+)', '\n' + content)
                    
                    if year not in data["explanations"]["ippan"]:
                        data["explanations"]["ippan"][year] = {}
                    
                    for part in parts:
                        q_match = re.search(r'^# 問(\d+)', part.strip())
                        if q_match:
                            question = str(int(q_match.group(1)))
                            data["explanations"]["ippan"][year][question] = part.strip()

# Process genres
if os.path.exists('genres.json'):
    with open('genres.json', 'r', encoding='utf-8') as f:
        data["genres"] = json.load(f)

# Write to data.js
with open('data.js', 'w', encoding='utf-8') as f:
    f.write(f"const PRELOADED_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

print("data.js generated successfully!")
