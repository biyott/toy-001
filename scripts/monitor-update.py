#!/usr/bin/env python3
"""Coordinator-owned report edits. Never writes collector-owned snapshots."""
import argparse
import json
import os
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
REPORT = ROOT / '.agent-monitor/reports/coordinator.json'
parser = argparse.ArgumentParser()
parser.add_argument('action', choices=['phase', 'observe', 'agent', 'task', 'event', 'link', 'final'])
parser.add_argument('value', help='JSON object, or text for phase')
args = parser.parse_args()
report = json.loads(REPORT.read_text())
now = datetime.now(timezone.utc).isoformat()
if args.action == 'phase':
    report['phase'] = args.value
    report['events'].append(dict(id=f'phase-{now}', type='phase', message=args.value, observedAt=now, source='coordinator', kind='direct'))
else:
    value = json.loads(args.value)
    if args.action == 'observe':
        for item in value:
            agent = next((a for a in report['agents'] if a['id'] == item['agent_name']), None)
            if agent:
                agent.update(status=item['agent_status'], observedAt=now)
                agent['statusSource'] = 'collaboration.list_agents'
        report['lastRuntimeObservationAt'] = now
    elif args.action in ('agent', 'task'):
        items = report['agents' if args.action == 'agent' else 'tasks']
        existing = next((x for x in items if x['id'] == value['id']), None)
        if existing:
            existing.update(value)
        else:
            items.append(value)
    elif args.action == 'event':
        value.setdefault('id', f'event-{now}')
        value.setdefault('observedAt', now)
        value.setdefault('source', 'coordinator')
        value.setdefault('kind', 'direct')
        if not any(e['id'] == value['id'] for e in report['events']):
            report['events'].append(value)
    elif args.action == 'link':
        report['links'] = [x for x in report['links'] if x.get('label') != value.get('label')] + [value]
    elif args.action == 'final':
        report['mode'] = 'final'
        report['finalizedAt'] = now
        report.update(value)
report['observedAt'] = now
temp = REPORT.with_suffix('.tmp')
temp.write_text(json.dumps(report, ensure_ascii=False, indent=2))
os.replace(temp, REPORT)
print(json.dumps({'updated': args.action, 'at': now}, ensure_ascii=False))
