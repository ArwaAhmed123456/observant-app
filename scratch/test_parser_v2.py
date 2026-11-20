import pypdf, re, json
from datetime import datetime, timedelta

pdf_path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794905015775_a88d1656.pdf'
reader = pypdf.PdfReader(pdf_path)

CANONICAL_NAMES = {
    'abdullah malik': 'Abdullah Malik',
    'malik abdullah': 'Abdullah Malik',
    'waqar javaid': 'Waqar Javaid',
    'waqar javed': 'Waqar Javaid',
    'waqar javid': 'Waqar Javaid',
    'asad iqbal': 'Asad Iqbal',
    'asad iqba': 'Asad Iqbal',
    'rehman saleem': 'Rehman Saleem',
    'ukasha ayaz': 'Ukasha Ayaz',
    'shah fahad': 'Shah Fahad',
    'jamal faisal sharif': 'Jamal Faisal Sharif',
    'faisal shariff': 'Jamal Faisal Sharif',
    'faisal sharif': 'Jamal Faisal Sharif',
}

GUARD_PATTERN = re.compile(
    r'(Abdullah\s+Malik|Malik\s+Abdullah|Waqar\s+Javaid|Waqar\s+Javed|Waqar\s+Javid|'
    r'Asad\s+Iqbal|Asad\s+Iqba|Rehman\s+Saleem|Ukasha\s+Ayaz|Shah\s+Fahad|'
    r'Jamal\s+Faisal\s+Sharif|Faisal\s+Shariff|Faisal\s+Sharif)\s+(Day|Night)',
    re.IGNORECASE
)

HEADER_PATTERNS = [
    '0700 0800 0900 1000 1100 1200 1300 1400 1500 1600 1700 1800 1900',
    '1900 2000 2100 2200 2300 0000 0100 0200 0300 0400 0500 0600 0700',
]

def get_page_lines_with_pos(page):
    frags = []
    page.extract_text(visitor_text=lambda t, cm, tm, fd, fs: frags.append((round(tm[4], 1), round(tm[5], 1), t.strip())) if t.strip() else None)
    
    clusters = []
    for f in sorted(frags, key=lambda f: f[1]):
        if not clusters or abs(clusters[-1]['y'] - f[1]) > 4:
            clusters.append({'y': f[1], 'items': [f]})
        else:
            clusters[-1]['items'].append(f)
            
    res = []
    for c in clusters:
        c['items'].sort(key=lambda f: f[0])
        combined_text = ' '.join(f[2] for f in c['items'])
        min_x = c['items'][0][0]
        res.append((min_x, c['y'], combined_text))
    return res

all_shifts = []
errors = []

for w in range(44):
    p1 = reader.pages[w*2]
    p2 = reader.pages[w*2 + 1]
    
    t1 = p1.extract_text()
    m_date = re.search(r'Start Date:\s*(\d{1,2})\s*/\s*(\d{1,2})\s*/\s*(\d{4})', t1)
    if not m_date:
        errors.append(f'Week {w+1}: could not parse start date')
        continue
    s_day, s_m, s_y = int(m_date.group(1)), int(m_date.group(2)), int(m_date.group(3))
    start_dt = datetime(s_y, s_m, s_day)
    
    l1 = get_page_lines_with_pos(p1)
    l2 = get_page_lines_with_pos(p2)
    
    m1_indices = [i for i, l in enumerate(l1) if any(k in l[2] for k in ['TOTMOSLOW', 'TOTMONSLOW', '12TOTMOSLOW'])]
    m2_indices = [i for i, l in enumerate(l2) if any(k in l[2] for k in ['TOTMOSLOW', 'TOTMONSLOW', '12TOTMOSLOW'])]
    
    p1_day_lines = []
    for idx, m_idx in enumerate(m1_indices):
        end_idx = m1_indices[idx+1] if idx+1 < len(m1_indices) else len(l1)
        p1_day_lines.append(l1[m_idx:end_idx])
        
    # In p2, find leading lines before m2_indices[0] that contain a guard
    leading_p2 = l2[:m2_indices[0]] if m2_indices else []
    # Check if there's any guard in leading_p2
    first_guard_in_p2 = -1
    for idx, (x, y, text) in enumerate(leading_p2):
        if GUARD_PATTERN.search(text):
            first_guard_in_p2 = idx
            break
            
    if first_guard_in_p2 != -1 and p1_day_lines:
        # Only take from the first guard line onwards!
        p1_day_lines[-1].extend(leading_p2[first_guard_in_p2:])
        
    p2_day_lines = []
    for idx, m_idx in enumerate(m2_indices):
        end_idx = m2_indices[idx+1] if idx+1 < len(m2_indices) else len(l2)
        p2_day_lines.append(l2[m_idx:end_idx])
        
    all_7_days = p1_day_lines + p2_day_lines
    if len(all_7_days) != 7:
        errors.append(f'Week {w+1}: expected 7 days, got {len(all_7_days)}')
        continue
        
    for day_idx, day_lines in enumerate(all_7_days):
        current_date = (start_dt + timedelta(days=day_idx)).strftime('%Y-%m-%d')
        
        guard_entries = []
        for line_idx, (x, y, text) in enumerate(day_lines):
            match = GUARD_PATTERN.search(text)
            if match:
                guard_entries.append((line_idx, match.group(1), match.group(2), text[match.end():].strip()))
                
        for g_i, (l_idx, g_name, s_type, trailing) in enumerate(guard_entries):
            next_l_idx = guard_entries[g_i+1][0] if g_i+1 < len(guard_entries) else len(day_lines)
            tokens = []
            if trailing:
                tokens.extend(trailing.split())
            for j in range(l_idx+1, next_l_idx):
                lt = day_lines[j][2]
                if any(k in lt for k in ['SOLAR', 'FARM', 'Doc No', 'DocNo', 'QBC', 'Issue Date', 'Times of check calls', 'Site Name', 'Security Officer', 'DAY/Night', 'Shift Times']):
                    continue
                # Also skip table header rows with exact sequences of 0700 0800 ... or 1900 2000 ...
                if '0700 0800 0900' in lt or '1900 2000 2100' in lt:
                    continue
                parts = lt.split()
                clean_parts = [p for p in parts if p in ['-', '--'] or re.match(r'^\d{4}$', p)]
                tokens.extend(clean_parts)
                
            clean_tokens = []
            for t in tokens:
                if t in ['-', '--']:
                    clean_tokens.append('-')
                elif re.match(r'^\d{4}$', t):
                    clean_tokens.append(t)
                    
            norm_name = CANONICAL_NAMES.get(re.sub(r'\s+', ' ', g_name).strip().lower(), g_name.strip())
            norm_type = 'Day' if s_type.lower() == 'day' else 'Night'
            
            if len(clean_tokens) != 13:
                errors.append(f'{current_date} {norm_name} {norm_type}: got {len(clean_tokens)} tokens (expected 13): {clean_tokens}')
            else:
                all_shifts.append({
                    'shiftDate': current_date,
                    'officerName': norm_name,
                    'shiftType': norm_type,
                    'tokens': clean_tokens
                })

print(f'Total shifts extracted: {len(all_shifts)}')
print(f'Errors encountered: {len(errors)}')
with open('scratch/extracted_1018_shifts.json', 'w') as f:
    json.dump(all_shifts, f, indent=2)
print('Saved to scratch/extracted_1018_shifts.json!')
