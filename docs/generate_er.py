#!/usr/bin/env python3
"""Генерирует docs/er_diagram.svg для StudyTrack (без внешних зависимостей)."""
from pathlib import Path
from html import escape

W, H = 1600, 1120
entities = {
    'users': {
        'x': 30, 'y': 50, 'w': 290,
        'title': 'users',
        'fields': [
            ('id', 'PK'), ('full_name', ''), ('email', 'UQ'), ('role', 'CHECK'),
            ('is_active', ''), ('created_at', ''),
        ],
    },
    'course_categories': {
        'x': 30, 'y': 390, 'w': 290,
        'title': 'course_categories',
        'fields': [
            ('id', 'PK'), ('parent_id', 'FK self'), ('title', ''), ('slug', 'UQ'),
        ],
    },
    'courses': {
        'x': 390, 'y': 120, 'w': 310,
        'title': 'courses',
        'fields': [
            ('id', 'PK'), ('category_id', 'FK'), ('teacher_id', 'FK'), ('code', 'UQ'),
            ('title', ''), ('status', 'CHECK'), ('created_at', ''),
        ],
    },
    'enrollments': {
        'x': 390, 'y': 470, 'w': 310,
        'title': 'enrollments',
        'fields': [
            ('id', 'PK'), ('course_id', 'FK'), ('student_id', 'FK'), ('status', 'CHECK'),
            ('enrolled_at', ''), ('(course, student)', 'UQ'),
        ],
    },
    'assignments': {
        'x': 760, 'y': 90, 'w': 340,
        'title': 'assignments',
        'fields': [
            ('id', 'PK'), ('course_id', 'FK'), ('title', ''), ('due_at', ''),
            ('max_score', 'CHECK > 0'), ('extra', 'JSONB'),
            ('expected_minutes', 'GEN STORED'), ('search_vector', 'GEN tsvector'),
            ('created_at', ''),
        ],
    },
    'submission_versions': {
        'x': 1170, 'y': 50, 'w': 380,
        'title': 'submission_versions',
        'fields': [
            ('id', 'PK'), ('assignment_id', 'FK'), ('student_id', 'FK'),
            ('version_no', 'CHECK > 0'), ('body', ''), ('submitted_at', ''),
            ('is_late', ''), ('(assignment, student, version)', 'UQ'),
        ],
    },
    'grades': {
        'x': 1170, 'y': 400, 'w': 380,
        'title': 'grades',
        'fields': [
            ('id', 'PK'), ('version_id', 'FK UQ'), ('graded_by', 'FK'),
            ('score', 'CHECK >= 0'), ('comment', ''), ('graded_at', ''),
        ],
    },
    'grade_history': {
        'x': 1170, 'y': 700, 'w': 380,
        'title': 'grade_history',
        'fields': [
            ('id', 'PK'), ('grade_id', 'FK'), ('version_id', 'FK'),
            ('old_score', ''), ('new_score', ''), ('action', 'CHECK'),
            ('changed_by', 'FK'), ('changed_at', ''),
        ],
    },
}

height = {}
for name, e in entities.items():
    height[name] = 42 + len(e['fields']) * 24 + 12

parts = [
    f'<svg xmlns="http://www.w3.org/2000/svg" width="{W}" height="{H}" viewBox="0 0 {W} {H}">',
    '<rect width="100%" height="100%" fill="#ffffff"/>',
    '<text x="30" y="32" font-family="Helvetica, Arial, sans-serif" font-size="20" font-weight="bold" fill="#111827">StudyTrack — ER-диаграмма (PostgreSQL)</text>',
]
# relationships: (x1,y1,x2,y2,label, dash)
rels = [
    (320, 120, 390, 190, '1:N', False),
    (320, 250, 390, 520, '1:N', True),
    (320, 450, 390, 330, '1:N', False),
    (320, 520, 320, 570, '1:N', True),
    (700, 300, 760, 250, '1:N', False),
    (700, 350, 700, 470, '1:N', False),
    (1100, 200, 1170, 150, '1:N', False),
    (320, 60, 1000, 18, '1:N student_id', True),
    (1000, 18, 1360, 18, '', True),
    (1360, 18, 1360, 50, '', True),
    (1360, 470, 1360, 400, '1:1', False),
    (1360, 630, 1360, 700, '1:N', False),
    (320, 290, 1080, 1080, '1:N', True),
    (1080, 1080, 1160, 1080, '', True),
    (1160, 1080, 1160, 560, '', True),
    (1170, 560, 1170, 560, '', True),
]
for x1, y1, x2, y2, label, dash in rels:
    dash_attr = ' stroke-dasharray="6 5"' if dash else ''
    parts.append(f'<line x1="{x1}" y1="{y1}" x2="{x2}" y2="{y2}" stroke="#64748b" stroke-width="2"{dash_attr}/>')
    if label:
        mx, my = (x1 + x2) / 2, (y1 + y2) / 2
        # подпись с белой подложкой
        width = max(36, len(label) * 7)
        parts.append(f'<rect x="{mx - width/2}" y="{my - 12}" width="{width}" height="18" fill="#ffffff" opacity="0.92"/>')
        parts.append(f'<text x="{mx}" y="{my + 2}" text-anchor="middle" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#334155">{escape(label)}</text>')

for name, e in entities.items():
    x, y, w = e['x'], e['y'], e['w']
    h = height[name]
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="#f8fafc" stroke="#1e293b" stroke-width="2"/>')
    parts.append(f'<rect x="{x}" y="{y}" width="{w}" height="38" rx="10" fill="#1e293b"/>')
    parts.append(f'<rect x="{x}" y="{y+24}" width="{w}" height="14" fill="#1e293b"/>')
    parts.append(f'<text x="{x+14}" y="{y+25}" font-family="Helvetica, Arial, sans-serif" font-size="16" font-weight="bold" fill="#ffffff">{escape(e["title"])}</text>')
    for i, (field, note) in enumerate(e['fields']):
        fy = y + 62 + i * 24
        weight = 'bold' if note.startswith(('PK', 'FK', 'UQ', 'GEN')) else 'normal'
        parts.append(f'<text x="{x+14}" y="{fy}" font-family="Helvetica, Arial, sans-serif" font-size="13" font-weight="{weight}" fill="#0f172a">{escape(field)}</text>')
        if note:
            parts.append(f'<text x="{x+w-14}" y="{fy}" text-anchor="end" font-family="Helvetica, Arial, sans-serif" font-size="11" fill="#64748b">{escape(note)}</text>')
    parts.append(f'<line x1="{x}" y1="{y+42}" x2="{x+w}" y2="{y+42}" stroke="#cbd5e1"/>')

parts.append('<text x="30" y="1090" font-family="Helvetica, Arial, sans-serif" font-size="12" fill="#64748b">PK — первичный ключ, FK — внешний ключ, UQ — UNIQUE, GEN — GENERATED STORED. Пунктир — необязательная/историческая связь.</text>')
parts.append('</svg>')

out = Path(__file__).with_name('er_diagram.svg')
out.write_text('\n'.join(parts), encoding='utf-8')
print(out)
