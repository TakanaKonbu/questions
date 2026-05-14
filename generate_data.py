import os
import json
import re

data = {
    "images": {"ippan": []},
    "explanations": {"ippan": {}}
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
                # Extract year and question from filename, e.g., 56_01.md -> year 56, question 1
                match = re.search(r'(\d+)_0?(\d+)', file)
                if match:
                    year = match.group(1)
                    question = str(int(match.group(2))) # Remove leading zero
                    
                    with open(os.path.join(root, file), 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    if year not in data["explanations"]["ippan"]:
                        data["explanations"]["ippan"][year] = {}
                    
                    data["explanations"]["ippan"][year][question] = content

# Write to data.js
with open('data.js', 'w', encoding='utf-8') as f:
    f.write(f"const PRELOADED_DATA = {json.dumps(data, ensure_ascii=False, indent=2)};\n")

print("data.js generated successfully!")
