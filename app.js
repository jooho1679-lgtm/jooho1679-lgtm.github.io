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

  function getForceHolidayFlag() {
    try {
      var raw = localStorage.getItem(LS_HOLIDAY_KEY);
      if (!raw) return false;
      var obj = JSON.parse(raw);
      if (obj.date !== todayStr(new Date())) return false;
      return !!obj.value;
    } catch (e) { return false; }
  }

  function setForceHolidayFlag(val) {
    localStorage.setItem(LS_HOLIDAY_KEY, JSON.stringify({ date: todayStr(new Date()), value: val }));
  }

  function computeDayCategory() {
    if (getForceHolidayFlag()) return "holiday";
    var d = new Date().getDay();
    if (d === 0) return "holiday";
    if (d === 6) return "saturday";
    return "weekday";
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
    $("dayCategoryLabel").textContent = dayCategoryLabel(state.dayCategory);
  }

  function renderRouteList() {
    var container = $("routeList");
    container.innerHTML = "";
    sortedRoutes().forEach(function (route) {
      var trips = (route.schedules[state.dayCategory] || []);
      var btn = document.createElement("button");
      btn.className = "route-card";
      var jointBadge = route.joint ? '<div class="rc-joint">공동배차: ' + route.companies.join("·") + ' (경익 담당 차량만 표시)</div>' : "";
      btn.innerHTML =
        '<div class="rc-name">' + route.label + '</div>' +
        '<div class="rc-path">' + route.origin + ' ↔ ' + route.destination + ' · 경익 배차 ' + trips.length + '대</div>' +
        jointBadge;
      btn.addEventListener("click", function () { selectRoute(route); });
      container.appendChild(btn);
    });
  }

  function selectRoute(route) {
    state.route = route;
    $("tripRouteTitle").textContent = "2. " + route.label + " 배차 순번(차번호)을 선택하세요";
    renderTripList();
    showView("view-trip");
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
    showView("view-dashboard");
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
  }

  function showDashboard() {
    var route = state.route;
    var trip = state.trip;
    $("dashHeader").innerHTML =
      '<div class="dh-route">' + route.label + ' · ' + trip.trip + '번차' + (trip.subRoute ? ' (' + trip.subRoute + '번 운행)' : '') + '</div>' +
      '<div class="dh-sub">' + route.origin + ' ↔ ' + route.destination + ' · ' + dayCategoryLabel(state.dayCategory) + ' 시간표</div>';
    renderScheduleList();
    updateNextDeparture();
    stopAllTimers();
    state.alarmOn = false;
    state.fired = {};
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

  function scheduleAlarms() {
    stopAllTimers();
    if (!state.alarmOn) return;
    var leadMin = parseInt($("leadMinutes").value, 10);
    var now = new Date();
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

  // ---- Alarm sound ----
  // 한 번의 울림: 삐- 삐- 삐- (0.5초씩, 0.9초 간격) → 이후 잠시 쉬었다가 반복
  var BEEP_DURATION = 0.5;
  var BEEP_OFFSETS = [0, 0.9, 1.8];
  var RING_CYCLE_MS = 4000;   // 울림 한 세트가 끝나고 다음 세트까지의 간격
  var MAX_RING_MS = 180000;   // 안전장치: 3분 뒤 자동 정지

  var audioCtx = null;
  var masterGain = null;
  var ringTimer = null;
  var ringStopTimer = null;

  // 음량 메모:
  // 웹 오디오는 ±1.0이 최대치이고 그 이상은 그냥 잘려나가(왜곡) 더 커지지 않는다.
  // 이전 버전은 여러 소리를 겹쳐 최대치를 1.29까지 넘겨서, 커지는 대신 찌그러지기만 했다.
  // 같은 최대치에서 평균 음량이 가장 큰 파형은 '사각파'이므로,
  // 사각파 하나를 왜곡 없이 최대치(0.98)로 내보내는 것이 소프트웨어로 낼 수 있는 가장 큰 소리다.
  // 휴대폰 스피커는 저음이 잘 안 나오므로 주파수는 스피커 효율이 좋은 2~3kHz 대역을 사용.
  var BEEP_VOLUME = 0.98;
  var BEEP_FREQS = [2700, 2100];   // 번갈아 울려서 '삐뽀삐뽀' 형태로 주의를 끔

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
      var now = ctx.currentTime;
      BEEP_OFFSETS.forEach(function (offset, i) {
        var start = now + offset;
        var end = start + BEEP_DURATION;
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = BEEP_FREQS[i % BEEP_FREQS.length];
        // 딸깍 소리를 막을 만큼만 짧게 올리고 내림 → 나머지 구간은 계속 최대 음량 유지
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(BEEP_VOLUME, start + 0.008);
        gain.gain.setValueAtTime(BEEP_VOLUME, end - 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain);
        gain.connect(masterGain);
        osc.start(start);
        osc.stop(end + 0.02);
      });
    } catch (e) { /* audio unavailable */ }
  }

  function vibrateSet() {
    if (navigator.vibrate) navigator.vibrate([600, 300, 600, 300, 600]);
  }

  function startAlarmSound() {
    stopAlarmSound();
    playBeepSet();
    vibrateSet();
    ringTimer = setInterval(function () {
      playBeepSet();
      vibrateSet();
    }, RING_CYCLE_MS);
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
      elStatus.textContent = "알림이 켜져 있습니다 (" + $("leadMinutes").value + "분 전 알림)";
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
    }
    updateAlarmStatus();
  }

  // ---- wiring ----

  function init() {
    state.dayCategory = computeDayCategory();
    renderTopbar();
    $("forceHolidayChk").checked = getForceHolidayFlag();

    $("forceHolidayChk").addEventListener("change", function (e) {
      setForceHolidayFlag(e.target.checked);
      state.dayCategory = computeDayCategory();
      renderTopbar();
      renderRouteList();
      if (state.route) renderTripList();
    });

    $("backToRoute").addEventListener("click", function () { showView("view-route"); });
    $("backToRouteFromDash").addEventListener("click", function () {
      stopAllTimers();
      state.alarmOn = false;
      showView("view-route");
    });

    $("leadMinutes").addEventListener("change", function () {
      if (state.alarmOn) scheduleAlarms();
      updateAlarmStatus();
    });

    $("enableAlarmBtn").addEventListener("click", toggleAlarm);
    $("dismissAlarmBtn").addEventListener("click", function () {
      stopAlarmSound();
      $("alarmOverlay").classList.add("hidden");
    });

    $("testSoundBtn").addEventListener("click", function () {
      ensureAudioCtx();
      playBeepSet();
      vibrateSet();
    });

    renderRouteList();

    if (tryRestoreSelection()) {
      showDashboard();
      showView("view-dashboard");
    } else {
      showView("view-route");
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
