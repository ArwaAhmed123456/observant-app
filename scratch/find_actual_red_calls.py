import pypdf
import re

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

actual_red_calls = []

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
    
    # Parse operations or find color changes
    # Look for (1 0 0 rg or 1.000000 0.000000 0.000000 rg)
    # Then see what text follows until 0 0 0 rg
    parts = re.split(r'(?:1(?:\.0+)?\s+0(?:\.0+)?\s+0(?:\.0+)?\s+rg)', decoded)
    if len(parts) > 1:
        for p in parts[1:]:
            # take text up to next rg
            chunk = re.split(r'(?:\d(?:\.0+)?\s+\d(?:\.0+)?\s+\d(?:\.0+)?\s+rg)', p)[0]
            # extract string literals in () or []
            strings = re.findall(r'\((.*?)\)', chunk)
            for s in strings:
                clean = s.strip()
                if clean and clean != 'RED':
                    actual_red_calls.append({
                        'page': page_num,
                        'text': clean,
                    })

print(f"Actual red calls found: {len(actual_red_calls)}")
for r in actual_red_calls:
    print(r)
