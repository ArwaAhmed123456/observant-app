import pypdf
import re

reader = pypdf.PdfReader(r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\.user_uploaded\media_1794814932685_70d79e9b.pdf')

for page_num in [20, 34, 37, 53, 54, 81]:
    page = reader.pages[page_num - 1]
    text = page.extract_text()
    stream_data = b"".join([c.get_data() for c in page.get_contents()]) if isinstance(page.get_contents(), list) else page.get_contents().get_data()
    decoded = stream_data.decode('latin1', errors='ignore')
    
    # look for color operators like rg or k
    colors = re.findall(r'(\d*\.?\d+\s+\d*\.?\d+\s+\d*\.?\d+\s+rg)', decoded)
    print(f"Page {page_num}: colors found: {set(colors)}")
