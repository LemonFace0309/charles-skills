---
type: regex
pattern: '^[\s>*_-]*character[*_]*\s*:[^\n]{0,80}\b(clean|modern|sleek|minimal|premium)\b'
flags: im
match: not_contains
target: last_message
---
