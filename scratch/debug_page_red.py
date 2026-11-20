import pypdf

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

for p in [20, 54, 81]:
    page = reader.pages[p - 1]
    contents = page.get_contents()
    stream_data = b"".join([c.get_data() for c in contents]) if isinstance(contents, list) else contents.get_data()
    decoded = stream_data.decode('latin1', errors='ignore')
    print(f"--- Page {p} ---")
    lines = [l for l in decoded.splitlines() if 'rg' in l or '0613' in l or '0412' in l or '0315' in l]
    print("\n".join(lines[:20]))
