import json

path = r'C:\Users\uk354\.gemini\antigravity\brain\c697be47-6b6e-4152-a27b-fe85d0937974\scratch\all_shifts.json'
with open(path, 'r') as f:
    all_shifts = json.load(f)

late_by_calc = []
for s in all_shifts:
    for idx, call in enumerate(s['tokens']):
        if call and call != '-' and len(call) == 4 and call.isdigit():
            hour = int(call[:2])
            minute = int(call[2:])
            # slot scheduled hour
            first_hour = 7 if s['shiftType'] == 'Day' else 19
            sched_hour = (first_hour + idx) % 24
            # if minute > 10, check how late
            if minute > 10:
                late_by_calc.append((s['shiftDate'], s['officerName'], s['shiftType'], idx, call))

print(f"Total calls with minute > 10: {len(late_by_calc)}")
for item in late_by_calc[:20]:
    print(item)
