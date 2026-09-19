"use strict";

const $ = (id) => document.getElementById(id);
const ui = { role: $("role-filter"), status: $("status-filter"), search: $("search-filter") };
let latest = null;
let lastSuccess = 0;

function text(value, fallback = "미확인") {
  return value === null || value === undefined || value === "" ? fallback : String(value);
}
function time(value) {
  if (!value) return "미확인";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toLocaleString("ko-KR", { hour12: false });
}
function elapsed(start, end = Date.now()) {
  if (start === null || start === undefined || start === "") return "미확인";
  const from = new Date(start).getTime();
  const to = typeof end === "number" ? end : new Date(end).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to)) return "미확인";
  const seconds = Math.max(0, Math.floor((to - from) / 1000));
  const d = Math.floor(seconds / 86400), h = Math.floor(seconds % 86400 / 3600), m = Math.floor(seconds % 3600 / 60);
  return [d && `${d}일`, h && `${h}시간`, `${m}분`].filter(Boolean).join(" ");
}
function node(tag, className, content) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (content !== undefined) el.textContent = text(content, "");
  return el;
}
function replace(container, children, emptyText) {
  container.replaceChildren(...children);
  container.classList.toggle("empty", children.length === 0);
  if (!children.length) container.textContent = emptyText;
}
function saveScroll(ids) {
  return Object.fromEntries(ids.map((id) => [id, $(id).scrollTop]));
}
function restoreScroll(values) {
  Object.entries(values).forEach(([id, top]) => { $(id).scrollTop = top; });
}
function optionValues(select, values) {
  const current = select.value;
  const wanted = ["", ...new Set(values.filter(Boolean).map(String))];
  const existing = [...select.options].map((o) => o.value);
  if (wanted.join("|") !== existing.join("|")) {
    const all = node("option", "", "전체"); all.value = "";
    select.replaceChildren(all, ...wanted.slice(1).sort().map((value) => { const o = node("option", "", value); o.value = value; return o; }));
    select.value = wanted.includes(current) ? current : "";
  }
}
function addMetric(label, value) {
  const card = node("div", "metric"); card.append(node("span", "", label), node("b", "", value)); return card;
}
function clockReference(state) {
  const finalMode = state.mode === "final" || state.snapshot?.mode === "final";
  const frozenAt = state.finalizedAt || state.snapshot?.savedAt;
  const frozenTime = frozenAt ? new Date(frozenAt).getTime() : NaN;
  return finalMode && Number.isFinite(frozenTime) ? frozenTime : Date.now();
}
function listText(value, fallback = "미확인") {
  if (Array.isArray(value)) return value.map((item) => typeof item === "object" ? text(item.result || item.name || item.summary) : text(item)).join(" · ") || fallback;
  if (value && typeof value === "object") return text(value.result || value.name || value.summary, fallback);
  return text(value, fallback);
}
function summary(state) {
  const run = state.run || {}, scope = state.scope || {}, limits = state.limits || {}, counts = state.counts || {};
  const finalMode = state.mode === "final" || state.snapshot?.mode === "final";
  const frozenAt = state.finalizedAt || state.snapshot?.savedAt;
  const now = clockReference(state);
  const threadLine = `${text(counts.openSubthreads)} / ${text(counts.closedSubthreads)}`;
  const constraint = limits.expansionBlockers ?? limits.targetShortfallReason;
  const values = [
    ["메인 세션", text(run.sessionId)], ["실행 ID", text(run.id)], ["관찰 범위", text(scope.description)],
    ["시작", time(run.startedAt)], ["마감", time(run.deadlineAt)], ["경과 / 남음", `${elapsed(run.startedAt, now)} / ${elapsed(now, run.deadlineAt)}`],
    ["런타임 고지 총계 / 하위", `${text(limits.runtimeAdvertisedTotal)} / ${text(limits.runtimeAdvertisedSubagents)}`],
    ["사용자 / 설정 상한", `${text(limits.userSubagentLimit)} / ${text(limits.configuredSubagents)} · ${text(limits.configuredSource)}`],
    ["유효 하위 상한", text(limits.effectiveSubagentLimit)],
    ["관측된 누적 생성 / 확인된 실행 하위", `${text(counts.createdSubagents)} / ${text(counts.runningSubagents, "0")}`],
    ["누적 근거", text(counts.createdSubagentsSource)],
    ["마지막 running / 오래됨 / 관측 없음", `${text(counts.lastKnownRunningSubagents, "0")} / ${text(counts.staleRunningSubagents, "0")} / ${text(counts.unobservedRunningSubagents, "0")}`],
    ["확인된 하위 대기 / 완료 / 상태 미관측", `${text(counts.waitingSubagents, "0")} / ${text(counts.completedSubagents, "0")} / ${text(counts.unknown, "0")}`],
    ["열림 / 닫힘 스레드", threadLine], ["오래됨 / 관측 없음", `${counts.stale || 0} / ${counts.unknown || 0}`],
    ["운영 정책", text(limits.policy)], ["동시 확장 실제 요인", listText(constraint)],
    ["런타임 한도 근거", `${text(limits.runtimeLimitStatus)} · ${text(limits.runtimeSource)}`],
    ["수집기 heartbeat", time(state.collector?.heartbeatAt)], ["실제 상태 관측", time(state.stateObservedAt)],
    ["시간 기준", finalMode ? `최종 관측 ${time(frozenAt)}` : "실시간 관측"],
  ];
  $("summary").replaceChildren(...values.map(([a,b]) => addMetric(a,b)));
}
function renderAgents(state) {
  const agents = state.agents || [];
  const now = clockReference(state);
  optionValues(ui.role, agents.map((a) => a.role)); optionValues(ui.status, agents.map((a) => a.status));
  const query = ui.search.value.trim().toLocaleLowerCase("ko");
  const filtered = agents.filter((a) => (!ui.role.value || a.role === ui.role.value) && (!ui.status.value || a.status === ui.status.value) && (!query || JSON.stringify(a).toLocaleLowerCase("ko").includes(query)));
  $("agent-count").textContent = `${filtered.length}/${agents.length}`;
  replace($("agents"), filtered.map((a) => {
    const card = node("div", "agent"); const head = node("div", "agent-head");
    head.append(node("strong", "", `${a.kind === "main" ? "메인" : "하위"} · ${text(a.id)}`), node("span", `status ${text(a.status, "unknown")}`, text(a.status)), node("span", "tag", `${text(a.role)} / ${text(a.specialty)}`));
    if (a.stale) head.append(node("span", "tag stale", "오래된 정보"));
    card.append(head, node("p", "", text(a.taskSummary || a.activity, "최근 활동 미확인")));
    const meta = node("div", "meta");
    const actual = a.actualObserved ? [a.actualModel,a.actualReasoning].filter(Boolean).join(" ") : "미관측";
    [["작업",a.taskId],["부모",a.parentId],["요청",[a.requestedModel,a.requestedReasoning].filter(Boolean).join(" ")],["실제 확인",actual],["신선도",a.freshness],["경과",elapsed(a.startedAt, now)],["관측",time(a.observedAt)],["활동",time(a.lastActivityAt)],["상태 출처",a.statusSource],["근거",a.reportBased ? "에이전트 보고" : a.source]].forEach(([k,v]) => meta.append(node("span", "", `${k}: ${text(v)}`)));
    card.append(meta);
    if ((a.assignedFiles || []).length) card.append(node("div", "meta", `담당 파일: ${a.assignedFiles.join(", ")}`));
    if ((a.changedFiles || []).length) card.append(node("div", "meta", `변경: ${a.changedFiles.join(", ")}`));
    if ((a.verification || []).length) card.append(node("div", "meta", `검증: ${a.verification.map((v) => typeof v === "string" ? v : v.result || v.name).join(" · ")}`));
    if ((a.conflicts || []).length) card.append(node("div", "meta stale", `출처 불일치: ${a.conflicts.map((v) => v.field).join(", ")} · 각 출처/관측시각은 API에 보존`));
    return card;
  }), "조건에 맞는 에이전트가 없습니다.");
}
function renderTree(state) {
  const agents = state.agents || [], byParent = new Map();
  agents.forEach((a) => { const key = a.parentId || "__root"; byParent.set(key, [...(byParent.get(key) || []), a]); });
  const rows = [], seen = new Set();
  function visit(agent, depth) {
    if (seen.has(agent.id)) return; seen.add(agent.id);
    const row = node("div", "tree-row"); row.append(node("span", "tree-branch", depth ? `${"  ".repeat(depth-1)}└` : "●"), node("strong", "", text(agent.id)), node("span", `status ${text(agent.status,"unknown")}`, text(agent.status)) ); rows.push(row);
    (byParent.get(agent.id) || []).forEach((child) => visit(child, depth + 1));
  }
  (byParent.get("__root") || agents.filter((a) => !agents.some((b) => b.id === a.parentId))).forEach((a) => visit(a, 0));
  agents.filter((a) => !seen.has(a.id)).forEach((a) => visit(a, 0));
  replace($("tree"), rows, "관측 데이터가 없습니다.");
}
function renderTasks(state) {
  const tasks = state.tasks || [], counts = state.counts?.tasks || {};
  const countLine = ["ready","running","blocked","review","integrated"].map((key) => `${key} ${counts[key] || 0}`).join(" · ");
  $("task-progress").textContent = tasks.length ? countLine : "측정 가능한 작업 없음";
  const priority = {blocked:0,review:1,ready:2,running:3,integrated:4};
  replace($("tasks"), [...tasks].sort((a,b) => (priority[a.status] ?? 5) - (priority[b.status] ?? 5)).map((t) => {
    const card = node("div", "task"); const head = node("div", "task-head");
    head.append(node("strong", "", `${text(t.id)} · ${text(t.title || t.summary)}`), node("span", `status ${text(t.status,"unknown")}`, text(t.status)));
    card.append(head, node("p", "", text(t.nextAction || t.result, "결과 미확인")));
    const deps = Array.isArray(t.dependencies) ? t.dependencies.join(", ") : t.dependencies;
    const files = Array.isArray(t.files) ? t.files : (t.files ? [t.files] : []);
    card.append(node("div", "meta", `담당 ${text(t.assignee)} · 선행 ${text(deps, "없음")} · 요청 ${text(t.requestedModel)} ${text(t.requestedReasoning)} · 통합담당 ${text(t.integrator)}`));
    card.append(node("div", "meta", `구현 ${text(t.implementationStatus)} · 검증 ${listText(t.verificationStatus)} · 통합 ${text(t.integrationStatus)}`));
    if (files.length) card.append(node("div", "meta", `파일: ${files.join(", ")}`));
    if (t.verification && t.verification !== t.verificationStatus) card.append(node("div", "meta", `검증 근거: ${listText(t.verification)}`));
    if (t.authoritySource) card.append(node("div", "meta", `작업 판정 출처: ${t.authoritySource}`));
    if ((t.conflicts || []).length) card.append(node("div", "meta stale", `판정 충돌: ${t.conflicts.map((conflict) => `${conflict.field} (${(conflict.sources || []).map((source) => `${text(source.source)}=${listText(source.value)}`).join(" ↔ ")})`).join(" · ")} · coordinator 판정 유지`));
    (t.reportEvidence || []).slice(0,3).forEach((evidence) => card.append(node("div", "meta", `보고 증거 ${text(evidence.source)}: ${text(evidence.status)} · ${text(evidence.result)} · ${listText(evidence.verification)}`)));
    return card;
  }), "작업 정보가 없습니다.");
}
function renderDistributions(state) {
  const groups = [["역할",state.counts?.byRole],["요청 모델",state.counts?.byRequestedModel],["요청 추론",state.counts?.byRequestedReasoning]];
  replace($("distributions"), groups.map(([label, values]) => {
    const section = node("div", "distribution-group"); section.append(node("strong", "", label));
    const entries = Object.entries(values || {}).sort((a,b) => b[1]-a[1]);
    const tags = node("div", "meta"); entries.forEach(([name,count]) => tags.append(node("span", "tag", `${name} ${count}`)));
    if (!entries.length) tags.append(node("span", "", "관측 없음")); section.append(tags); return section;
  }), "실행 중인 에이전트가 없습니다.");
}
function renderOperations(state) {
  const ops = state.operations || {};
  $("ready-unassigned-count").textContent = `ready · 담당 없음 · ${(ops.readyUnassigned || []).length}`;
  replace($("ready-unassigned"), (ops.readyUnassigned || []).map((task) => {
    const card = node("div", "task");
    card.append(node("strong", "", `${text(task.id)} · ${text(task.summary || task.title)}`), node("p", "", `선행 ${listText(task.dependencies, "없음")} · 요청 ${text(task.requestedModel)} ${text(task.requestedReasoning)} · 파일 ${listText(task.files, "미기록")}`));
    return card;
  }), "미배정 ready 작업이 없습니다.");
  replace($("integration-queue"), (ops.integrationQueue || []).map((task) => {
    const card = node("div", "task"); card.append(node("strong", "", `${text(task.id)} · ${text(task.summary || task.title)}`), node("p", "", `통합담당 ${text(task.integrator)} · 파일 ${listText(task.files, "미기록")}`)); return card;
  }), "통합 대기 작업이 없습니다.");
  const rows = [];
  (ops.integratedTasks || []).slice(-5).reverse().forEach((task) => rows.push(["통합",`${text(task.id)} · ${text(task.summary || task.title)}`]));
  (ops.recentCompletionEvents || []).slice(0,5).forEach((event) => rows.push(["완료",text(event.message || event.summary)]));
  (ops.spawnFailureEvents || []).slice(0,5).forEach((event) => rows.push(["생성 실패",text(event.message || event.summary)]));
  (ops.limitEvents || []).slice(0,5).forEach((event) => rows.push(["실제 제한 오류",text(event.message || event.summary)]));
  (ops.policyEvents || []).slice(0,5).forEach((event) => rows.push(["정책 변경",text(event.message || event.summary)]));
  replace($("operations"), rows.slice(0,12).map(([kind,message]) => { const card=node("div","event"); card.append(node("span","tag",kind),node("p","",message)); return card; }), "운영 이벤트가 없습니다.");
}
function renderEvents(state) {
  replace($("events"), (state.events || []).slice(0,200).map((event) => {
    const card = node("div", "event"); card.append(node("time", "", `${time(event.occurredAt)} · 관측 ${time(event.observedAt)}`), node("p", "", text(event.message || event.summary || event.value, "내용 없음")), node("small", "", `${text(event.kind)} · ${text(event.source)} · ${text(event.id)}`)); return card;
  }), "이벤트가 없습니다.");
}
function renderSimple(id, values, emptyText, type) {
  replace($(id), (values || []).map((value) => {
    const obj = typeof value === "object" ? value : { message: value };
    const card = node("div", type);
    if (id === "links" && obj.url) {
      const a = node("a", "", text(obj.label || obj.name || obj.url));
      try { const parsed = new URL(obj.url, location.origin); if (!["http:","https:"].includes(parsed.protocol)) throw new Error("unsafe"); a.href = parsed.href; a.target = "_blank"; a.rel = "noopener noreferrer"; }
      catch (_) { a.removeAttribute("href"); a.title = "허용되지 않은 링크 형식"; }
      card.append(a);
    }
    else card.append(node("strong", "", text(obj.title || obj.id, "항목")), node("p", "", text(obj.message || obj.summary || obj.nextAction)));
    return card;
  }), emptyText);
}
function render(state) {
  const scroll = saveScroll(["tasks","events","tree"]); latest = state;
  $("project").textContent = text(state.project); $("phase").textContent = `현재 단계 · ${text(state.phase)}`;
  if (state.mode === "final" || state.snapshot?.mode === "final") connection(true, `최종 저장본 · ${time(state.finalizedAt || state.snapshot?.savedAt)}`);
  summary(state); renderDistributions(state); renderOperations(state); renderAgents(state); renderTree(state); renderTasks(state); renderEvents(state);
  renderSimple("blockers", state.blockers, "등록된 장애물이 없습니다.", "blocker"); renderSimple("links", state.links, "등록된 링크가 없습니다.", "link-card");
  $("rendered-at").textContent = new Date().toLocaleTimeString("ko-KR", {hour12:false}); restoreScroll(scroll);
}
function connection(ok, message) { $("connection").textContent = message; $("connection-dot").className = `dot ${ok ? "ok" : "bad"}`; }
async function refresh() {
  try {
    const response = await fetch("/api/state", {cache:"no-store"}); if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const state = await response.json(); lastSuccess = Date.now(); connection(true, "수집기 연결됨"); render(state);
  } catch (error) {
    connection(false, `연결 끊김 · 마지막 성공 ${lastSuccess ? time(new Date(lastSuccess).toISOString()) : "없음"}`);
  }
}
[ui.role, ui.status].forEach((control) => control.addEventListener("change", () => latest && renderAgents(latest)));
ui.search.addEventListener("input", () => latest && renderAgents(latest));
$("reset-filter").addEventListener("click", () => { ui.role.value = ""; ui.status.value = ""; ui.search.value = ""; if (latest) renderAgents(latest); });
refresh(); setInterval(refresh, 2000);
