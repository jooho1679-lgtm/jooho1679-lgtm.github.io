(function () {
  "use strict";

  var LS_KEY = "geongik_selection_v1";
  var LS_HOLIDAY_KEY = "geongik_force_holiday_v1";

  var ROUTE_ORDER = ["급행1번", "급행3번", "11번", "21번", "22번", "23번", "24번", "25번", "26번", "46번", "114번", "202번(2002번)", "211번", "216번", "318번", "704번", "708번"];

  var state = {
    route: null,
    trip: null,
    dayCategory: "weekday",
    alarmOn: false,
    timers: [],
    fired: {}
  };

  var els = {};

  function $(id) { return document.getElementById(id); }

  function pad2(n) { return n < 10 ? "0" + n : "" + n; }

  function todayStr(d) {
    return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
  }

  function dayCategoryLabel(cat) {
    if (cat === "weekday") return "평일";
    if (cat === "saturday") return "토요일";
    if (cat === "holiday") return "휴일(일요일/공휴일)";
    return cat;
  }

  // 오늘 날짜만 보고 자동으로 정하는 요일 구분
  // (공휴일은 달력으로 알 수 없으므로 기사님이 직접 '휴일'을 누르면 됨)
  function autoDayCategory() {
    var d = new Date().getDay();
    if (d === 0) return "holiday";
    if (d === 6) return "saturday";
    return "weekday";
  }

  // 사용자가 직접 고른 요일(당일에만 유지)
  function getDayOverride() {
    try {
      var raw = localStorage.getItem(LS_HOLIDAY_KEY);
      if (!raw) return null;
      var obj = JSON.parse(raw);
      if (obj.date !== todayStr(new Date())) return null;
      return obj.value || null;
    } catch (e) { return null; }
  }

  function setDayOverride(cat) {
    if (!cat || cat === autoDayCategory()) {
      localStorage.removeItem(LS_HOLIDAY_KEY);
    } else {
      localStorage.setItem(LS_HOLIDAY_KEY, JSON.stringify({ date: todayStr(new Date()), value: cat }));
    }
  }

  function computeDayCategory() {
    return getDayOverride() || autoDayCategory();
  }

  function parseTimeToday(hhmm) {
    var parts = hhmm.split(":");
    var h = parseInt(parts[0], 10);
    var m = parseInt(parts[1], 10);
    var now = new Date();
    var d = new Date(now.getFullYear(), now.getMonth(), now.getDate(), h, m, 0, 0);
    return d;
  }

  function formatTime(hhmm) {
    var parts = hhmm.split(":");
    return pad2(parseInt(parts[0], 10)) + ":" + pad2(parseInt(parts[1], 10));
  }

  function sortedRoutes() {
    var list = SCHEDULE_DATA.slice();
    list.sort(function (a, b) {
      var ia = ROUTE_ORDER.indexOf(a.label);
      var ib = ROUTE_ORDER.indexOf(b.label);
      if (ia < 0) ia = 999;
      if (ib < 0) ib = 999;
      return ia - ib;
    });
    return list;
  }

  function renderTopbar() {
    var now = new Date();
    var wd = ["일", "월", "화", "수", "목", "금", "토"][now.getDay()];
    $("todayInfo").textContent = now.getFullYear() + "년 " + (now.getMonth() + 1) + "월 " + now.getDate() + "일 (" + wd + ") " + pad2(now.getHours()) + ":" + pad2(now.getMinutes());
    renderDayTabs();
  }

  function renderDayTabs() {
    var auto = autoDayCategory();
    var tabs = document.querySelectorAll(".day-tab");
    Array.prototype.forEach.call(tabs, function (btn) {
      var day = btn.dataset.day;
      btn.classList.toggle("active", day === state.dayCategory);
      btn.classList.toggle("is-today", day === auto);
    });
    var note = $("dayNote");
    if (state.dayCategory === auto) {
      note.textContent = "오늘 날짜에 맞는 " + dayCategoryLabel(auto) + " 시간표입니다.";
      note.classList.remove("warn");
    } else {
      note.textContent = "※ 오늘은 " + dayCategoryLabel(auto) + "입니다. 지금은 " +
        dayCategoryLabel(state.dayCategory) + " 시간표를 보고 있습니다.";
      note.classList.add("warn");
    }
  }

  function setDayCategory(cat) {
    if (state.dayCategory === cat) return;
    state.dayCategory = cat;
    setDayOverride(cat);
    stopAlarmSound();
    state.alarmOn = false;
    state.fired = {};
    stopAllTimers();
    state.route = null;
    state.trip = null;
    localStorage.removeItem(LS_KEY);
    renderDayTabs();
    renderRouteList();
    // 요일을 바꾸면 처음(노선 목록)부터 다시 고르는 것이므로 현재 기록을 시작점으로 되돌림
    replaceView("view-route");
  }

  // 엑셀 원본에서 요일이 어떻게 묶여 있는지 알려준다.
  // (토요일 시간표가 빠진 게 아니라 원래 휴일과 같은 표를 쓴다는 걸 명확히 하기 위함)
  function scheduleKindLabel(route, cat) {
    var meta = route.meta && route.meta[cat];
    if (!meta) return null;
    var raw = (meta.dayTypeLabel || "").replace(/\s/g, "");
    if (raw === "ALL") return "매일 같은 시간표";
    if (raw === "휴,토" || raw === "휴토" || raw === "토,휴") return "휴일·토요일 공용 시간표";
    return null;
  }

  function renderRouteList() {
    var container = $("routeList");
    container.innerHTML = "";
    sortedRoutes().forEach(function (route) {
      var trips = (route.schedules[state.dayCategory] || []);
      var btn = document.createElement("button");
      btn.className = "route-card";
      var jointBadge = route.joint ? '<div class="rc-joint">공동배차: ' + route.companies.join("·") + ' (경익 담당 차량만 표시)</div>' : "";
      var kind = scheduleKindLabel(route, state.dayCategory);
      var kindBadge = kind ? '<div class="rc-daykind">' + kind + '</div>' : "";
      btn.innerHTML =
        '<div class="rc-name">' + route.label + '</div>' +
        '<div class="rc-path">' + route.origin + ' ↔ ' + route.destination + ' · 경익 배차 ' + trips.length + '대</div>' +
        kindBadge + jointBadge;
      btn.addEventListener("click", function () { selectRoute(route); });
      container.appendChild(btn);
    });
  }

  function selectRoute(route) {
    // 다른 노선을 고르면 이전 노선의 순번 표시가 남지 않도록 초기화
    if (state.route !== route) state.trip = null;
    state.route = route;
    $("tripRouteTitle").textContent = "2. " + route.label + " 배차 순번(차번호)을 선택하세요";
    renderTripList();
    pushView("view-trip");
  }

  function renderTripList() {
    var container = $("tripList");
    container.innerHTML = "";
    var trips = state.route.schedules[state.dayCategory] || [];
    if (trips.length === 0) {
      container.innerHTML = '<p>오늘(' + dayCategoryLabel(state.dayCategory) + ') 경익 배차 차량이 없습니다.</p>';
      return;
    }
    trips.forEach(function (trip) {
      var first = trip.stops[0];
      var last = trip.stops[trip.stops.length - 1];
      var btn = document.createElement("button");
      btn.className = "trip-card";
      // 지금 보고 있던 순번을 표시해 되돌아왔을 때 바로 알아볼 수 있게 함
      if (state.trip && state.trip.trip === trip.trip) btn.classList.add("selected");
      var subBadge = trip.subRoute ? '<div class="tc-sub">' + trip.subRoute + '번 운행</div>' : "";
      btn.innerHTML =
        '<div class="tc-num">' + trip.trip + '</div>' +
        '<div class="tc-range">' + formatTime(first.time) + ' ~ ' + formatTime(last.time) + '</div>' +
        subBadge;
      btn.addEventListener("click", function () { selectTrip(trip); });
      container.appendChild(btn);
    });
  }

  function selectTrip(trip) {
    state.trip = trip;
    saveSelection();
    showDashboard();
    pushView("view-dashboard");
  }

  function saveSelection() {
    localStorage.setItem(LS_KEY, JSON.stringify({
      date: todayStr(new Date()),
      dayCategory: state.dayCategory,
      routeLabel: state.route.label,
      tripNum: state.trip.trip
    }));
  }

  function tryRestoreSelection() {
    try {
      var raw = localStorage.getItem(LS_KEY);
      if (!raw) return false;
      var obj = JSON.parse(raw);
      if (obj.date !== todayStr(new Date())) return false;
      if (obj.dayCategory !== state.dayCategory) return false;
      var route = SCHEDULE_DATA.filter(function (r) { return r.label === obj.routeLabel; })[0];
      if (!route) return false;
      var trips = route.schedules[state.dayCategory] || [];
      var trip = trips.filter(function (t) { return t.trip === obj.tripNum; })[0];
      if (!trip) return false;
      state.route = route;
      state.trip = trip;
      return true;
    } catch (e) { return false; }
  }

  function showView(id) {
    ["view-route", "view-trip", "view-dashboard"].forEach(function (v) {
      $(v).classList.toggle("hidden", v !== id);
    });
    window.scrollTo(0, 0);
  }

  function currentView() {
    var ids = ["view-route", "view-trip", "view-dashboard"];
    for (var i = 0; i < ids.length; i++) {
      if (!$(ids[i]).classList.contains("hidden")) return ids[i];
    }
    return "view-route";
  }

  // 안드로이드 폰의 뒤로가기 버튼이 앱 안에서 단계별로 동작하도록
  // 화면을 이동할 때마다 브라우저 방문 기록을 남긴다.
  function pushView(id) {
    showView(id);
    try { history.pushState({ view: id }, ""); } catch (e) { /* ignore */ }
  }

  function replaceView(id) {
    showView(id);
    try { history.replaceState({ view: id }, ""); } catch (e) { /* ignore */ }
  }

  // 배차 화면 -> 순번 목록으로 되돌아갈 때의 정리 작업
  function leaveDashboard() {
    stopAllTimers();
    stopAlarmSound();
    state.alarmOn = false;
    state.fired = {};
  }

  // 뒤로가기(폰 버튼 또는 화면 안 버튼)로 목적지가 정해졌을 때 실제 화면 전환
  function applyBackTarget(target) {
    if (target === "view-dashboard" && (!state.route || !state.trip)) target = "view-route";
    if (target === "view-trip" && !state.route) target = "view-route";

    if (target !== "view-dashboard") leaveDashboard();

    if (target === "view-trip") {
      renderTripList();
      showView("view-trip");
    } else if (target === "view-dashboard") {
      showView("view-dashboard");
    } else {
      showView("view-route");
    }
  }

  function showDashboard() {
    var route = state.route;
    var trip = state.trip;
    $("dashHeader").innerHTML =
      '<div class="dh-route">' + route.label + ' · ' + trip.trip + '번차' + (trip.subRoute ? ' (' + trip.subRoute + '번 운행)' : '') + '</div>' +
      '<div class="dh-sub">' + route.origin + ' ↔ ' + route.destination + ' · ' + dayCategoryLabel(state.dayCategory) + ' 시간표' +
      (function () {
        var kind = scheduleKindLabel(route, state.dayCategory);
        return kind ? '<br><span class="dh-kind">(' + kind + ')</span>' : '';
      })() + '</div>';
    renderScheduleList();
    updateNextDeparture();
    stopAllTimers();
    state.alarmOn = false;
    state.fired = {};
    // 전용 앱에서는 등록해둔 시스템 알람이 화면을 벗어나도 살아 있으므로
    // 실제 등록 상태를 읽어와 표시를 맞춘다
    if (hasNativeAlarm()) {
      try { state.alarmOn = window.AndroidAlarm.pendingCount() > 0; } catch (e) { /* ignore */ }
    }
    updateAlarmStatus();
  }

  function renderScheduleList() {
    var ul = $("scheduleList");
    ul.innerHTML = "";
    var now = new Date();
    state.trip.stops.forEach(function (s, idx) {
      var t = parseTimeToday(s.time);
      var li = document.createElement("li");
      li.dataset.idx = idx;
      if (t < now) li.classList.add("past");
      var noteHtml = s.note ? '<span class="sl-note">경유: ' + s.note + '</span>' : "";
      li.innerHTML =
        '<span class="sl-stop">' + s.stop + ' 출발' + noteHtml + '</span>' +
        '<span class="sl-time">' + formatTime(s.time) + '</span>';
      ul.appendChild(li);
    });
  }

  function getUpcomingIndex() {
    var now = new Date();
    var stops = state.trip.stops;
    for (var i = 0; i < stops.length; i++) {
      if (parseTimeToday(stops[i].time) >= now) return i;
    }
    return -1;
  }

  function updateNextDeparture() {
    var idx = getUpcomingIndex();
    var ul = $("scheduleList");
    Array.prototype.forEach.call(ul.children, function (li, i) {
      li.classList.toggle("next", i === idx);
      var t = parseTimeToday(state.trip.stops[i].time);
      li.classList.toggle("past", t < new Date() && i !== idx);
    });

    if (idx === -1) {
      $("ndStop").textContent = "오늘 남은 출발 없음";
      $("ndTime").textContent = "--:--";
      $("ndCountdown").textContent = "수고하셨습니다";
      return;
    }
    var s = state.trip.stops[idx];
    $("ndStop").textContent = s.stop + " 출발";
    $("ndTime").textContent = formatTime(s.time);
    var diffMs = parseTimeToday(s.time) - new Date();
    var diffMin = Math.floor(diffMs / 60000);
    var diffSec = Math.floor((diffMs % 60000) / 1000);
    if (diffMin < 0) diffMin = 0;
    if (diffSec < 0) diffSec = 0;
    $("ndCountdown").textContent = diffMin + "분 " + diffSec + "초 후";
  }

  // ---- Alarm scheduling ----

  function stopAllTimers() {
    state.timers.forEach(function (id) { clearTimeout(id); });
    state.timers = [];
  }

  // 전용 안드로이드 앱 안에서 실행 중인지 (있으면 시스템 알람을 쓸 수 있음)
  function hasNativeAlarm() {
    try {
      return !!(window.AndroidAlarm && window.AndroidAlarm.isAvailable());
    } catch (e) { return false; }
  }

  function scheduleAlarms() {
    stopAllTimers();
    if (!state.alarmOn) return;
    var leadMin = parseInt($("leadMinutes").value, 10);
    var now = new Date();

    // 전용 앱에서는 안드로이드 시스템 알람에 맡긴다.
    // 화면이 꺼져 있어도, 앱을 닫아도 정확한 시각에 울린다.
    if (hasNativeAlarm()) {
      var list = [];
      state.trip.stops.forEach(function (s) {
        var depTime = parseTimeToday(s.time);
        if (depTime - now <= 0) return;
        list.push({
          departAt: depTime.getTime(),
          stop: s.stop,
          departText: formatTime(s.time)
        });
      });
      var title = state.route.label + " " + state.trip.trip + "번차";
      try {
        window.AndroidAlarm.scheduleAll(JSON.stringify(list), leadMin, title);
      } catch (e) { /* 실패 시 아래 웹 타이머로 대체되지 않도록 조용히 무시 */ }
      return;
    }

    state.trip.stops.forEach(function (s, idx) {
      var depTime = parseTimeToday(s.time);
      var alarmTime = new Date(depTime.getTime() - leadMin * 60000);
      var delay = alarmTime - now;
      if (delay > 0 && !state.fired[idx]) {
        var tid = setTimeout(function () {
          fireAlarm(s, leadMin);
          state.fired[idx] = true;
        }, delay);
        state.timers.push(tid);
      }
    });
  }

  // ---- 폰 캘린더로 내보내기(.ics) ----
  // 이 화면이 꺼져 있어도 휴대폰이 직접 알려주도록, 출발 시각을 캘린더 일정으로 만든다.

  function icsEscape(text) {
    return String(text)
      .replace(/\\/g, "\\\\")
      .replace(/;/g, "\\;")
      .replace(/,/g, "\\,")
      .replace(/\r?\n/g, "\\n");
  }

  // ics 규격상 한 줄은 75바이트를 넘으면 안 되므로 접어준다.
  // 한글은 한 글자가 3바이트라 글자 중간이 잘리지 않게 바이트 기준으로 자른다.
  function icsFold(line) {
    var bytes = 0, out = "", buf = "";
    for (var i = 0; i < line.length; i++) {
      var ch = line[i];
      var chBytes = unescape(encodeURIComponent(ch)).length;
      if (bytes + chBytes > 72) {
        out += buf + "\r\n ";
        buf = "";
        bytes = 1;
      }
      buf += ch;
      bytes += chBytes;
    }
    return out + buf;
  }

  function icsStamp(d) {
    return d.getUTCFullYear() + pad2(d.getUTCMonth() + 1) + pad2(d.getUTCDate()) + "T" +
      pad2(d.getUTCHours()) + pad2(d.getUTCMinutes()) + pad2(d.getUTCSeconds()) + "Z";
  }

  function icsLocal(d) {
    return d.getFullYear() + pad2(d.getMonth() + 1) + pad2(d.getDate()) + "T" +
      pad2(d.getHours()) + pad2(d.getMinutes()) + "00";
  }

  function buildICS() {
    var route = state.route, trip = state.trip;
    var leadMin = parseInt($("leadMinutes").value, 10) || 10;
    var now = new Date();
    var stamp = icsStamp(now);
    var lines = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Geongik//Bus Dispatch Alarm//KO",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      "BEGIN:VTIMEZONE",
      "TZID:Asia/Seoul",
      "BEGIN:STANDARD",
      "DTSTART:19700101T000000",
      "TZOFFSETFROM:+0900",
      "TZOFFSETTO:+0900",
      "TZNAME:KST",
      "END:STANDARD",
      "END:VTIMEZONE"
    ];

    var count = 0;
    trip.stops.forEach(function (s, idx) {
      var start = parseTimeToday(s.time);
      if (start < now) return;          // 이미 지난 출발은 등록하지 않음
      var end = new Date(start.getTime() + 5 * 60000);
      var title = route.label + " " + trip.trip + "번차 · " + s.stop + " 출발";
      var desc = route.origin + " ↔ " + route.destination + " / " +
        dayCategoryLabel(state.dayCategory) + " 시간표" +
        (s.note ? " / 경유: " + s.note : "");
      lines.push("BEGIN:VEVENT");
      lines.push("UID:geongik-" + todayStr(now) + "-" + route.label.replace(/\s/g, "") + "-" + trip.trip + "-" + idx + "@geongik");
      lines.push("DTSTAMP:" + stamp);
      lines.push("DTSTART;TZID=Asia/Seoul:" + icsLocal(start));
      lines.push("DTEND;TZID=Asia/Seoul:" + icsLocal(end));
      lines.push("SUMMARY:" + icsEscape(title));
      lines.push("DESCRIPTION:" + icsEscape(desc));
      lines.push("BEGIN:VALARM");
      lines.push("TRIGGER:-PT" + leadMin + "M");
      lines.push("ACTION:DISPLAY");
      lines.push("DESCRIPTION:" + icsEscape(leadMin + "분 후 출발 · " + s.stop));
      lines.push("END:VALARM");
      lines.push("END:VEVENT");
      count++;
    });
    lines.push("END:VCALENDAR");

    return { text: lines.map(icsFold).join("\r\n") + "\r\n", count: count, leadMin: leadMin };
  }

  function exportICS() {
    if (!state.route || !state.trip) return;
    var built = buildICS();
    var status = $("icsStatus");
    if (built.count === 0) {
      status.textContent = "오늘 남은 출발이 없어 등록할 일정이 없습니다.";
      status.classList.remove("on");
      return;
    }
    var blob = new Blob([built.text], { type: "text/calendar;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = "geongik-" + todayStr(new Date()) + ".ics";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
    status.textContent = "남은 출발 " + built.count + "건을 " + built.leadMin +
      "분 전 알림으로 만들었습니다. 받은 파일을 눌러 캘린더에 추가하세요.";
    status.classList.add("on");
  }

  // ---- Alarm sound ----
  // 알림음은 취향 차이가 커서 기사님이 직접 고를 수 있게 여러 종류를 준비함.
  // 웹 오디오는 ±1.0이 최대치이고 넘기면 커지는 게 아니라 찌그러지기만 하므로,
  // 각 소리는 최대치를 넘지 않는 선에서 가장 크게 울리도록 맞춰져 있다.
  var REST_AFTER_SET = 1.6;   // 한 세트가 끝나고 다음 세트까지 쉬는 시간(초)
  var MAX_RING_MS = 180000;   // 안전장치: 3분 뒤 자동 정지
  var LS_SOUND_KEY = "geongik_sound_v1";

  var audioCtx = null;
  var masterGain = null;
  var ringTimer = null;
  var ringStopTimer = null;

  // 한 음을 만든다. partials로 배음을 섞어 음색을 결정.
  //   sustain: true  → 일정한 크기로 쭉 유지 (전자음/사이렌 계열)
  //   sustain: false → 친 뒤 서서히 사라짐 (차임벨/실로폰 계열)
  function playTone(ctx, start, opts) {
    var partials = opts.partials || [{ m: 1, a: 1 }];
    partials.forEach(function (p) {
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = opts.type || "sine";
      osc.frequency.setValueAtTime(opts.freq * p.m, start);
      if (opts.sweepTo) {
        osc.frequency.linearRampToValueAtTime(opts.sweepTo * p.m, start + opts.dur);
      }
      var vol = opts.vol * p.a;
      var attack = opts.attack || 0.01;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(vol, start + attack);
      if (opts.sustain) {
        gain.gain.setValueAtTime(vol, start + opts.dur - 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
      } else if (opts.sustainLevel) {
        // 종을 친 뒤 여운이 이어지는 형태.
        // 그냥 감쇠만 시키면 소리가 너무 작아지므로 일정 크기로 울림을 유지한다.
        // 높은 배음일수록 더 많이 줄여야 '땡그랑' 거리지 않고 부드럽게 남는다.
        var sus = vol * opts.sustainLevel / (1 + (p.m - 1) * 0.55);
        gain.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0002), start + attack + (opts.decayTime || 0.25));
        gain.gain.setValueAtTime(Math.max(sus, 0.0002), start + opts.dur - 0.18);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur);
      } else {
        // 종소리처럼 자연스럽게 감쇠 (높은 배음이 먼저 사라지게)
        gain.gain.exponentialRampToValueAtTime(0.0001, start + opts.dur / (1 + (p.m - 1) * 0.35));
      }
      osc.connect(gain);
      gain.connect(masterGain);
      osc.start(start);
      osc.stop(start + opts.dur + 0.05);
    });
  }

  var SOUND_PROFILES = {
    chime: {
      label: "차임벨 딩동 (가장 부드러움)",
      setDuration: 4.6,
      vibration: [500, 900, 500, 900, 500],
      play: function (ctx, t0) {
        // 딩- 동- 을 세 번. 종소리 배음이라 귀에 편안함.
        var bell = [{ m: 1, a: 1 }, { m: 2, a: 0.4 }, { m: 3, a: 0.16 }, { m: 4.2, a: 0.08 }];
        [0, 1.5, 3.0].forEach(function (off) {
          // 두 음이 겹치므로 합쳐도 최대치를 넘지 않도록 vol을 낮게 잡음
          playTone(ctx, t0 + off, { freq: 1318, vol: 0.38, dur: 1.35, partials: bell, attack: 0.006, sustainLevel: 0.75, decayTime: 0.2 });
          playTone(ctx, t0 + off + 0.45, { freq: 1046, vol: 0.38, dur: 1.5, partials: bell, attack: 0.006, sustainLevel: 0.75, decayTime: 0.2 });
        });
      }
    },
    marimba: {
      label: "실로폰 (맑고 순함)",
      setDuration: 4.2,
      vibration: [400, 500, 400, 500, 400],
      play: function (ctx, t0) {
        // 나무 타악기 느낌: 기본음 + 4배음, 짧게 통통 튀는 소리
        var wood = [{ m: 1, a: 1 }, { m: 4, a: 0.25 }, { m: 10, a: 0.06 }];
        [0, 0.55, 1.5, 2.05, 3.0, 3.55].forEach(function (off, i) {
          playTone(ctx, t0 + off, {
            freq: i % 2 === 0 ? 1568 : 1046,
            vol: 0.54, dur: 0.85, partials: wood, attack: 0.004,
            sustainLevel: 0.6, decayTime: 0.14
          });
        });
      }
    },
    softbeep: {
      label: "부드러운 전자음 (소리 큼)",
      setDuration: 4.4,
      vibration: [1200, 400, 1200, 400, 1200],
      play: function (ctx, t0) {
        // 삼각파는 사각파보다 배음이 훨씬 적어 덜 날카로움
        [0, 1.6, 3.2].forEach(function (off, i) {
          playTone(ctx, t0 + off, {
            type: "triangle", freq: i % 2 === 0 ? 1046 : 880,
            vol: 0.95, dur: 1.2, sustain: true, attack: 0.02
          });
        });
      }
    },
    beep: {
      label: "전자음 삐- (가장 큼·날카로움)",
      setDuration: 4.4,
      vibration: [1200, 400, 1200, 400, 1200],
      play: function (ctx, t0) {
        [0, 1.6, 3.2].forEach(function (off, i) {
          playTone(ctx, t0 + off, {
            type: "square", freq: i % 2 === 0 ? 2700 : 2100,
            vol: 0.98, dur: 1.2, sustain: true, attack: 0.008
          });
        });
      }
    }
  };

  function getSoundProfileKey() {
    var saved = localStorage.getItem(LS_SOUND_KEY);
    return SOUND_PROFILES[saved] ? saved : "chime";
  }

  function currentProfile() {
    return SOUND_PROFILES[getSoundProfileKey()];
  }

  function ensureAudioCtx() {
    if (!audioCtx) {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      masterGain = audioCtx.createGain();
      masterGain.gain.value = 1.0;
      masterGain.connect(audioCtx.destination);
    }
    // 브라우저가 오디오를 일시정지 시켜둔 경우 다시 켜기
    if (audioCtx.state === "suspended" && audioCtx.resume) audioCtx.resume();
    return audioCtx;
  }

  function playBeepSet() {
    try {
      var ctx = ensureAudioCtx();
      currentProfile().play(ctx, ctx.currentTime);
    } catch (e) { /* audio unavailable */ }
  }

  function vibrateSet() {
    if (navigator.vibrate) navigator.vibrate(currentProfile().vibration);
  }

  function startAlarmSound() {
    stopAlarmSound();
    var cycleMs = (currentProfile().setDuration + REST_AFTER_SET) * 1000;
    playBeepSet();
    vibrateSet();
    ringTimer = setInterval(function () {
      playBeepSet();
      vibrateSet();
    }, cycleMs);
    ringStopTimer = setTimeout(stopAlarmSound, MAX_RING_MS);
  }

  function stopAlarmSound() {
    if (ringTimer) { clearInterval(ringTimer); ringTimer = null; }
    if (ringStopTimer) { clearTimeout(ringStopTimer); ringStopTimer = null; }
    if (navigator.vibrate) navigator.vibrate(0);
  }

  function fireAlarm(stop, leadMin) {
    $("alarmTitle").textContent = leadMin + "분 후 출발입니다!";
    $("alarmDetail").textContent = stop.stop + " 출발 · " + formatTime(stop.time);
    $("alarmOverlay").classList.remove("hidden");
    startAlarmSound();
    if (window.Notification && Notification.permission === "granted") {
      try {
        new Notification("경익운수 배차 알림 - " + leadMin + "분 전", {
          body: stop.stop + " 출발 · " + formatTime(stop.time),
          icon: "icon-192.png"
        });
      } catch (e) { /* ignore */ }
    }
  }

  function updateAlarmStatus() {
    var elStatus = $("alarmStatus");
    var elBtn = $("enableAlarmBtn");
    if (state.alarmOn) {
      elStatus.textContent = hasNativeAlarm()
        ? "폰 알람으로 등록됨 (" + $("leadMinutes").value + "분 전) · 화면이 꺼져도 울립니다"
        : "알림이 켜져 있습니다 (" + $("leadMinutes").value + "분 전 알림)";
      elStatus.classList.add("on");
      elBtn.textContent = "🔕 알림 끄기";
    } else {
      elStatus.textContent = "알림이 꺼져 있습니다";
      elStatus.classList.remove("on");
      elBtn.textContent = "🔔 알림 켜기";
    }
  }

  function toggleAlarm() {
    if (!state.alarmOn) {
      if (window.Notification && Notification.permission === "default") {
        Notification.requestPermission();
      }
      state.alarmOn = true;
      scheduleAlarms();
    } else {
      state.alarmOn = false;
      stopAllTimers();
      if (hasNativeAlarm()) {
        try { window.AndroidAlarm.cancelAll(); } catch (e) { /* ignore */ }
      }
    }
    updateAlarmStatus();
  }

  // ---- wiring ----

  function init() {
    state.dayCategory = computeDayCategory();
    renderTopbar();
    Array.prototype.forEach.call(document.querySelectorAll(".day-tab"), function (btn) {
      btn.addEventListener("click", function () { setDayCategory(btn.dataset.day); });
    });

    // 화면 안의 뒤로가기 버튼도 폰의 뒤로가기와 똑같이 동작하도록 방문 기록을 되돌린다
    $("backToRoute").addEventListener("click", function () { history.back(); });
    $("backToRouteFromDash").addEventListener("click", function () { history.back(); });

    window.addEventListener("popstate", function (e) {
      // 알람이 울리는 중이면 뒤로가기는 우선 알람을 끄는 데 사용
      if (!$("alarmOverlay").classList.contains("hidden")) {
        stopAlarmSound();
        $("alarmOverlay").classList.add("hidden");
        try { history.pushState({ view: currentView() }, ""); } catch (err) { /* ignore */ }
        return;
      }
      var target = (e.state && e.state.view) || "view-route";
      applyBackTarget(target);
    });

    $("leadMinutes").addEventListener("change", function () {
      if (state.alarmOn) scheduleAlarms();
      updateAlarmStatus();
    });

    $("enableAlarmBtn").addEventListener("click", toggleAlarm);
    $("exportIcsBtn").addEventListener("click", exportICS);
    $("dismissAlarmBtn").addEventListener("click", function () {
      stopAlarmSound();
      $("alarmOverlay").classList.add("hidden");
    });

    $("testSoundBtn").addEventListener("click", function () {
      ensureAudioCtx();
      playBeepSet();
      vibrateSet();
    });

    // 알림음 선택 목록 구성
    var soundSel = $("soundProfile");
    Object.keys(SOUND_PROFILES).forEach(function (key) {
      var opt = document.createElement("option");
      opt.value = key;
      opt.textContent = SOUND_PROFILES[key].label;
      soundSel.appendChild(opt);
    });
    soundSel.value = getSoundProfileKey();
    soundSel.addEventListener("change", function () {
      localStorage.setItem(LS_SOUND_KEY, soundSel.value);
      // 고른 소리를 바로 들려줌
      ensureAudioCtx();
      var ringingNow = !$("alarmOverlay").classList.contains("hidden");
      if (ringingNow) {
        startAlarmSound();   // 지금 울리는 중이면 새 소리로 이어서 울림
      } else {
        playBeepSet();       // 평소에는 한 번만 미리듣기
      }
    });

    // 전용 안드로이드 앱에서는 시스템 알람을 쓰므로 웹 제약 안내문이 맞지 않는다
    if (hasNativeAlarm()) {
      document.body.classList.add("native-app");
      var disc = document.querySelector(".disclaimer");
      if (disc) {
        disc.textContent = "※ 이 앱은 휴대폰 시스템 알람을 사용합니다. " +
          "화면이 꺼져 있거나 앱을 닫아도 정해진 시각에 알람이 울립니다.";
      }
      var calDesc = document.querySelector(".cal-desc");
      if (calDesc) {
        calDesc.textContent = "이 앱에서는 위 알림만으로 충분합니다. " +
          "캘린더에도 함께 남기고 싶으면 아래 버튼을 누르세요.";
      }
    }

    renderRouteList();

    // 첫 화면(노선 목록)을 방문 기록의 시작점으로 삼는다
    replaceView("view-route");

    if (tryRestoreSelection()) {
      // 저장된 배차로 바로 들어가되, 뒤로가기가 순번 목록 -> 노선 목록 순으로
      // 단계별로 동작하도록 중간 기록을 쌓아둔다
      $("tripRouteTitle").textContent = "2. " + state.route.label + " 배차 순번(차번호)을 선택하세요";
      renderTripList();
      pushView("view-trip");
      showDashboard();
      pushView("view-dashboard");
    }

    setInterval(function () {
      renderTopbar();
      var newCat = computeDayCategory();
      if (newCat !== state.dayCategory) {
        state.dayCategory = newCat;
        renderRouteList();
      }
      if (state.route && state.trip) updateNextDeparture();
    }, 1000);

    if ("serviceWorker" in navigator && (location.protocol === "https:" || location.hostname === "localhost")) {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    }

    var deferredInstallPrompt = null;
    window.addEventListener("beforeinstallprompt", function (e) {
      e.preventDefault();
      deferredInstallPrompt = e;
      $("installBtn").classList.remove("hidden");
    });
    $("installBtn").addEventListener("click", function () {
      if (!deferredInstallPrompt) return;
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(function () {
        deferredInstallPrompt = null;
        $("installBtn").classList.add("hidden");
      });
    });
    window.addEventListener("appinstalled", function () {
      $("installBtn").classList.add("hidden");
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
