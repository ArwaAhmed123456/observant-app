import pypdf
import re

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

red_pages = []

for idx, page in enumerate(reader.pages):
    page_num = idx + 1
    contents = page.get_contents()
    if contents is None:
        continue
    if isinstance(contents, list):
        stream_data = b"".join([c.get_data() for c in contents])
    else:
        stream_data = contents.get_data()
    decoded = stream_data.decode('latin1', errors='ignore')
    
    # Check for red rg (e.g. 1 0 0 rg or 1.000000 0.000000 0.000000 rg or [0.8-1] 0 0 rg)
    # Also check what text follows the red operator
    red_matches = list(re.finditer(r'(?:1(?:\.0+)?\s+0(?:\.0+)?\s+0(?:\.0+)?\s+rg)', decoded))
    if red_matches:
        tokens = []
        for match in red_matches:
            # Look at the text following this red match until next color change or end
            sub = decoded[match.end():match.end() + 200]
            # extract text in parenthesis (Tj or TJ)
            tjs = re.findall(r'\((.*?)\)\s*Tj', sub)
            tokens.extend(tjs)
        # also get date header from page text
        page_text = page.extract_text()
        date_match = re.search(r'Start Date:\s*([0-9/]+)', page_text)
        start_date = date_match.group(1) if date_match else "unknown"
        red_pages.append({
            'page': page_num,
            'startDate': start_date,
            'tokens': tokens
        })

print(f"Total pages with red: {len(red_pages)}")
for rp in red_pages:
    print(f"Page {rp['page']} ({rp['startDate']}): {rp['tokens']}")
