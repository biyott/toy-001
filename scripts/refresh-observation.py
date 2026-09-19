"""Record an explicit collaboration.list_agents snapshot supplied by the coordinator.
Never discovers or infers runtime state from files or dashboard heartbeat.
"""
import json,sys
from datetime import datetime,timezone
from pathlib import Path
p=Path(__file__).resolve().parents[1]/'.agent-monitor/reports/coordinator.json'
d=json.loads(p.read_text()); now=datetime.now(timezone.utc).isoformat()
observed=json.load(sys.stdin)
for a in d['agents']:
 if a['id'] in observed:
  a.update(status=observed[a['id']],observedAt=now,statusSource='collaboration.list_agents',source='collaboration.list_agents',reportBased=False)
d['observedAt']=now; d['lastRuntimeObservationAt']=now
p.write_text(json.dumps(d,ensure_ascii=False,indent=2)+'\n')
