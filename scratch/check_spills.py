import pypdf, re

pdf_path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794905015775_a88d1656.pdf'
reader = pypdf.PdfReader(pdf_path)

weeks_with_p2_leading = []

for w in range(44):
    p1 = reader.pages[w*2]
    p2 = reader.pages[w*2 + 1]
    
    t2 = p2.extract_text()
    m = re.search(r'TOTMO[SN]LOW', t2, re.I)
    leading = t2[:m.start()] if m else ''
    guard_matches = re.findall(r'(Abdullah\s+Malik|Malik\s+Abdullah|Waqar\s+Javaid|Waqar\s+Javed|Waqar\s+Javid|Asad\s+Iqbal|Asad\s+Iqba|Rehman\s+Saleem|Ukasha\s+Ayaz|Shah\s+Fahad|Jamal\s+Faisal\s+Sharif|Faisal\s+Shariff|Faisal\s+Sharif)', leading, re.I)
    if guard_matches:
        weeks_with_p2_leading.append((w+1, guard_matches))

print(f'Total weeks with shifts spilling onto Page 2: {len(weeks_with_p2_leading)}')
for w, guards in weeks_with_p2_leading:
    print(f'Week {w:2d}: {guards}')
