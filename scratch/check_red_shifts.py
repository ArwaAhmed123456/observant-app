import json

path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\scratch\all_shifts.json'
with open(path, 'r') as f:
    all_shifts = json.load(f)

for s in all_shifts:
    for idx, call in enumerate(s['tokens']):
        if call in ['0613', '0511', '0412', '0315', '2312']:
            print(f"Date {s['shiftDate']} | Officer {s['officerName']} | Shift {s['shiftType']} | Slot {idx} | Time {call}")
