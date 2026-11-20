import pypdf, re

pdf_path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794905015775_a88d1656.pdf'
reader = pypdf.PdfReader(pdf_path)

for w in range(44):
    p1 = reader.pages[w*2]
    p2 = reader.pages[w*2 + 1]
    
    t1 = p1.extract_text()
    t2 = p2.extract_text()
    
    # count TOTMOSLOW / TOTMONSLOW in p1 and p2
    tot1 = len(re.findall(r'TOTMO[SN]LOW', t1, re.I))
    tot2 = len(re.findall(r'TOTMO[SN]LOW', t2, re.I))
    
    # Check if page 2 has shifts before first TOTMOSLOW
    p2_first_tot = re.search(r'TOTMO[SN]LOW', t2, re.I)
    has_leading_shifts_p2 = False
    if p2_first_tot:
        before_tot = t2[:p2_first_tot.start()]
        if 'Night' in before_tot or 'Day' in before_tot:
            has_leading_shifts_p2 = True
            
    print(f'Week {w+1:2d}: p1 markers={tot1}, p2 markers={tot2}, total={tot1+tot2} | P2 leading shifts: {has_leading_shifts_p2}')
