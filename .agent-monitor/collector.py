#!/usr/bin/env python3
"""Local agent status collector and allowlisted dashboard server."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import signal
import sys
import threading
import time
from datetime import datetime, timezone
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parent
DEFAULT_STALE_SECONDS = 180
MAX_EVENTS = 1000


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def parse_time(value: Any) -> float | None:
    if not isinstance(value, str) or not value:
        return None
    try:
        return datetime.fromisoformat(value.replace("Z", "+00:00")).timestamp()
    except ValueError:
        return None


def read_json(path: Path, fallback: Any) -> Any:
    try:
        with path.open("r", encoding="utf-8") as handle:
            return json.load(handle)
    except (FileNotFoundError, OSError, json.JSONDecodeError):
        return fallback


def atomic_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    with temp.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(temp, path)


def stable_id(prefix: str, value: Any) -> str:
    raw = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return f"{prefix}-{hashlib.sha256(raw.encode('utf-8')).hexdigest()[:16]}"


def normalize_event(event: Any, source: str, observed_at: str) -> dict[str, Any] | None:
    if not isinstance(event, dict):
        return None
    normalized = dict(event)
    normalized.setdefault("source", source)
    normalized.setdefault("observedAt", observed_at)
    normalized.setdefault("kind", "direct")
    normalized.setdefault("occurredAt", normalized.get("timestamp"))
    normalized.setdefault("id", stable_id("event", normalized))
    return normalized


def as_list(value: Any) -> list[Any]:
    return value if isinstance(value, list) else []


def merge_agent(existing: dict[str, Any], incoming: dict[str, Any]) -> dict[str, Any]:
    """Prefer the newer observation while retaining contradictory source evidence."""
    if not existing:
        return dict(incoming)
    old_time = parse_time(existing.get("observedAt")) or 0
    new_time = parse_time(incoming.get("observedAt")) or 0
    older, newer = (existing, incoming) if new_time >= old_time else (incoming, existing)
    merged = {**older, **newer}
    conflicts = list(as_list(existing.get("conflicts"))) + list(as_list(incoming.get("conflicts")))
    for field in ("status", "role", "taskId", "actualModel", "actualReasoning"):
        old_value, new_value = existing.get(field), incoming.get(field)
        if old_value is not None and new_value is not None and old_value != new_value:
            conflict = {
                "field": field,
                "sources": [
                    {"value": old_value, "source": existing.get("source"), "observedAt": existing.get("observedAt")},
                    {"value": new_value, "source": incoming.get("source"), "observedAt": incoming.get("observedAt")},
                ],
            }
            if conflict not in conflicts:
                conflicts.append(conflict)
    if conflicts:
        merged["conflicts"] = conflicts
    return merged


def normalize_agent(agent: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(agent)
    status = normalized.get("status")
    if isinstance(status, dict):
        if "completed" in status:
            normalized["status"] = "completed"
            normalized.setdefault("result", status.get("completed"))
        else:
            normalized["status"] = "unknown"
    elif status in {"done", "complete"}:
        normalized["status"] = "completed"
    normalized["actualObserved"] = bool(normalized.get("actualModel") or normalized.get("actualReasoning"))
    return normalized


def normalize_task(task: dict[str, Any]) -> dict[str, Any]:
    normalized = dict(task)
    normalized.setdefault("assignee", task.get("owner"))
    normalized.setdefault("dependencies", task.get("dependsOn", []))
    normalized.setdefault("files", task.get("ownedFiles", task.get("changedFiles", [])))
    normalized.setdefault("requestedModel", task.get("model"))
    normalized.setdefault("requestedReasoning", task.get("reasoning"))
    normalized.setdefault("implementationStatus", task.get("implementation"))
    normalized.setdefault("verificationStatus", task.get("verificationStatus", task.get("verification")))
    normalized.setdefault("integrationStatus", task.get("integration"))
    status = normalized.get("status")
    if status in {"verified", "completed", "complete"}:
        normalized["status"] = "integrated"
    elif not status:
        task_states = {
            normalized.get("implementationStatus"),
            normalized.get("verificationStatus"),
            normalized.get("integrationStatus"),
        }
        if "failed" in task_states:
            normalized["status"] = "blocked"
        elif normalized.get("integrationStatus") in {"complete", "completed", "integrated"}:
            normalized["status"] = "integrated"
        elif normalized.get("implementationStatus") in {"complete", "completed"}:
            normalized["status"] = "review"
        elif task_states & {"in_progress", "running"}:
            normalized["status"] = "running"
        else:
            normalized["status"] = "pending"
    return normalized


def merge_task(
    existing: dict[str, Any],
    incoming: dict[str, Any],
    source: str,
    coordinator_authority: bool,
    observed_at: Any = None,
) -> dict[str, Any]:
    """Merge task evidence without allowing reports to reverse coordinator decisions."""
    merged = dict(existing)
    field_sources = dict(existing.get("fieldSources", {}))
    conflicts = list(as_list(existing.get("conflicts")))
    evidence = list(as_list(existing.get("reportEvidence")))
    authority_source = existing.get("authoritySource")

    for field, value in incoming.items():
        if field in {"fieldSources", "conflicts", "reportEvidence", "authoritySource"}:
            continue
        old_value = merged.get(field)
        old_source = field_sources.get(field)
        if old_value not in (None, "", [], {}) and value not in (None, "", [], {}) and old_value != value:
            conflict = {
                "field": field,
                "resolution": "coordinator" if coordinator_authority or authority_source else "latest-report",
                "sources": [
                    {"value": old_value, "source": old_source},
                    {"value": value, "source": source},
                ],
            }
            if conflict not in conflicts:
                conflicts.append(conflict)

        if coordinator_authority:
            merged[field] = value
            field_sources[field] = source
        elif authority_source:
            if old_value in (None, "", [], {}):
                merged[field] = value
                field_sources[field] = source
        else:
            merged[field] = value
            field_sources[field] = source

    if not coordinator_authority:
        report_evidence = {
            "source": source,
            "observedAt": observed_at,
            "status": incoming.get("status"),
            "result": incoming.get("result"),
            "verification": incoming.get("verification"),
        }
        if report_evidence not in evidence:
            evidence.append(report_evidence)
    else:
        authority_source = source

    merged["fieldSources"] = field_sources
    if authority_source:
        merged["authoritySource"] = authority_source
    if conflicts:
        merged["conflicts"] = conflicts
    if evidence:
        merged["reportEvidence"] = evidence
    return merged


def count_values(items: list[dict[str, Any]], field: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for item in items:
        value = item.get(field)
        key = str(value) if value not in (None, "") else "미확인"
        counts[key] = counts.get(key, 0) + 1
    return counts


class Collector:
    def __init__(self, reports_dir: Path, data_dir: Path, interval: float, stale_seconds: int):
        self.reports_dir = reports_dir
        self.data_dir = data_dir
        self.interval = interval
        self.stale_seconds = stale_seconds
        self.state_path = data_dir / "state.json"
        self.events_path = data_dir / "events.json"
        self.final_path = data_dir / "final-state.json"
        self.runtime_path = data_dir / "runtime.json"
        self.lock = threading.RLock()
        self.stop_event = threading.Event()
        self._fingerprint = ""
        self._state: dict[str, Any] = read_json(self.state_path, {})
        previous_final = read_json(self.final_path, {})
        self._finalized_at = previous_final.get("finalizedAt") if isinstance(previous_final, dict) and previous_final.get("snapshot", {}).get("mode") == "final" else None
        previous_events = read_json(self.events_path, [])
        self._events: list[dict[str, Any]] = [e for e in as_list(previous_events) if isinstance(e, dict)]
        self._event_ids = {str(e.get("id")) for e in self._events if e.get("id")}

    def _report_files(self) -> list[Path]:
        self.reports_dir.mkdir(parents=True, exist_ok=True)
        return sorted(p for p in self.reports_dir.glob("*.json") if p.is_file())

    def _read_reports(self) -> tuple[list[tuple[Path, dict[str, Any]]], list[dict[str, str]], str]:
        valid: list[tuple[Path, dict[str, Any]]] = []
        errors: list[dict[str, str]] = []
        hashes: list[str] = []
        for path in self._report_files():
            try:
                raw = path.read_bytes()
                hashes.append(f"{path.name}:{hashlib.sha256(raw).hexdigest()}")
                value = json.loads(raw.decode("utf-8"))
                if not isinstance(value, dict):
                    raise ValueError("최상위 값은 객체여야 합니다")
                valid.append((path, value))
            except (OSError, UnicodeDecodeError, json.JSONDecodeError, ValueError) as exc:
                errors.append({"file": path.name, "error": str(exc)})
        return valid, errors, hashlib.sha256("\n".join(hashes).encode()).hexdigest()

    @staticmethod
    def _agent_from_report(path: Path, report: dict[str, Any]) -> dict[str, Any] | None:
        candidate = report.get("agent") if isinstance(report.get("agent"), dict) else report
        if not isinstance(candidate, dict) or not candidate.get("id"):
            return None
        agent = dict(candidate)
        agent.setdefault("source", f"reports/{path.name}")
        agent.setdefault("reportBased", path.name != "coordinator.json")
        return agent

    def collect_once(self) -> dict[str, Any]:
        checked_at = utc_now()
        reports, errors, fingerprint = self._read_reports()
        coordinator: dict[str, Any] = {}
        agents: dict[str, dict[str, Any]] = {}
        tasks: dict[str, dict[str, Any]] = {}
        blockers: list[Any] = []
        links: list[Any] = []
        source_events: list[dict[str, Any]] = []
        source_times: list[str] = []

        for path, report in reports:
            report_source = f"reports/{path.name}"
            report_observation = report.get("observedAt") or report.get("updatedAt")
            if path.name == "coordinator.json":
                coordinator = report
            for item in as_list(report.get("agents")):
                if isinstance(item, dict) and item.get("id"):
                    merged = dict(item)
                    merged.setdefault("source", f"reports/{path.name}")
                    merged.setdefault("reportBased", path.name != "coordinator.json")
                    agents[str(item["id"])] = merge_agent(agents.get(str(item["id"]), {}), normalize_agent(merged))
                    if isinstance(item.get("observedAt"), str):
                        source_times.append(item["observedAt"])
            single_agent = self._agent_from_report(path, report)
            if single_agent:
                previous = agents.get(str(single_agent["id"]), {})
                agents[str(single_agent["id"])] = merge_agent(previous, normalize_agent(single_agent))
            for task in as_list(report.get("tasks")):
                if isinstance(task, dict) and task.get("id"):
                    normalized_task = normalize_task(task)
                    task_id = str(task["id"])
                    tasks[task_id] = merge_task(
                        tasks.get(task_id, {}),
                        normalized_task,
                        report_source,
                        path.name == "coordinator.json",
                        report_observation,
                    )
            blockers.extend(as_list(report.get("blockers")))
            links.extend(as_list(report.get("links")))
            if isinstance(report_observation, str):
                source_times.append(report_observation)
            for event in as_list(report.get("events")):
                normalized = normalize_event(event, f"reports/{path.name}", checked_at)
                if normalized:
                    source_events.append(normalized)
                    if isinstance(normalized.get("observedAt"), str):
                        source_times.append(normalized["observedAt"])

        mode = "final" if coordinator.get("mode") == "final" else "live"
        finalized_at = coordinator.get("finalizedAt") if mode == "final" else None
        now_epoch = (parse_time(finalized_at) if mode == "final" else None) or time.time()
        stale_count = 0
        unknown_count = 0
        for agent in agents.values():
            task = tasks.get(str(agent.get("taskId"))) if agent.get("taskId") else None
            own_files = agent.get("files", agent.get("ownedFiles"))
            if not own_files and task:
                own_files = task.get("files")
            if isinstance(own_files, str):
                own_files = [own_files]
            agent["assignedFiles"] = own_files if isinstance(own_files, list) else []
            agent["actualObserved"] = bool(agent.get("actualModel") or agent.get("actualReasoning"))
            observed = agent.get("observedAt")
            observed_epoch = parse_time(observed)
            agent["stale"] = bool(observed_epoch is not None and now_epoch - observed_epoch > self.stale_seconds)
            if observed_epoch is None:
                agent["freshness"] = "unknown"
                unknown_count += 1
            elif agent["stale"]:
                agent["freshness"] = "stale"
                stale_count += 1
            else:
                agent["freshness"] = "fresh"

        if fingerprint != self._fingerprint:
            event_indexes = {str(event.get("id")): index for index, event in enumerate(self._events) if event.get("id")}
            for event in source_events:
                event_id = str(event["id"])
                if event_id in event_indexes:
                    self._events[event_indexes[event_id]] = event
                else:
                    self._events.append(event)
                    self._event_ids.add(event_id)
            self._events = self._events[-MAX_EVENTS:]
            self._event_ids = {str(e.get("id")) for e in self._events if e.get("id")}
            self._fingerprint = fingerprint

        run = coordinator.get("run") if isinstance(coordinator.get("run"), dict) else {}
        scope = coordinator.get("scope") if isinstance(coordinator.get("scope"), dict) else {}
        limits = dict(coordinator.get("limits")) if isinstance(coordinator.get("limits"), dict) else {}
        limit_inputs = [limits.get("userSubagentLimit"), limits.get("configuredSubagents"), limits.get("runtimeAdvertisedSubagents")]
        if not isinstance(limits.get("effectiveSubagentLimit"), int) and all(isinstance(value, int) for value in limit_inputs):
            limits["effectiveSubagentLimit"] = min(limit_inputs)
        observed_at = max(source_times, key=lambda value: parse_time(value) or 0, default=None)
        if finalized_at:
            observed_at = finalized_at
        spawn_success_ids = {
            str(event.get("agentId"))
            for event in self._events
            if event.get("type") == "spawn-success" and event.get("agentId")
        }
        explicit_created = coordinator.get("createdSubagents")
        if isinstance(explicit_created, int):
            created_subagents = explicit_created
            created_source = "coordinator explicit count"
        elif spawn_success_ids:
            created_subagents = len(spawn_success_ids)
            created_source = "unique spawn-success events"
        else:
            created_subagents = None
            created_source = "unknown"
        agent_values = list(agents.values())
        subagents = [agent for agent in agent_values if agent.get("kind") != "main"]
        last_known_running_agents = [agent for agent in agent_values if agent.get("status") == "running"]
        running_agents = [agent for agent in last_known_running_agents if agent.get("freshness") == "fresh"]
        stale_running_agents = [agent for agent in last_known_running_agents if agent.get("freshness") == "stale"]
        unobserved_running_agents = [agent for agent in last_known_running_agents if agent.get("freshness") == "unknown"]
        running_subagents = [agent for agent in running_agents if agent.get("kind") != "main"]
        last_known_running_subagents = [agent for agent in last_known_running_agents if agent.get("kind") != "main"]
        stale_running_subagents = [agent for agent in stale_running_agents if agent.get("kind") != "main"]
        unobserved_running_subagents = [agent for agent in unobserved_running_agents if agent.get("kind") != "main"]
        task_values = list(tasks.values())
        task_states = ("ready", "running", "blocked", "review", "integrated")
        task_counts = {status: sum(1 for task in task_values if task.get("status") == status) for status in task_states}
        integration_queue = [task for task in task_values if task.get("status") == "review"]
        ready_unassigned = [task for task in task_values if task.get("status") == "ready" and not task.get("assignee")]
        integrated_tasks = [task for task in task_values if task.get("status") == "integrated"][-10:]
        recent_events = list(reversed(self._events))

        def event_matches(event: dict[str, Any], *needles: str) -> bool:
            haystack = f"{event.get('type', '')} {event.get('message', '')}".lower()
            return any(needle in haystack for needle in needles)

        def is_policy_event(event: dict[str, Any]) -> bool:
            event_type = str(event.get("type", "")).lower()
            message = str(event.get("message", "")).lower()
            return "policy" in event_type or event_type == "scope-change" or "정책 변경" in message

        def is_spawn_failure_event(event: dict[str, Any]) -> bool:
            event_type = str(event.get("type", "")).lower()
            message = str(event.get("message", "")).lower()
            typed_failure = "spawn" in event_type and any(term in event_type for term in ("fail", "error", "reject"))
            untyped_failure = "생성 실패" in message and not any(term in f"{event_type} {message}" for term in ("limit", "capacity", "상한", "한도"))
            return typed_failure or untyped_failure

        def is_actual_limit_event(event: dict[str, Any]) -> bool:
            if is_policy_event(event):
                return False
            event_type = str(event.get("type", "")).lower()
            message = str(event.get("message", "")).lower()
            limit_term = any(term in f"{event_type} {message}" for term in ("limit", "rate-limit", "capacity", "상한", "한도"))
            failure_term = any(term in f"{event_type} {message}" for term in ("fail", "error", "reject", "exceed", "reached", "blocked", "실패", "오류", "거부", "초과", "도달", "불가"))
            return limit_term and failure_term

        completion_events = [event for event in recent_events if event_matches(event, "complete", "result", "integrat", "verification", "완료", "통합")][:10]
        spawn_failure_events = [event for event in recent_events if is_spawn_failure_event(event)][:10]
        limit_events = [event for event in recent_events if is_actual_limit_event(event)][:10]
        policy_events = [event for event in recent_events if is_policy_event(event)][:10]
        state = {
            "schemaVersion": 1,
            "mode": mode,
            "finalizedAt": finalized_at,
            "project": coordinator.get("project", "리틀 룬 가디언즈"),
            "phase": coordinator.get("phase", "초기화"),
            "run": run,
            "scope": scope,
            "limits": limits,
            "collector": {
                "status": "running",
                "heartbeatAt": checked_at,
                "intervalSeconds": self.interval,
                "staleAfterSeconds": self.stale_seconds,
                "sourceFileCount": len(reports),
                "sourceErrors": errors,
            },
            "stateObservedAt": observed_at,
            "agents": agent_values,
            "tasks": task_values,
            "blockers": blockers,
            "links": links,
            "events": list(reversed(self._events)),
            "counts": {
                "agents": len(agent_values),
                "running": len(running_agents),
                "runningTotal": len(running_agents),
                "runningSubagents": len(running_subagents),
                "lastKnownRunningTotal": len(last_known_running_agents),
                "lastKnownRunningSubagents": len(last_known_running_subagents),
                "staleRunningTotal": len(stale_running_agents),
                "staleRunningSubagents": len(stale_running_subagents),
                "unobservedRunningTotal": len(unobserved_running_agents),
                "unobservedRunningSubagents": len(unobserved_running_subagents),
                "waitingSubagents": sum(1 for agent in subagents if agent.get("status") == "waiting"),
                "completedSubagents": sum(1 for agent in subagents if agent.get("status") == "completed"),
                "stale": stale_count,
                "unknown": unknown_count,
                "createdSubagents": created_subagents,
                "createdSubagentsSource": created_source,
                "openSubthreads": coordinator.get("openSubthreads"),
                "closedSubthreads": coordinator.get("closedSubthreads"),
                "byRole": count_values(running_agents, "role"),
                "byRequestedModel": count_values(running_agents, "requestedModel"),
                "byRequestedReasoning": count_values(running_agents, "requestedReasoning"),
                "tasks": task_counts,
                "readyUnassignedTasks": len(ready_unassigned),
            },
            "operations": {
                "readyUnassigned": ready_unassigned,
                "integrationQueue": integration_queue,
                "integratedTasks": integrated_tasks,
                "recentCompletionEvents": completion_events,
                "spawnFailureEvents": spawn_failure_events,
                "limitEvents": limit_events,
                "policyEvents": policy_events,
            },
        }
        with self.lock:
            self._state = state
            atomic_json(self.state_path, state)
            atomic_json(self.events_path, self._events)
            if mode == "final" and finalized_at != self._finalized_at:
                final_state = json.loads(json.dumps(state))
                final_state["snapshot"] = {"mode": "final", "savedAt": finalized_at or checked_at}
                atomic_json(self.final_path, final_state)
                self._finalized_at = finalized_at
        return state

    def snapshot(self, mode: str = "final") -> dict[str, Any]:
        with self.lock:
            value = json.loads(json.dumps(self._state))
        value["snapshot"] = {"mode": mode, "savedAt": utc_now()}
        atomic_json(self.final_path, value)
        return value

    def get_state(self) -> dict[str, Any]:
        with self.lock:
            return json.loads(json.dumps(self._state))

    def get_events(self) -> list[dict[str, Any]]:
        with self.lock:
            return json.loads(json.dumps(self._events))

    def run(self) -> None:
        while not self.stop_event.is_set():
            self.collect_once()
            self.stop_event.wait(self.interval)


class DashboardServer(ThreadingHTTPServer):
    daemon_threads = True

    def __init__(self, address: tuple[str, int], collector: Collector):
        self.collector = collector
        super().__init__(address, DashboardHandler)


class DashboardHandler(BaseHTTPRequestHandler):
    server_version = "AgentMonitor/1"
    static_routes = {
        "/": (ROOT / "index.html", "text/html; charset=utf-8"),
        "/index.html": (ROOT / "index.html", "text/html; charset=utf-8"),
        "/assets/app.js": (ROOT / "assets" / "app.js", "text/javascript; charset=utf-8"),
        "/assets/style.css": (ROOT / "assets" / "style.css", "text/css; charset=utf-8"),
        "/assets/fonts/noto-sans-kr-400.woff2": (ROOT / "assets" / "fonts" / "noto-sans-kr-400.woff2", "font/woff2"),
        "/assets/fonts/noto-sans-kr-700.woff2": (ROOT / "assets" / "fonts" / "noto-sans-kr-700.woff2", "font/woff2"),
    }

    def log_message(self, fmt: str, *args: Any) -> None:
        status = str(args[1]) if len(args) > 1 else ""
        if status.startswith(("4", "5")):
            sys.stderr.write(f"[{utc_now()}] {fmt % args}\n")

    def _send(self, status: HTTPStatus, body: bytes, content_type: str) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("Content-Security-Policy", "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'")
        self.end_headers()
        if self.command != "HEAD":
            try:
                self.wfile.write(body)
            except (BrokenPipeError, ConnectionResetError):
                pass

    def do_HEAD(self) -> None:
        self.do_GET()

    def do_GET(self) -> None:
        path = self.path.split("?", 1)[0]
        collector: Collector = self.server.collector  # type: ignore[attr-defined]
        if path == "/api/state":
            body = json.dumps(collector.get_state(), ensure_ascii=False).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return
        if path == "/api/events":
            body = json.dumps(collector.get_events(), ensure_ascii=False).encode("utf-8")
            self._send(HTTPStatus.OK, body, "application/json; charset=utf-8")
            return
        if path == "/health":
            state = collector.get_state()
            heartbeat = state.get("collector", {}).get("heartbeatAt")
            final_view = state.get("mode") == "final" or state.get("snapshot", {}).get("mode") == "final"
            healthy = final_view or bool(heartbeat and (time.time() - (parse_time(heartbeat) or 0)) <= max(10, collector.interval * 3))
            body = json.dumps({"ok": healthy, "mode": "final" if final_view else "live", "heartbeatAt": heartbeat}).encode("utf-8")
            self._send(HTTPStatus.OK if healthy else HTTPStatus.SERVICE_UNAVAILABLE, body, "application/json; charset=utf-8")
            return
        route = self.static_routes.get(path)
        if route:
            file_path, content_type = route
            try:
                body = file_path.read_bytes()
            except OSError:
                self._send(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")
                return
            self._send(HTTPStatus.OK, body, content_type)
            return
        self._send(HTTPStatus.NOT_FOUND, b"Not found", "text/plain; charset=utf-8")


def bind_server(host: str, preferred_port: int, collector: Collector) -> DashboardServer:
    last_error: OSError | None = None
    for port in range(preferred_port, preferred_port + 100):
        try:
            return DashboardServer((host, port), collector)
        except OSError as exc:
            last_error = exc
    raise OSError(f"{preferred_port}부터 100개 포트에 바인딩할 수 없습니다") from last_error


def main() -> int:
    parser = argparse.ArgumentParser(description="에이전트 상태 수집기와 로컬 대시보드 서버")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=4310)
    parser.add_argument("--interval", type=float, default=2.0)
    parser.add_argument("--stale-seconds", type=int, default=DEFAULT_STALE_SECONDS)
    parser.add_argument("--reports-dir", type=Path, default=ROOT / "reports")
    parser.add_argument("--data-dir", type=Path, default=ROOT / "data")
    parser.add_argument("--once", action="store_true", help="한 번 수집하고 종료")
    parser.add_argument("--view-final", action="store_true", help="저장된 final-state.json을 읽기 전용으로 제공")
    args = parser.parse_args()
    if args.host != "127.0.0.1":
        parser.error("보안을 위해 --host는 127.0.0.1만 허용합니다")
    if args.interval < 0.25:
        parser.error("--interval은 0.25초 이상이어야 합니다")
    if args.once and args.view_final:
        parser.error("--once와 --view-final은 함께 사용할 수 없습니다")

    collector = Collector(args.reports_dir.resolve(), args.data_dir.resolve(), args.interval, args.stale_seconds)
    if args.view_final:
        final_state = read_json(collector.final_path, None)
        if not isinstance(final_state, dict):
            parser.error(f"최종 저장본이 없습니다: {collector.final_path}")
        collector._state = final_state
    else:
        state = collector.collect_once()
        if args.once:
            if state.get("mode") != "final":
                collector.snapshot("manual")
            return 0

    server = bind_server(args.host, args.port, collector)
    port = server.server_address[1]
    runtime_mode = "final-view" if args.view_final else "live"
    atomic_json(collector.runtime_path, {"pid": os.getpid(), "host": args.host, "port": port, "url": f"http://{args.host}:{port}/", "mode": runtime_mode, "startedAt": utc_now()})
    worker = None
    if not args.view_final:
        worker = threading.Thread(target=collector.run, name="collector", daemon=True)
        worker.start()

    def stop(_signum: int, _frame: Any) -> None:
        collector.stop_event.set()
        threading.Thread(target=server.shutdown, daemon=True).start()

    signal.signal(signal.SIGINT, stop)
    signal.signal(signal.SIGTERM, stop)
    print(f"http://{args.host}:{port}/", flush=True)
    try:
        server.serve_forever(poll_interval=0.25)
    finally:
        collector.stop_event.set()
        if worker:
            worker.join(timeout=max(1.0, args.interval + 0.5))
            state = collector.collect_once()
            if state.get("mode") != "final":
                collector.snapshot("final")
        server.server_close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
