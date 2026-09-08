"""制作检查：真实动画与渲染画面；动作合理性留给用户统一审阅。"""
import argparse
import importlib
import json
from datetime import datetime, timezone
from PIL import Image
from specs import SPECS, ROOT, CATALOG

encoder = importlib.import_module('export')


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--reviewed', help='登记已查看渲染画面，不代表用户确认动作姿势；逗号分隔序号')
    parser.add_argument('--partial', action='store_true', help='生产中只核对当前成品，不作为整库通过')
    args = parser.parse_args()
    reviewed = set(map(int, args.reviewed.split(','))) if args.reviewed else set()
    assert reviewed <= set(range(1, 81))
    assert len({s['id'] for s in SPECS}) == len(SPECS) == len(CATALOG) == 80
    assert [s['id'] for s in SPECS] == [e['id'] for e in CATALOG]
    source = ROOT.parent / 'muscle-preview/refined-curl'
    source_manifest = json.loads((source / 'source/manifest.json').read_text(encoding='utf-8'))
    for entry in source_manifest['files']:
        assert encoder.sha(source / entry['file']) == entry['sha256'], entry['file']
    records, missing = [], []
    for spec in SPECS:
        folder = ROOT / 'output' / spec['slug']
        report = folder / 'validation.json'
        if not report.exists():
            missing.append(spec['index'])
            continue
        record = json.loads(report.read_text(encoding='utf-8'))
        assert record['id'] == spec['id'] and record['name'] == spec['name']
        assert record.get('styleRevision') == 2 or record['status'] == 'user_approved_reference'
        for kind, size in [('animation', (768, 896)), ('poster', (768, 896)), ('thumb', (160, 186))]:
            file = folder / f'{kind}.webp'
            assert encoder.sha(file) == record[kind]['sha256'], file
            assert file.stat().st_size == record[kind]['bytes'], file
            with Image.open(file) as im:
                assert im.size == size, (file, im.size)
                assert im.n_frames == (72 if kind == 'animation' else 1), file
                if kind == 'animation':
                    assert im.info.get('loop') == 0
                    duration = 0
                    for index in range(72):
                        im.seek(index)
                        im.load()
                        duration += im.info['duration']
                    assert duration == 3000, file
        assert record['animation']['uniqueFrames'] >= 60
        assert record['motion']['projectionMaxM'] < 1e-4
        assert record['motion']['actualJointErrorM'] < 1e-5
        assert record['motion']['loopJointErrorM'] < 1e-5
        assert (folder / 'keyframes.jpg').is_file()
        if spec['index'] in reviewed:
            record['status'] = 'user_approved_reference' if spec['index'] == 53 else 'render_visual_checked'
            record['visualReview'] = {
                'animationSha256': record['animation']['sha256'],
                'keyframesSha256': encoder.sha(folder / 'keyframes.jpg'),
                'scope': 'render appearance only; joint orientation and exercise form require user review',
                'checks': ['body_and_equipment_rendered', 'continuous_anatomical_style',
                           'highlight_visible', 'keyframes_available'],
            }
            record['userReview'] = 'pending'
            report.write_text(json.dumps(record, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        records.append(record)
    assert len({r['animation']['sha256'] for r in records}) == len(records), '重复动画不能计作多个动作'
    if not args.partial:
        assert not missing, ('缺少成品', missing)
        assert all(r['status'] in ['render_visual_checked', 'user_approved_reference'] for r in records), '仍有未检查渲染画面的成品'
        for record in records:
            if record['status'] != 'user_approved_reference':
                assert record['visualReview']['animationSha256'] == record['animation']['sha256']
    result = {
        'complete': not args.partial and len(records) == 80,
        'expected': 80, 'verified': len(records), 'missing': missing,
        'renderVisuallyChecked': sum(r['status'] in ['render_visual_checked', 'user_approved_reference'] for r in records),
        'poseAcceptance': 'pending_user_review', 'integrated': encoder.inventory()['integrated'],
        'animationBytes': sum(r['animation']['bytes'] for r in records),
        'posterBytes': sum(r['poster']['bytes'] for r in records),
        'thumbnailBytes': sum(r['thumb']['bytes'] for r in records),
        'uniqueAnimations': len({r['animation']['sha256'] for r in records}),
        'sourceManifestSha256': encoder.sha(source / 'source/manifest.json'),
        'sourceRevision': source_manifest['upstream_commit'],
        'generatorSources': {name: encoder.sha(ROOT / name) for name in
                             ['specs.py', 'anatomy.py', 'motion.py', 'equipment.py', 'produce.py', 'export.py']},
        'checkedAt': datetime.now(timezone.utc).isoformat(),
    }
    target = ROOT / ('cache/partial-validation.json' if args.partial else 'production-validation.json')
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    encoder.inventory()
    print(json.dumps(result, ensure_ascii=False))


if __name__ == '__main__':
    main()
