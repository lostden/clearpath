"""Validate the pre-recording package, not actual footage or phone acceptance."""
from collections import Counter
from pathlib import Path
import csv
import hashlib
import json
import re
import subprocess
import xml.etree.ElementTree as ET
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
REPO = ROOT.parents[1]
expected = [
    '01_FINAL_FEATURE_SELECTION.md', '02_DEMO_SETUP.md',
    '03_SHOT_BY_SHOT_STORYBOARD.md', '04_FINAL_TWO_PERSON_SCRIPT.md',
    '05_IPHONE_RECORDING_CHECKLIST.md', '06_MAC_CODE_RECORDING.md',
    '07_TECHNICAL_EXPLANATION.md', '08_EDITING_TIMELINE.md',
    '09_SUBMISSION_CHECKLIST.md', '10_VIDEO_READINESS_REPORT.md',
]
for name in expected:
    assert (ROOT / name).stat().st_size > 500, name
plan = json.loads((ROOT / 'production_plan.json').read_text())
scenes = plan['scenes']
assert len(scenes) == 10 and scenes[0]['start'] == 0 and scenes[-1]['end'] == 165
for index, scene in enumerate(scenes):
    assert scene['id'] == index + 1 and scene['end'] > scene['start']
    if index:
        assert scene['start'] == scenes[index - 1]['end']
spoken = [line for scene in scenes for line in scene['lines']]
expected_text = ' '.join(line['text'] for line in spoken)
script = (ROOT / '04_FINAL_TWO_PERSON_SCRIPT.md').read_text()
actual_quotes = re.findall(r'^> (.+)$', script, re.M)
assert actual_quotes == [line['text'] for line in spoken]
words = Counter()
for line in spoken:
    words[line['speaker']] += len(line['text'].split())
assert 280 <= sum(words.values()) <= 330 and words == {'Manas': 146, 'Shiven': 146}
story = (ROOT / '03_SHOT_BY_SHOT_STORYBOARD.md').read_text()
for line in spoken:
    assert line['text'] in story

def milliseconds(value):
    h, m, s, ms = map(int, re.split(r'[:,]', value))
    return h * 3600000 + m * 60000 + s * 1000 + ms

cues = (ROOT / 'draft_subtitles.srt').read_text().strip().split('\n\n')
caption_text, previous_end, reading_rates = [], 0, []
for number, cue in enumerate(cues, 1):
    lines = cue.splitlines()
    assert lines[0] == str(number)
    start, end = map(milliseconds, lines[1].split(' --> '))
    assert 0 <= previous_end <= start < end <= 165000
    assert 1 <= len(lines[2:]) <= 2 and all(len(line) <= 42 for line in lines[2:])
    caption_text.extend(lines[2:])
    reading_rates.append(sum(len(line) for line in lines[2:]) / ((end - start) / 1000))
    previous_end = end
assert ' '.join(' '.join(caption_text).split()) == ' '.join(expected_text.split())
assert max(reading_rates) <= 20
rows = list(csv.DictReader((ROOT / 'timeline.csv').open()))
assert int(rows[0]['start_seconds']) == 0 and int(rows[-1]['end_seconds']) == 165
for index, row in enumerate(rows):
    assert int(row['end_seconds']) > int(row['start_seconds'])
    if index:
        assert row['start_seconds'] == rows[index - 1]['end_seconds']
app_seconds = sum(int(row['end_seconds']) - int(row['start_seconds']) for row in rows if row['picture'].startswith('A'))
assert app_seconds == 116 and app_seconds > 165 / 2
manifest = json.loads((ROOT / 'assets/asset_manifest.json').read_text())
assert len(manifest['assets']) == 11
for asset in manifest['assets']:
    png = ROOT / 'assets' / (asset['name'] + '.png')
    with Image.open(png) as image:
        assert image.size == (asset['width'], asset['height'])
        image.verify()
    svg = ROOT / 'assets' / (asset['name'] + '.svg')
    ET.parse(svg)
    assert 'data:font/ttf;base64,' in svg.read_text()
links = 0
for document in ROOT.rglob('*.md'):
    text = document.read_text()
    assert not re.search(r'\b(TODO|TBD)\b|\[INSERT', text), str(document)
    for target in re.findall(r'\]\(([^\n)]+)\)', text):
        if re.match(r'https?://|mailto:|#', target):
            continue
        target = target.strip('<>').split('#')[0]
        target = re.sub(r':\d+$', '', target)
        destination = Path(target) if target.startswith('/') else document.parent / target
        # The report is the output of this verifier and can be absent before the first run.
        if destination.resolve() == (ROOT / 'verification_report.json').resolve():
            continue
        assert destination.exists(), (str(document), target)
        links += 1
anchors = {
    'src/student/priority.ts': {101: 'export function prioritizeWarnings', 129: 'const ordered = currentAlerts'},
    'src/domain/alerts.ts': {6: 'export function hasPlausibleIssuance', 79: 'export function currentAlerts'},
    'tests/alerts.test.ts': {75: 'test.each'},
    'src/app/index.tsx': {38: 'const ordered = useMemo'},
}
for filename, targets in anchors.items():
    lines = (REPO / filename).read_text().splitlines()
    for line, text in targets.items():
        assert text in lines[line - 1], (filename, line)
comparison = subprocess.run(['git', 'diff', '--exit-code', plan['applicationCommit'], '--', 'src', 'tests', 'server', 'package.json', 'package-lock.json', 'app.json', 'app.config.ts'], cwd=REPO, capture_output=True, text=True)
assert comparison.returncode == 0 and not comparison.stdout
output = {
    'date': '2026-10-21', 'scope': 'Pre-recording documents, scene plan, draft captions and static assets; not film/device acceptance',
    'requiredDocuments': len(expected), 'plannedSeconds': 165, 'words': sum(words.values()), 'speakerWords': dict(words),
    'scenes': len(scenes), 'timelineCuts': len(rows), 'actualAppFootagePlannedSeconds': app_seconds,
    'actualAppFootagePlannedPercent': round(app_seconds / 165 * 100, 1),
    'srtCues': len(cues), 'srtLastEndMs': previous_end, 'srtMaxCharactersPerSecond': round(max(reading_rates), 2),
    'localLinksChecked': links, 'assetPairsPngSvg': len(manifest['assets']), 'sourceAnchorsChecked': sum(len(value) for value in anchors.values()),
    'acceptedApplicationUnchanged': True, 'narrationStoryboardSrtMatch': True,
    'staticVisualReview': 'Main-card contact sheet, full architecture and label preview inspected; no product screenshots or footage generated',
    'actualRehearsalDuration': None, 'actualFinalFilmDuration': None, 'newPhysicalPhoneAcceptance': False,
    'sourceFiles': {name: hashlib.sha256((ROOT / name).read_bytes()).hexdigest() for name in ['production_plan.json', 'draft_subtitles.srt', 'timeline.csv']},
}
(ROOT / 'verification_report.json').write_text(json.dumps(output, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(output, ensure_ascii=False, indent=2))
