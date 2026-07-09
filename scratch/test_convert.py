import os
import re

mogi_dir = "mogi"

def parse_table_and_convert(table_text):
    lines = [line.strip() for line in table_text.strip().split('\n') if line.strip()]
    if len(lines) < 3:
        return None
        
    # ヘッダーをパースして各列のラベル（(a), (b)など）を取得
    header_cols = [col.strip() for col in lines[0].split('|')[1:-1]]
    
    # 仕切り行の確認
    if not re.match(r'^[\s|:-]+$', lines[1]):
        return None
        
    # header_colsの2番目以降が (a), (b), (c) などの選択肢ラベルか確認
    labels = []
    for col in header_cols[1:]:
        cleaned = col.replace('*', '').strip()
        if re.match(r'^\([a-d]\)$', cleaned) or cleaned in ['a', 'b', 'c', 'd']:
            labels.append(cleaned)
        elif cleaned == '':
            # 列ラベルが空の場合はスキップ（列数合わせのダミーなど）
            continue
        else:
            return None # 選択肢テーブルではない
            
    if not labels:
        return None
        
    # 各行（選択肢）の処理
    converted_lines = []
    for line in lines[2:]:
        cols = [col.strip() for col in line.split('|')[1:-1]]
        if not cols:
            continue
        num_raw = cols[0].replace('*', '').strip()
        
        # 丸数字を通常の数字に変換する辞書
        circle_nums = {'①': '1', '②': '2', '③': '3', '④': '4', '⑤': '5', '⑥': '6'}
        num_clean = circle_nums.get(num_raw, num_raw.rstrip('.'))
        
        # 選択肢の各正誤値を結合
        choice_parts = []
        # 列のテキストが「すべて正しい」などを含む特別な行かチェック
        is_special = False
        special_text = ""
        for cell in cols[1:]:
            c_clean = cell.replace('*', '').strip()
            if any(kw in c_clean for kw in ['すべて', 'のみ', '正しい', '誤り']):
                # 正誤の記号単体ではない文章の場合（例：「すべて正しい」や「(a)のみ誤り」など）
                # ただし「正」や「誤」そのものは除外
                if c_clean not in ['正', '誤', '']:
                    is_special = True
                    special_text = c_clean
                    break
        
        if is_special:
            choice_str = special_text
        else:
            for i, val in enumerate(cols[1:]):
                if i < len(labels):
                    val_clean = val.replace('*', '').strip()
                    if val_clean:
                        choice_parts.append(f"{labels[i]}{val_clean}")
            choice_str = " ".join(choice_parts)
            
        converted_lines.append(f"{num_clean}. {choice_str}")
        
    return "\n".join(converted_lines)

# 動作テスト用の正規表現でテーブルを切り出す
table_pattern = re.compile(r'((?:\|[^\n]*\|\n?)+)', re.MULTILINE)

found_count = 0
for root, dirs, files in os.walk(mogi_dir):
    for file in files:
        if file.endswith('.md') and '問題用紙' in file:
            path = os.path.join(root, file)
            with open(path, 'r', encoding='utf-8') as f:
                content = f.read()
                
            matches = table_pattern.findall(content)
            for m in matches:
                converted = parse_table_and_convert(m)
                if converted:
                    found_count += 1
                    if found_count <= 5: # 最初の5個だけ出力
                        print(f"File: {path}")
                        print("Original:")
                        print(m.strip())
                        print("Converted:")
                        print(converted)
                        print("-" * 40)

print(f"Total tables found: {found_count}")
