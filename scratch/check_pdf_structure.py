import pypdf, re

pdf_path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794905015775_a88d1656.pdf'
reader = pypdf.PdfReader(pdf_path)
print(f'Total pages: {len(reader.pages)}')

for i in range(0, len(reader.pages), 2):
    p1 = reader.pages[i]
    p2 = reader.pages[i+1]
    t1 = p1.extract_text()
    t2 = p2.extract_text()
    
    m1 = re.search(r'Start Date:\s*([^\n\r]+)', t1)
    hdr = m1.group(0) if m1 else 'NO HEADER'
    
    # Check how many guard occurrences on p1 and p2
    guards_p1 = len(re.findall(r'(?:Day|Night)', t1))
    guards_p2 = len(re.findall(r'(?:Day|Night)', t2))
    print(f'Week {i//2 + 1} (P{i+1}-P{i+2}): {hdr:45} | p1 shifts: {guards_p1}, p2 shifts: {guards_p2}')
