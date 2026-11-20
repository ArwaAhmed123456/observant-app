import pypdf

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

for p in [20, 53, 54, 81]:
    page = reader.pages[p - 1]
    stream_data = b"".join([c.get_data() for c in page.get_contents()]) if isinstance(page.get_contents(), list) else page.get_contents().get_data()
    decoded = stream_data.decode('latin1', errors='ignore')
    print(f"=== PAGE {p} ===")
    for target in ['0613', '0511', '0412', '0315', '1 0 0 rg', '1.000000 0.000000 0.000000 rg']:
        idx = decoded.find(target)
        if idx != -1:
            print(f"Target '{target}' found at {idx}:")
            print(decoded[max(0, idx - 80):min(len(decoded), idx + 80)])
