import pypdf
import re

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

red_occurrences = []

for idx, page in enumerate(reader.pages):
    page_num = idx + 1
    contents = page.get_contents()
    if contents is None:
        continue
    stream_data = b"".join([c.get_data() for c in contents]) if isinstance(contents, list) else contents.get_data()
    decoded = stream_data.decode('latin1', errors='ignore')

    # find all positions of red
    matches = list(re.finditer(r'(?:1(?:\.0+)?\s+0(?:\.0+)?\s+0(?:\.0+)?\s+rg)', decoded))
    # Note: On odd pages, the first match at ~1700-1800 is the header word "RED"
    for m in matches:
        pos = m.start()
        # extract context
        ctx = decoded[max(0, pos - 100):min(len(decoded), pos + 250)]
        # If this is the header "RED ink" text, skip
        if 'RED' in ctx or 'ink' in ctx or '<0035>6<0028>-10<0027>12' in ctx:
            # Let's check what this glyph sequence is: <0035><0028><0027> is R-E-D!
            continue
        
        # Get start date of page
        page_text = page.extract_text()
        date_match = re.search(r'Start Date:\s*([0-9/]+)', page_text)
        start_date = date_match.group(1) if date_match else f"page {page_num}"
        
        red_occurrences.append((page_num, start_date, ctx))

print(f"Total non-header red occurrences: {len(red_occurrences)}")
for p, d, c in red_occurrences:
    print(f"\n--- Page {p} ({d}) ---")
    print(c[:200])
