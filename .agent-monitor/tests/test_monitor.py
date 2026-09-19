from __future__ import annotations

import importlib.util
import json
import tempfile
import threading
import time
import unittest
import urllib.error
import urllib.request
from pathlib import Path


MONITOR = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location("agent_monitor_collector", MONITOR / "collector.py")
module = importlib.util.module_from_spec(SPEC)
assert SPEC.loader
SPEC.loader.exec_module(module)


class MonitorTest(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        root = Path(self.temp.name)
        self.reports = root / "reports"
        self.data = root / "data"
        self.reports.mkdir()

    def tearDown(self):
        self.temp.cleanup()

    def write_coordinator(self, value):
        module.atomic_json(self.reports / "coordinator.json", value)

    def collector(self, stale=180):
        return module.Collector(self.reports, self.data, 0.25, stale)

    def test_status_is_preserved_when_stale(self):
        self.write_coordinator({"agents": [{"id": "a", "status": "running", "observedAt": "2000-01-01T00:00:00Z"}]})
        state = self.collector().collect_once()
        self.assertEqual(state["agents"][0]["status"], "running")
        self.assertTrue(state["agents"][0]["stale"])

    def test_policy_counts_tasks_and_threads_are_separate(self):
        fresh = module.utc_now()
        self.write_coordinator({
            "createdSubagents": 3,
            "limits": {"userSubagentLimit": 1000, "configuredSubagents": 1000, "runtimeAdvertisedTotal": 1001, "runtimeAdvertisedSubagents": 1000},
            "agents": [
                {"id": "main", "kind": "main", "role": "coordinator", "status": "running", "observedAt": fresh},
                {"id": "a", "kind": "subagent", "role": "implementer", "status": "running", "observedAt": fresh, "taskId": "RA", "requestedModel": "sol", "requestedReasoning": "high"},
                {"id": "b", "kind": "subagent", "role": "reviewer", "status": "waiting"},
                {"id": "c", "kind": "subagent", "role": "researcher", "status": {"completed": "완료 요약"}},
            ],
            "tasks": [
                {"id": "R", "status": "ready", "files": ["a"], "dependencies": [], "requestedModel": "sol", "requestedReasoning": "high", "verification": ["unit"], "integrator": "main"},
                {"id": "RA", "status": "ready", "owner": "a", "files": ["owned"]},
                {"id": "Q", "status": "review"},
                {"id": "I", "status": "integrated"},
            ],
            "events": [
                {"id": "spawn-a", "type": "spawn-success", "agentId": "a"},
                {"id": "spawn-fail", "type": "spawn-failure", "message": "생성 실패"},
                {"id": "limit", "type": "limit-policy", "message": "정책 변경"},
                {"id": "limit-error", "type": "limit-reached", "message": "하위 상한 초과로 생성 실패"},
                {"id": "load-ready", "type": "assignment", "message": "적 투사체 포함 상한부하 준비"},
            ],
        })
        state = self.collector().collect_once()
        self.assertEqual(state["counts"]["runningTotal"], 2)
        self.assertEqual(state["counts"]["runningSubagents"], 1)
        self.assertEqual(state["counts"]["waitingSubagents"], 1)
        self.assertEqual(state["counts"]["completedSubagents"], 1)
        self.assertEqual(state["counts"]["createdSubagents"], 3)
        self.assertEqual(state["counts"]["createdSubagentsSource"], "coordinator explicit count")
        self.assertEqual(state["limits"]["effectiveSubagentLimit"], 1000)
        self.assertIsNone(state["counts"]["openSubthreads"])
        self.assertIsNone(state["counts"]["closedSubthreads"])
        self.assertEqual(state["counts"]["tasks"], {"ready": 2, "running": 0, "blocked": 0, "review": 1, "integrated": 1})
        self.assertEqual(state["counts"]["readyUnassignedTasks"], 1)
        self.assertEqual(state["counts"]["byRequestedModel"], {"미확인": 1, "sol": 1})
        self.assertEqual(next(agent for agent in state["agents"] if agent["id"] == "a")["assignedFiles"], ["owned"])
        self.assertEqual(state["operations"]["integrationQueue"][0]["id"], "Q")
        self.assertEqual(state["operations"]["readyUnassigned"][0]["id"], "R")
        self.assertEqual(len(state["operations"]["spawnFailureEvents"]), 1)
        self.assertEqual(len(state["operations"]["limitEvents"]), 1)
        self.assertEqual(state["operations"]["limitEvents"][0]["id"], "limit-error")
        self.assertEqual(len(state["operations"]["policyEvents"]), 1)
        self.assertEqual(state["operations"]["policyEvents"][0]["id"], "limit")

    def test_coordinator_task_decision_wins_and_report_evidence_is_preserved(self):
        self.write_coordinator({"tasks": [{
            "id": "M", "owner": "main", "status": "integrated", "implementation": "done",
            "verification": "passed", "integration": "done", "integrator": "main",
        }]})
        module.atomic_json(self.reports / "a-agent.json", {
            "observedAt": "2026-09-19T12:00:00Z",
            "tasks": [{
                "id": "M", "owner": "agent", "status": "review", "implementation": "complete",
                "verification": ["self test"], "integration": "pending", "result": "agent result",
            }],
        })
        task = self.collector().collect_once()["tasks"][0]
        self.assertEqual(task["status"], "integrated")
        self.assertEqual(task["assignee"], "main")
        self.assertEqual(task["verificationStatus"], "passed")
        self.assertEqual(task["integrationStatus"], "done")
        self.assertEqual(task["authoritySource"], "reports/coordinator.json")
        self.assertIn("status", {conflict["field"] for conflict in task["conflicts"]})
        self.assertEqual(task["reportEvidence"][0]["result"], "agent result")

    def test_only_fresh_running_counts_as_current(self):
        fresh = module.utc_now()
        self.write_coordinator({"agents": [
            {"id": "fresh", "kind": "subagent", "role": "implementer", "status": "running", "observedAt": fresh, "requestedModel": "sol"},
            {"id": "stale", "kind": "subagent", "role": "reviewer", "status": "running", "observedAt": "2000-01-01T00:00:00Z", "requestedModel": "astra"},
            {"id": "unobserved", "kind": "subagent", "role": "researcher", "status": "running", "requestedModel": "terra"},
        ]})
        state = self.collector().collect_once()
        counts = state["counts"]
        self.assertEqual(counts["runningSubagents"], 1)
        self.assertEqual(counts["lastKnownRunningSubagents"], 3)
        self.assertEqual(counts["staleRunningSubagents"], 1)
        self.assertEqual(counts["unobservedRunningSubagents"], 1)
        self.assertEqual(counts["byRole"], {"implementer": 1})
        self.assertEqual(counts["byRequestedModel"], {"sol": 1})
        self.assertEqual(next(agent for agent in state["agents"] if agent["id"] == "stale")["status"], "running")

    def test_cumulative_created_is_unknown_without_explicit_count_or_spawn_events(self):
        self.write_coordinator({"agents": [{"id": "a", "kind": "subagent", "status": "completed"}]})
        state = self.collector().collect_once()
        self.assertIsNone(state["counts"]["createdSubagents"])
        self.assertEqual(state["counts"]["createdSubagentsSource"], "unknown")

    def test_conflicting_sources_keep_evidence_and_newer_value(self):
        self.write_coordinator({"agents": [{"id": "a", "status": "running", "observedAt": "2026-09-19T10:00:00Z", "source": "runtime"}]})
        module.atomic_json(self.reports / "a.json", {"agent": {"id": "a", "status": "completed", "observedAt": "2026-09-19T10:01:00Z", "source": "report"}})
        agent = self.collector().collect_once()["agents"][0]
        self.assertEqual(agent["status"], "completed")
        self.assertEqual(agent["conflicts"][0]["field"], "status")
        self.assertEqual(len(agent["conflicts"][0]["sources"]), 2)

    def test_restart_deduplicates_events_and_snapshot_reloads(self):
        payload = {"observedAt": "2026-09-19T11:45:00Z", "events": [{"id": "same", "message": "once"}]}
        self.write_coordinator(payload)
        first = self.collector()
        first.collect_once(); first.collect_once()
        restarted = self.collector()
        restarted.collect_once()
        self.assertEqual([e["id"] for e in restarted.get_events()], ["same"])
        snapshot = restarted.snapshot()
        self.assertEqual(json.loads((self.data / "final-state.json").read_text())["snapshot"], snapshot["snapshot"])

    def test_missing_event_occurrence_stays_unknown_and_repairs_old_value(self):
        module.atomic_json(self.data / "events.json", [{"id": "unknown-time", "occurredAt": "2099-01-01T00:00:00Z"}])
        self.write_coordinator({"events": [{"id": "unknown-time", "message": "발생시각 없음"}]})
        events = self.collector().collect_once()["events"]
        self.assertIsNone(events[0]["occurredAt"])

    def test_final_input_freezes_observation_and_writes_snapshot(self):
        self.write_coordinator({
            "mode": "final",
            "finalizedAt": "2000-01-01T00:02:00Z",
            "observedAt": "2000-01-01T00:02:00Z",
            "agents": [{"id": "a", "kind": "subagent", "status": "running", "observedAt": "2000-01-01T00:00:30Z"}],
        })
        collector = self.collector()
        state = collector.collect_once()
        saved = json.loads((self.data / "final-state.json").read_text())
        self.assertEqual(state["mode"], "final")
        self.assertEqual(state["stateObservedAt"], "2000-01-01T00:02:00Z")
        self.assertEqual(state["counts"]["runningSubagents"], 1)
        self.assertEqual(saved["snapshot"], {"mode": "final", "savedAt": "2000-01-01T00:02:00Z"})
        original_bytes = (self.data / "final-state.json").read_bytes()
        time.sleep(0.01)
        later = collector.collect_once()
        self.assertEqual(later["counts"], saved["counts"])
        self.assertEqual((self.data / "final-state.json").read_bytes(), original_bytes)

    def test_atomic_writer_never_exposes_partial_json(self):
        path = self.data / "atomic.json"
        module.atomic_json(path, {"n": 0})
        failures = []
        running = True
        def reader():
            while running:
                try:
                    json.loads(path.read_text())
                except Exception as exc:  # pragma: no cover - evidence collector
                    failures.append(exc)
        thread = threading.Thread(target=reader)
        thread.start()
        for n in range(100):
            module.atomic_json(path, {"n": n, "body": "x" * 1000})
        running = False
        thread.join(2)
        self.assertFalse(failures)

    def test_server_only_exposes_allowlisted_paths(self):
        self.write_coordinator({"project": "안전 <script>alert(1)</script>"})
        collector = self.collector(); collector.collect_once()
        server = module.DashboardServer(("127.0.0.1", 0), collector)
        thread = threading.Thread(target=server.serve_forever, daemon=True); thread.start()
        base = f"http://127.0.0.1:{server.server_address[1]}"
        try:
            with urllib.request.urlopen(base + "/api/state") as response:
                state = json.load(response)
                self.assertIn("<script>", state["project"])
                self.assertEqual(response.headers["X-Content-Type-Options"], "nosniff")
            with self.assertRaises(urllib.error.HTTPError) as denied:
                urllib.request.urlopen(base + "/collector.py")
            self.assertEqual(denied.exception.code, 404)
            with urllib.request.urlopen(base + "/assets/fonts/noto-sans-kr-400.woff2") as response:
                self.assertEqual(response.headers["Content-Type"], "font/woff2")
                self.assertEqual(response.read(4), b"wOF2")
            with self.assertRaises(urllib.error.HTTPError) as license_denied:
                urllib.request.urlopen(base + "/assets/fonts/LICENSE")
            self.assertEqual(license_denied.exception.code, 404)
        finally:
            server.shutdown(); server.server_close(); thread.join(2)

    def test_frontend_uses_text_nodes_and_preserves_scroll(self):
        script = (MONITOR / "assets" / "app.js").read_text()
        self.assertNotIn("innerHTML", script)
        self.assertIn("textContent", script)
        self.assertIn("saveScroll", script)
        self.assertIn("restoreScroll", script)
        self.assertIn("role-filter", script)
        self.assertIn('start === null', script)
        self.assertIn("userSubagentLimit", script)
        self.assertIn("effectiveSubagentLimit", script)
        self.assertIn("byRequestedModel", script)
        self.assertIn("state.finalizedAt || state.snapshot?.savedAt", script)
        self.assertIn("최종 관측", script)
        self.assertIn("policyEvents", script)
        self.assertNotIn("operatingTarget", script)
        self.assertNotIn("appliedSubagents", script)
        style = (MONITOR / "assets" / "style.css").read_text()
        self.assertIn("font:inherit", style)
        readme = (MONITOR / "README.md").read_text()
        self.assertNotIn("appliedSubagents", readme)
        self.assertNotIn("operatingTarget", readme)
        self.assertNotIn("16→24", readme)


if __name__ == "__main__":
    unittest.main()
