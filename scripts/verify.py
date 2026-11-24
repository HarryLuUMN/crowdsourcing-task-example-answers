"""Verify the answer files using an installed CrowdCode checkout's real runners."""
import argparse
from datetime import datetime, timezone
import hashlib
import json
from pathlib import Path
import subprocess
import sys


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--platform', type=Path, default=Path(__file__).resolve().parents[2] / 'crowdsource-code-platform')
    parser.add_argument('--report', type=Path, default=Path('validation-report.json'))
    args = parser.parse_args()
    platform = args.platform.resolve()
    repo = Path(__file__).resolve().parents[1]
    sys.path.insert(0, str(platform))
    from server import evaluate_source
    from study_tasks import DSL_TASK_CATALOG

    tasks = json.loads((repo / 'tasks.json').read_text())
    expected = {task['id']: dsl for dsl, group in DSL_TASK_CATALOG.items() for task in group['tasks']}
    if len(tasks) != 12 or len({task['task_id'] for task in tasks}) != 12 or {task['task_id']: task['dsl'] for task in tasks} != expected:
        raise SystemExit('The manifest must match all 12 tasks in the current platform catalog.')
    results = []
    for task in tasks:
        path = repo / task['file']
        source = path.read_text()
        status, result = evaluate_source(source, task['task_id'])
        check = result.get('check', {})
        passed = status == 200 and result.get('ok') is True and check.get('passed') is True and check.get('total_count', 0) > 0
        item = {**task, 'sha256': hashlib.sha256(path.read_bytes()).hexdigest(), 'http_status': status, 'compiled': result.get('ok') is True, 'passed': passed, 'passed_count': check.get('passed_count', 0), 'total_count': check.get('total_count', 0), 'checks': check.get('tests', [])}
        if result.get('error'):
            item['error'] = result['error']
        results.append(item)
        print(f"{'PASS' if passed else 'FAIL'} {task['file']} ({item['passed_count']}/{item['total_count']} checks)", flush=True)
    commit = subprocess.check_output(['git', '-C', str(platform), 'rev-parse', 'HEAD'], text=True).strip()
    dirty = subprocess.check_output(['git', '-C', str(platform), 'status', '--porcelain', '--untracked-files=no'], text=True).strip()
    report = {'verified_at_utc': datetime.now(timezone.utc).isoformat(), 'platform_repository': 'https://github.com/HarryLuUMN/crowdsource-coding-platform', 'platform_commit': commit, 'platform_tracked_changes': bool(dirty), 'passed': all(item['passed'] for item in results), 'task_count': len(results), 'passed_tasks': sum(item['passed'] for item in results), 'results': results}
    args.report.write_text(json.dumps(report, indent=2) + '\n')
    print(f"{report['passed_tasks']}/{len(results)} answers passed against platform {commit}.")
    return 0 if report['passed'] else 1


if __name__ == '__main__':
    raise SystemExit(main())
