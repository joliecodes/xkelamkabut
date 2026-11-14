/* xkelamkabut — step 1: itinerary */
(() => {
  const KEY = 'xkk-trip-v1';
  const TYPES = {
    activity:  { label: 'Activity',  desc: 'Beach, sights, things to do',   c: '#2a8c95', bg: '#eaf5f5' },
    meal:      { label: 'Meal',      desc: 'Breakfast, lunch, dinner, snacks', c: '#e07a5f', bg: '#fcefea' },
    rest:      { label: 'Rest',      desc: 'Hotel, nap, downtime',          c: '#9a6fb0', bg: '#f3edf7' },
    transport: { label: 'Transport', desc: 'Flights, Grab, transfers',      c: '#5b7fa6', bg: '#ecf1f7' },
    other:     { label: 'Other',     desc: 'Shopping, errands, anything else', c: '#c4902e', bg: '#fbf4e4' },
  };
  const icon = name => `<svg class="ico"><use href="#i-${name}"/></svg>`;
  const FIRST_HOUR = 0, LAST_HOUR = 24;   // full day, 12 am to 12 am
  const HOUR_PX = 88;       // height of one hour on the timeline
  const DEFAULT_MIN = 30;   // items without an end time show as 30 min
  const toMin = hm => { const [h, m] = hm.split(':').map(Number); return h * 60 + m; };
  const fromMin = m => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

  const $ = s => document.querySelector(s);
  const uid = () => Math.random().toString(36).slice(2, 9);

  /* ---------- storage ---------- */
  const store = {
    load() { try { return JSON.parse(localStorage.getItem(KEY)); } catch (e) { return null; } },
    save(v) { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch (e) {} },
  };

  const it = (type, start, title, extra = {}) => ({ id: uid(), type, start, end: '', title, maps: '', notes: '', ...extra });
  const SAMPLE = {
    title: 'Example: Phu Quoc',
    days: [
      { id: uid(), date: '2026-11-30', label: 'Arrive', items: [
        it('transport', '13:35', 'Land in Phu Quoc', { notes: 'AK 545' }),
        it('transport', '14:15', 'Grab to hotel'),
        it('rest', '15:00', 'Check in', { maps: 'https://www.google.com/maps/search/?api=1&query=Sunday+Boutique+Hotel+Khem+Beach+Phu+Quoc' }),
        it('meal', '15:30', 'Snack'),
        it('activity', '16:00', 'Beach till sunset'),
        it('meal', '18:30', 'Dinner'),
      ]},
      { id: uid(), date: '2026-12-01', label: 'Beach + Sunset Town', items: [
        it('meal', '08:00', 'Breakfast'),
        it('activity', '09:00', 'Beach'),
        it('meal', '12:00', 'Lunch'),
        it('rest', '13:30', 'Hotel'),
        it('transport', '16:00', 'Grab to Sunset Town'),
        it('activity', '16:30', 'Explore Sunset Town'),
        it('meal', '17:30', 'Dinner'),
        it('activity', '18:30', 'Vui Fest night market', { notes: 'Open 4 pm – midnight' }),
      ]},
      { id: uid(), date: '2026-12-02', label: 'Free & easy', items: [
        it('meal', '08:00', 'Breakfast'),
        it('other', '09:00', 'Free & easy'),
        it('meal', '12:00', 'Lunch'),
        it('other', '13:30', 'Shopping + Treats'),
        it('rest', '14:30', 'Hotel'),
        it('activity', '15:30', 'Beach till sunset'),
        it('rest', '18:00', 'Hotel'),
        it('meal', '19:00', 'Dinner'),
      ]},
      { id: uid(), date: '2026-12-03', label: 'Fly home', items: [
        it('meal', '08:00', 'Breakfast'),
        it('rest', '10:00', 'Pack up'),
        it('rest', '11:00', 'Check out'),
        it('transport', '11:30', 'Grab to airport'),
        it('meal', '12:30', 'Lunch'),
        it('transport', '14:10', 'Departure', { notes: 'AK 546' }),
      ]},
    ],
  };

  /* ---------- trips database ---------- */
  // v2 keeps every trip in one record. The old single-trip key is read once
  // (to carry over existing data) and never deleted.
  const DBKEY = 'xkk-db-v2';
  const PALETTE = [['#2a8c95', '#eaf5f5'], ['#e07a5f', '#fcefea'], ['#5b7fa6', '#ecf1f7'], ['#9a6fb0', '#f3edf7'], ['#c4902e', '#fbf4e4'], ['#6a9e5b', '#eef5ea']];
  const normTrip = (t, i) => {
    t.id ||= uid();
    if (t.color == null) t.color = i % PALETTE.length;
    t.days ||= [];
    t.packing ||= {};
    if (!t.packing.travelers) {
      // older lists: categories go to "Me"; traveller sections become their own tab
      const old = t.packing.sections || [];
      const me = { id: uid(), name: 'Me', sections: old.filter(s => s.kind !== 'traveler').map(s => ({ id: s.id, name: s.name, items: s.items })) };
      const others = old.filter(s => s.kind === 'traveler').map(s => ({ id: uid(), name: s.name, sections: s.items.length ? [{ id: uid(), name: 'General', items: s.items }] : [] }));
      t.packing = { travelers: [me, ...others], cur: me.id };
    }
    t.bookings ||= [];
    return t;
  };
  function loadDb() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem(DBKEY)); } catch (e) {}
    if (!d || !Array.isArray(d.trips)) {
      const old = store.load();
      d = { trips: [old || structuredClone(SAMPLE)], current: null };
    }
    d.trips.forEach(normTrip);
    if (!d.trips.some(t => t.id === d.current)) d.current = d.trips[0]?.id || null;
    return d;
  }
  let db = loadDb();
  // One-time: flights used to make two items (take-off + landing); relink as one block
  if (!db.flightBlocks) {
    db.flightBlocks = true;
    db.__relink = db.trips.flatMap(t => t.bookings.filter(b => b.kind === 'flight' && b.itemIds?.length).map(b => [t.id, b.id]));
  }
  let trip = db.trips.find(t => t.id === db.current);
  let cur = 0;
  const save = () => { try { localStorage.setItem(DBKEY, JSON.stringify(db)); } catch (e) {} };
  save();

  /* ---------- helpers ---------- */
  const fmtDate = (iso, opts) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', opts) : '';
  const fmtTime = hm => {
    if (!hm) return '';
    let [h, m] = hm.split(':').map(Number);
    const ap = h < 12 ? 'am' : 'pm'; h = h % 12 || 12;
    return `${h}:${String(m).padStart(2, '0')} ${ap}`;
  };
  const fmtHour = h => `${h % 12 || 12} ${h < 12 || h === 24 ? 'am' : 'pm'}`;
  const localISO = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const addDays = (iso, n) => { const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + n); return localISO(d); };
  const todayISO = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const toast = msg => { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove('on'), 1500); };

  /* ---------- header ---------- */
  function renderHeader() {
    const onTrips = currentView() === 'trips';
    $('#tripTitle').contentEditable = String(!onTrips);
    $('#kicker').textContent = onTrips ? 'xkelamkabut' : 'xkelamkabut · trip';
    if (onTrips) {
      $('#tripTitle').textContent = 'My trips';
      $('#tripDates').textContent = `${db.trips.length} trip${db.trips.length === 1 ? '' : 's'}`;
      document.title = 'xkelamkabut';
      return;
    }
    $('#tripTitle').textContent = trip.title || 'My trip';
    const ds = trip.days.map(d => d.date).filter(Boolean).sort();
    $('#tripDates').textContent = ds.length
      ? `${fmtDate(ds[0], { day: 'numeric', month: 'short' })} – ${fmtDate(ds.at(-1), { day: 'numeric', month: 'short', year: 'numeric' })} · ${trip.days.length} day${trip.days.length > 1 ? 's' : ''}`
      : 'Tap + Add Day to start';
    document.title = `${trip.title} · xkelamkabut`;
  }
  $('#tripTitle').addEventListener('blur', e => { if (currentView() === 'trips') return; trip.title = e.target.textContent.trim() || 'My trip'; save(); renderHeader(); });
  $('#tripTitle').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur(); } });

  /* ---------- day tabs ---------- */
  function renderDays() {
    const wrap = $('#days'); wrap.innerHTML = '';
    trip.days.forEach((d, i) => {
      const b = document.createElement('button');
      b.className = i === cur ? 'on' : '';
      b.innerHTML = d.date
        ? `<b>Day ${i + 1}</b><span>${fmtDate(d.date, { weekday: 'short' })}</span><em>${fmtDate(d.date, { month: 'short' })} ${fmtDate(d.date, { day: 'numeric' })}</em>`
        : `<b>Day ${i + 1}</b><span>—</span>`;
      b.onclick = () => changeDay(i);
      wrap.appendChild(b);
    });
    const add = document.createElement('button');
    add.className = 'add'; add.textContent = '+ Add Day';
    add.onclick = addDay;
    wrap.appendChild(add);
    wrap.querySelector('.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });
  }

  function addDay() {
    const last = trip.days.at(-1);
    trip.days.push({ id: uid(), date: last?.date ? addDays(last.date, 1) : todayISO(), label: '', items: [] });
    cur = trip.days.length - 1; save(); render(); scrollToStart();
    toast(`Day ${cur + 1} added`);
  }

  /* ---------- hour grid ---------- */
  function renderGrid() {
    const head = $('#dayhead'), grid = $('#grid');
    const day = trip.days[cur];
    if (!day) {
      head.innerHTML = '';
      grid.innerHTML = `<div class="empty"><div class="big">${icon('calendar')}</div><p><b>No days yet</b></p><p class="muted">Tap + Add Day to begin.</p></div>`;
      return;
    }
    head.innerHTML = `<div><h2>${day.date ? fmtDate(day.date, { weekday: 'long', day: 'numeric', month: 'short' }) : `Day ${cur + 1}`}</h2>
      <div class="sub">Day ${cur + 1}${day.label ? ' · ' + esc(day.label) : ''}</div></div>
      <button aria-label="Edit day" id="dayOpts" class="round">${icon('edit')}</button>`;
    $('#dayOpts').onclick = openDayMenu;

    // Timeline: items placed by start/end, like a calendar app
    const items = day.items.map(x => {
      const s = toMin(x.start);
      let e = x.end ? toMin(x.end) : s + DEFAULT_MIN;
      if (e <= s) e = s + DEFAULT_MIN;
      return { x, s, e };
    }).sort((a, b) => a.s - b.s || b.e - a.e);

    const from = Math.min(FIRST_HOUR, ...items.map(i => Math.floor(i.s / 60)));
    const to = Math.max(LAST_HOUR, ...items.map(i => Math.ceil(i.e / 60)));
    const y = min => (min - from * 60) / 60 * HOUR_PX;

    grid.innerHTML = '';
    grid.style.height = `${(to - from) * HOUR_PX + 12}px`;

    // hour + half-hour lines
    for (let h = from; h <= to; h++) {
      const line = document.createElement('div');
      line.className = 'hl'; line.style.top = `${y(h * 60)}px`;
      line.innerHTML = `<span>${h < to || h === 24 ? fmtHour(h) : fmtHour(h)}</span>`;
      grid.appendChild(line);
      if (h < to) {
        const half = document.createElement('div');
        half.className = 'hh'; half.style.top = `${y(h * 60 + 30)}px`;
        grid.appendChild(half);
      }
    }

    // lane catches taps on empty space → snap to nearest half hour above
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.addEventListener('click', e => {
      if (e.target !== lane) return;
      const r = lane.getBoundingClientRect();
      const min = from * 60 + Math.floor(((e.clientY - r.top) / HOUR_PX * 60) / 30) * 30;
      openDrawer(null, fromMin(Math.min(min, 23 * 60 + 30)));
    });
    grid.appendChild(lane);

    gridFrom = from;
    // Shorter items sit on top of longer ones, shifted in; items that start together go side by side
    layoutNested(items).forEach(({ x, s, e, col, cols, depth, kids, room }) => {
      const el = itemEl(x, s, e, { cols, depth, kids, room });
      const inset = depth * INDENT;
      el.style.top = `${y(s) + 1}px`;
      el.style.height = `${Math.max((e - s) / 60 * HOUR_PX - 3, 22)}px`;
      el.style.left = `calc(${inset}px + (100% - ${inset}px) * ${col / cols} + ${col ? 2 : 0}px)`;
      el.style.width = `calc((100% - ${inset}px) / ${cols} - ${cols > 1 ? 2 : 0}px)`;
      el.style.zIndex = 1 + depth * 2;
      lane.appendChild(el);
    });
    maybeHoldTip(day);

    // current time line
    if (day.date === todayISO()) {
      const n = new Date(), m = n.getHours() * 60 + n.getMinutes();
      if (m >= from * 60 && m <= to * 60) {
        const now = document.createElement('div');
        now.className = 'now'; now.style.top = `${y(m)}px`;
        grid.appendChild(now);
      }
    }
  }

  const INDENT = 26;
  let gridFrom = 0;
  // Depth: how many longer items an item sits on top of (it starts at least 30 min into them)
  function layoutNested(items) {
    const placed = [];
    items.forEach(it => {
      it.depth = 0; it.kids = false; it.room = null;
      placed.forEach(p => { if (p.s <= it.s - 30 && p.e > it.s && p.depth + 1 > it.depth) it.depth = p.depth + 1; });
      placed.forEach(p => { if (p.s <= it.s - 30 && p.e > it.s) { p.kids = true; p.room = Math.min(p.room ?? 1e9, it.s - p.s); } });
      placed.push(it);
    });
    // within each depth, overlapping items share the width
    const out = [];
    [...new Set(items.map(i => i.depth))].forEach(d => out.push(...layoutColumns(items.filter(i => i.depth === d))));
    return out;
  }
  /* ---------- hold a block: lift it, drag to move, or let go for quick actions ---------- */
  let noClickUntil = 0;
  const HOLD_MS = 450;
  function attachHold(el, x, s, e) {
    let timer = null, lifted = false, dragging = false, sx = 0, sy = 0, sScroll = 0, ns = s, ghost = null, line = null, raf = 0, lastY = 0;
    // tickets (flights, trains, buses, ferries) are fixed; check-in/out and car hire can move
    const dur = e - s, linked = !!x.bookingId && x.type === 'transport' && x.mode !== 'car';
    const lane = () => el.parentElement;
    const yOf = m => (m - gridFrom * 60) / 60 * HOUR_PX;
    const minAt = clientY => { const r = lane().getBoundingClientRect(); return gridFrom * 60 + (clientY - r.top) / HOUR_PX * 60; };
    const reset = () => {
      clearTimeout(timer); timer = null; cancelAnimationFrame(raf);
      el.classList.remove('lifted', 'dragging'); $('#grid').classList.remove('holding');
      ghost?.remove(); line?.remove(); ghost = line = null; lifted = dragging = false;
    };
    const showLine = clientY => {
      const m = Math.max(0, Math.min(23 * 60 + 30, Math.floor(minAt(clientY) / 30) * 30));
      if (!line) { line = document.createElement('div'); line.className = 'pressline'; lane().appendChild(line); }
      line.style.top = `${yOf(m)}px`; line.innerHTML = `<span>${fmtTime(fromMin(m))}</span>`; line.dataset.m = m;
    };
    el.addEventListener('pointerdown', ev => {
      if (ev.button > 0 || ev.target.closest('.map')) return;
      sx = ev.clientX; sy = lastY = ev.clientY; sScroll = scrollY;
      timer = setTimeout(() => {
        lifted = true; navigator.vibrate?.(12);
        el.classList.add('lifted'); $('#grid').classList.add('holding');
        ghost = document.createElement('div'); ghost.className = 'ghost';
        Object.assign(ghost.style, { top: el.style.top, height: el.style.height, left: el.style.left, width: el.style.width });
        lane().insertBefore(ghost, el);
        showLine(sy);
        try { el.setPointerCapture(ev.pointerId); } catch (_) {}
      }, HOLD_MS);
    });
    // after the hold, the page must not scroll under your finger
    el.addEventListener('touchmove', ev => { if (lifted) ev.preventDefault(); }, { passive: false });
    el.addEventListener('contextmenu', ev => ev.preventDefault());
    el.addEventListener('pointermove', ev => {
      lastY = ev.clientY;
      if (!lifted) { if (timer && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 8) { clearTimeout(timer); timer = null; } return; }
      if (!dragging && Math.abs(ev.clientY - sy) > 6) {
        if (linked) { toast('Move this one in Bookings'); reset(); noClickUntil = Date.now() + 400; return; }
        dragging = true; line?.remove(); line = null; el.classList.add('dragging');
        const tick = () => {   // scroll the page when dragging near the top or bottom
          const edge = lastY < 170 ? -8 : lastY > innerHeight - 110 ? 8 : 0;
          if (edge) { scrollBy(0, edge); move(); }
          raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
      }
      if (dragging) move();
    });
    const move = () => {
      const dy = lastY - sy + (scrollY - sScroll);
      ns = Math.max(0, Math.min(1440 - dur, Math.round((s + dy / HOUR_PX * 60) / 15) * 15));
      el.style.top = `${yOf(ns) + 1}px`;
      el.querySelector('.m').textContent = fmtTime(fromMin(ns)) + (x.end ? ' – ' + fmtTime(fromMin(ns + dur)) : '');
    };
    const end = ev => {
      if (!timer && !lifted) return;
      const wasLifted = lifted, wasDragging = dragging, at = line ? +line.dataset.m : null;
      if (wasLifted) noClickUntil = Date.now() + 400;
      reset();
      if (!wasLifted || ev.type === 'pointercancel') return;
      localStorage.setItem('xkk-tip-hold', '1'); $('#holdTip')?.remove();
      if (wasDragging) {
        if (ns !== s) { x.start = fromMin(ns); if (x.end) x.end = fromMin(ns + dur); save(); }
        renderGrid();
        const moved = $(`#grid .item[data-id="${x.id}"]`); moved?.classList.add('settle');
        return;
      }
      openItemMenu(x, at ?? s);
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
  }
  function openItemMenu(x, at) {
    const m = $('#itemMenu');
    $('#imTitle').textContent = x.title;
    $('#imAdd').innerHTML = `${icon('plus')}Add item at ${fmtTime(fromMin(at))}`;
    $('#imAdd').onclick = () => { hide(); setTimeout(() => openDrawer(null, fromMin(at)), 180); };
    $('#imEdit').innerHTML = `${icon('edit')}Edit ${esc(x.title)}`;
    $('#imEdit').onclick = () => { hide(); setTimeout(() => openDrawer(x), 180); };
    const del = $('#imDel'); del.dataset.armed = ''; del.innerHTML = `${icon('x')}Delete`;
    del.onclick = () => {
      if (!del.dataset.armed) { del.dataset.armed = '1'; del.innerHTML = `${icon('x')}Tap again to delete`; return; }
      const day = trip.days[cur]; day.items = day.items.filter(i => i !== x);
      save(); hide(); renderGrid(); toast('Deleted');
    };
    show('#itemMenu');
  }
  // One-time tip so people know holding a block does something
  function maybeHoldTip(day) {
    if (!day.items.length || localStorage.getItem('xkk-tip-hold') || $('#holdTip')) return;
    const t = document.createElement('div'); t.id = 'holdTip'; t.className = 'holdtip';
    t.innerHTML = `<span><b>Tip:</b> hold a block to add over it, edit, delete or drag it.</span><button type="button">Got it</button>`;
    t.querySelector('button').onclick = () => { localStorage.setItem('xkk-tip-hold', '1'); t.remove(); };
    document.body.appendChild(t);
  }

  // Group overlapping items into clusters, then give each a column
  function layoutColumns(items) {
    const out = []; let cluster = [], clusterEnd = -1;
    const flush = () => {
      const colsEnd = [];
      cluster.forEach(it => {
        let c = colsEnd.findIndex(end => end <= it.s);
        if (c === -1) { c = colsEnd.length; colsEnd.push(it.e); } else colsEnd[c] = it.e;
        it.col = c;
      });
      cluster.forEach(it => { it.cols = colsEnd.length; out.push(it); });
      cluster = []; clusterEnd = -1;
    };
    items.forEach(it => {
      if (cluster.length && it.s >= clusterEnd) flush();
      cluster.push(it); clusterEnd = Math.max(clusterEnd, it.e);
    });
    if (cluster.length) flush();
    return out;
  }

  // Transport blocks show what they are: plane, train, bus, ferry or car
  const modeIcon = x => x.type !== 'transport' ? '' : x.mode ? ({ flight: 'plane', car: 'car', train: 'train', bus: 'bus', ferry: 'ferry' })[x.mode] : x.flight ? 'plane' : '';
  // Blocks with room for more than the title and time show the start of the notes
  function noteLines(x, mins) {
    if (!x.notes || mins <= 30) return '';
    if (mins < 60) return `<div class="nt" style="-webkit-line-clamp:1">${esc(x.notes)}</div>`;
    const n = Math.floor((mins * HOUR_PX / 60 - 66) / 19);
    return n >= 1 ? `<div class="nt" style="-webkit-line-clamp:${Math.min(n, 8)}">${esc(x.notes)}</div>` : '';
  }
  // Clock change from the two airports' time zones when known (fixes flights saved with a misread flight time)
  function liveFlight(x) {
    const f = x.flight, a = AIRPORT_TZ[(f.from || '').toUpperCase()], b = AIRPORT_TZ[(f.to || '').toUpperCase()];
    if (a == null || b == null || !f.arrTime || !x.start) return f;
    let wall = toMin(f.arrTime) - toMin(x.start);
    if (f.arrDate || wall < 0) wall += 1440;
    const shift = (b - a) * 60;
    return { ...f, shift, dur: wall - shift };
  }
  function itemEl(x, s, e, lay = {}) {
    const T = TYPES[x.type] || TYPES.other;
    const typeKey = TYPES[x.type] ? x.type : 'other';
    const mins = e - s, cols = lay.cols || 1;
    const el = document.createElement('div');
    // 31–59 min with notes: title and time on one row so a line of notes fits under them
    el.className = 'item' + (mins <= 30 || (mins < 60 && x.notes && cols === 1) ? ' short' : '') + (mins <= 30 ? '' : mins < 60 && x.notes && cols === 1 ? ' oneline' : '') + (mins >= 90 ? ' tall' : '')
      + (cols > 1 ? ' narrow' : '') + (cols > 2 ? ' tiny' : '') + (lay.depth ? ' nested' : '') + (lay.kids ? ' has-kids' : '');
    el.dataset.id = x.id;
    const hasMap = !undecided(x) && !!effLoc(x), fw = (x.notes ? 22 : 0) + (undecided(x) ? 84 : hasMap ? 66 : 0);
    if (fw) el.style.setProperty('--fw', fw + 8 + 'px');
    el.style.setProperty('--c', T.c); el.style.setProperty('--bg', T.bg);
    el.innerHTML = `<div class="ic">${icon(modeIcon(x) || typeKey)}</div>
      <div class="body"><div class="t">${esc(x.title)}</div>
      <div class="m">${x.flight ? flightMeta(x) : fmtTime(x.start) + (x.end ? ' – ' + fmtTime(x.end) : '')}</div>${cols > 1 ? '' : noteLines(x, lay.room ?? mins)}</div>
      <div class="flags">${x.notes ? `<span title="Has notes">${icon('note')}</span>` : ''}${undecided(x) ? `<span class="optpill">${x.options.length} options</span>` : mapLink(effLoc(x), 'Map ↗', 'map')}</div>`;
    el.addEventListener('click', ev => { if (Date.now() < noClickUntil) return; if (!ev.target.closest('.map')) openView(x); });
    attachHold(el, x, s, e);
    return el;
  }

  // "12:45 pm KUL – 1:35 pm PQC · 1h 50m · clocks go back 1 hr"
  function flightMeta(x) {
    const f = liveFlight(x), code = c => c ? ` <span class="tz">${esc(c)}</span>` : '';
    const arr = f.arrTime ? `${fmtTime(f.arrTime)}${code(f.to)}${f.arrDate ? ` <span class="tz">${esc(fmtDate(f.arrDate, { day: 'numeric', month: 'short' }))}</span>` : ''}` : '';
    return [`${fmtTime(x.start)}${code(f.from)}${arr ? ' – ' + arr : ''}`, f.dur != null && f.dur > 0 ? fmtDur(f.dur) : '', shiftText(f.shift)].filter(Boolean).join(' · ');
  }

  /* ---------- view item ---------- */
  let viewing = null;
  function openView(x) {
    if (viewing !== x) deciding = false;
    viewing = x;
    const k = TYPES[x.type] ? x.type : 'other', T = TYPES[k];
    const d = $('#viewDrawer');
    d.style.setProperty('--c', T.c); d.style.setProperty('--bg', T.bg);
    $('#vBadge').innerHTML = icon(modeIcon(x) || k);
    $('#vType').textContent = T.label;
    $('#vTitle').textContent = x.title;
    if (x.flight) {
      const f = liveFlight(x);
      const air = !x.mode || x.mode === 'flight', len = f.dur > 0 ? fmtDur(f.dur) + (air ? ' flight' : ' journey') : '';
      $('#vTime').innerHTML = `<b>Departs</b> ${fmtTime(x.start)}${f.from ? ` ${esc(f.from)} time` : ''}`
        + (f.arrTime ? `<br><b>${air ? 'Lands' : 'Arrives'}</b> ${fmtTime(f.arrTime)}${f.to ? ` ${esc(f.to)} time` : ''}${f.arrDate ? ', ' + esc(fmtDate(f.arrDate, { weekday: 'short', day: 'numeric', month: 'short' })) : ''}` : '')
        + ([len, shiftText(f.shift)].filter(Boolean).length ? `<br><span class="muted">${[len, shiftText(f.shift)].filter(Boolean).join(' · ')}</span>` : '');
    } else $('#vTime').textContent = fmtTime(x.start) + (x.end ? ' – ' + fmtTime(x.end) : '');
    $('#vNotesRow').hidden = !x.notes;
    $('#vNotes').textContent = x.notes || '';
    const loc = effLoc(x), p = loc?.place;
    $('#vPlaceRow').hidden = !p;
    if (p) $('#vPlace').innerHTML = `<b>${esc(p.name)}</b>${p.address ? `<small>${esc(p.address)}</small>` : ''}`;
    renderViewOptions(x);
    $('#vLinks').innerHTML = mapLink(loc, 'Open in Maps ↗', 'btn primary');
    $('#vLinks').hidden = !$('#vLinks').innerHTML;
    $('#vAddDuring').innerHTML = `${icon('plus')}Add an item during ${esc(x.title)}`;
    $('#vAddDuring').onclick = () => { hide(); setTimeout(() => openDrawer(null, x.start), 180); };
    show('#viewDrawer');
  }
  $('#vEdit').onclick = () => openDrawer(viewing);

  // Options in the view drawer: pills (tap = open maps), Decide, Other options
  let deciding = false;
  function renderViewOptions(x) {
    const opts = x.options || [], picked = opts.find(o => o.id === x.decided);
    $('#vOpts').hidden = !opts.length || !!picked;
    $('#vOther').hidden = !picked || opts.length < 2;
    if (!opts.length) return;
    if (!picked) {
      $('#vOptsLabel').textContent = deciding ? 'Tap the one you picked' : 'Options · tap to open in maps';
      $('#vPills').classList.toggle('deciding', deciding);
      $('#vPills').innerHTML = opts.map(o => deciding
        ? `<button type="button" data-id="${o.id}"><span>${esc(o.name)}</span><i>✓</i></button>`
        : mapLink(o, `<span>${esc(o.name)}</span><i>↗</i>`, '')).join('');
      $('#vPills').querySelectorAll('button').forEach(b => b.onclick = () => {
        x.decided = b.dataset.id; deciding = false; save(); renderGrid(); openView(x); toast('Decided!');
      });
      $('#vDecide').textContent = deciding ? 'Cancel' : 'Decide';
    } else {
      const others = opts.filter(o => o !== picked);
      $('#vOtherSum').textContent = `Other options (${others.length})`;
      $('#vOtherPills').innerHTML = others.map(o => mapLink(o, `<span>${esc(o.name)}</span><i>↗</i>`, '')).join('');
      $('#vOther').open = false;
    }
  }
  $('#vDecide').onclick = () => { deciding = !deciding; renderViewOptions(viewing); };
  $('#vChange').onclick = () => { viewing.decided = null; deciding = true; save(); renderGrid(); openView(viewing); };

  /* ---------- item drawer ---------- */
  const form = $('#itemForm');
  let editing = null, pickedType = 'activity', pendingStart = '';
  const PLACEHOLDER = { activity: 'Activity', meal: 'Meal', rest: 'Rest', transport: 'Transport', other: 'Other' };
  const DEFAULT_TITLE = PLACEHOLDER;
  const OPT_TYPES = new Set(['meal', 'activity']);   // types that can list options   // used when the title is left empty

  // Step 1: card picker
  function renderCards() {
    const wrap = $('#cards'); wrap.innerHTML = '';
    Object.entries(TYPES).forEach(([k, T]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.style.setProperty('--c', T.c); b.style.setProperty('--bg', T.bg);
      b.innerHTML = `<span class="ci">${icon(k)}</span><span><b>${T.label}</b><small>${T.desc}</small></span>`;
      b.onclick = () => { pickedType = k; goStep2(); };
      wrap.appendChild(b);
    });
  }
  function goStep1() {
    $('#pickTitle').textContent = editing ? 'Change type' : `Add at ${fmtTime(pendingStart)}`;
    renderCards();
    $('#step1').classList.add('on'); $('#step2').classList.remove('on');
  }

  // Step 2: details form
  function goStep2() {
    const T = TYPES[pickedType];
    const badge = $('#badge');
    badge.style.setProperty('--c', T.c); badge.style.setProperty('--bg', T.bg);
    badge.innerHTML = icon(pickedType);
    $('#drawerTitle').textContent = `${editing ? 'Edit' : 'New'} ${T.label}`;
    form.title.placeholder = PLACEHOLDER[pickedType];
    suggestPlace();
    setOptsMode(OPT_TYPES.has(pickedType) && draftOpts.length > 0);
    $('#step2').classList.add('on'); $('#step1').classList.remove('on');
    if (!editing && !form.title.value) setTimeout(() => form.title.focus(), 120);
  }
  $('#back').onclick = goStep1;

  function openDrawer(item, startTime) {
    editing = item;
    pickedType = item?.type || 'activity';
    pendingStart = item?.start || startTime;
    form.title.value = item?.title || '';
    form.start.value = pendingStart;
    form.end.value = item?.end || '';
    form.maps.value = item?.maps || '';
    openLinkField(!!item?.maps);
    setPlace(item?.place || null); $('#placeQ').value = ''; $('#placeResults').innerHTML = '';
    draftOpts = structuredClone(item?.options || []); draftDecided = item?.decided || null;
    $('#optQ').value = ''; $('#optResults').innerHTML = ''; asHeading($('#optLinkBtn'), false); $('#optLinkForm').hidden = true;
    form.notes.value = item?.notes || '';
    $('#timeErr').hidden = true; ['title', 'start', 'end'].forEach(n => form[n].classList.remove('invalid', 'shake'));
    $('#delItem').hidden = !item; $('#delItem').textContent = 'Delete'; $('#delItem').dataset.armed = '';
    item ? goStep2() : goStep1();
    show('#drawer');
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const day = trip.days[cur];
    const data = {
      type: pickedType,
      title: form.title.value.trim() || DEFAULT_TITLE[pickedType] || '',
      start: form.start.value,
      end: form.end.value,
      maps: normaliseUrl(form.maps.value.trim()),
      place: currentPlace,
      options: [],
      decided: null,
      notes: form.notes.value.trim(),
    };
    if (OPT_TYPES.has(pickedType) && !$('#optsBox').hidden && draftOpts.length) {
      data.options = draftOpts; data.place = null; data.maps = '';
      data.decided = draftOpts.some(o => o.id === draftDecided) ? draftDecided : null;
    }
    if (!data.title) { flagError(form.title); form.title.focus(); toast('Add a title'); return; }
    if (!data.start) { flagError(form.start); return; }
    if (data.end && toMin(data.end) <= toMin(data.start)) { $('#timeErr').textContent = 'End is before Start.'; $('#timeErr').hidden = false; flagError(form.end); return; }
    const added = editing ? null : { id: uid(), ...data };
    if (editing) Object.assign(editing, data);
    else day.items.push(added);
    save(); renderGrid();
    if (editing) openView(editing); else { hide(); showAdded(added.id); }
    toast(editing ? 'Saved' : 'Added');
  });

  // After adding: scroll the new block into view and make it glow for a moment
  function showAdded(id) {
    requestAnimationFrame(() => {
      const el = $(`#grid .item[data-id="${id}"]`); if (!el) return;
      const r = el.getBoundingClientRect(), head = $('#v-itinerary .sticky, .daysbar, #days')?.getBoundingClientRect().bottom || 0;
      const room = innerHeight - 90 - head;   // between the sticky day bar and the bottom nav
      const top = scrollY + r.top - head - Math.max(16, (room - Math.min(r.height, room)) / 2);
      scrollTo({ top: Math.max(0, top), behavior: 'smooth' });
      el.classList.remove('just'); void el.offsetWidth; el.classList.add('just');
      setTimeout(() => el.classList.remove('just'), 2600);
    });
  }
  // End time: tapping an empty End starts it 30 min after Start; moving Start past End keeps End 30 min later
  const plus30 = hm => { const m = Math.min(toMin(hm) + 30, 23 * 60 + 59); return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`; };
  ['focus', 'pointerdown'].forEach(ev => form.end.addEventListener(ev, () => { if (!form.end.value && form.start.value) form.end.value = plus30(form.start.value); }));
  form.start.addEventListener('change', () => { if (form.start.value && form.end.value && toMin(form.end.value) <= toMin(form.start.value)) form.end.value = plus30(form.start.value); });

  $('#delItem').onclick = e => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap to confirm'; return; }
    const day = trip.days[cur];
    day.items = day.items.filter(x => x !== editing);
    save(); hide(); renderGrid(); toast('Deleted');
  };

  // Red rim + double shake; cleared as soon as the field changes
  function flagError(input) {
    input.classList.remove('shake'); void input.offsetWidth;
    input.classList.add('invalid', 'shake');
  }
  ['title', 'start', 'end'].forEach(n => form[n].addEventListener('input', () => {
    form[n].classList.remove('invalid');
    if (n !== 'title') { form.start.classList.remove('invalid'); form.end.classList.remove('invalid'); $('#timeErr').hidden = true; }
  }));

  // One thing at a time: block items that overlap another on the same day
  function span(it) { const s = toMin(it.start); let e = it.end ? toMin(it.end) : s + DEFAULT_MIN; if (e <= s) e = s + DEFAULT_MIN; return [s, e]; }
  function findOverlap(day, data, self) {
    const [s, e] = span(data);
    return day.items.find(o => o !== self && (() => { const [os, oe] = span(o); return s < oe && os < e; })());
  }

  const normaliseUrl = u => !u ? '' : /^https?:\/\//i.test(u) ? u : 'https://' + u;

  /* ---------- place search (OpenStreetMap via Photon) ---------- */
  let currentPlace = null, searchTimer, searchCtl;
  function setPlace(p) {
    currentPlace = p;
    const chip = $('#placeChip');
    chip.hidden = !p;
    if (p) chip.innerHTML = `${icon('pin')}<span><b>${esc(p.name)}</b>${p.address ? `<small>${esc(p.address)}</small>` : ''}</span>
      <button type="button" aria-label="Remove place">${icon('x')}</button>`;
    chip.querySelector('button')?.addEventListener('click', () => { setPlace(null); suggestPlace(); });
    $('#placeQ').closest('.search').hidden = !!p;
    if (p) $('#placeSuggest').hidden = true;
  }
  // For a new Rest item, offer the location of the previous Rest item
  function suggestPlace() {
    const btn = $('#placeSuggest');
    btn.hidden = true;
    if (editing || pickedType !== 'rest' || currentPlace) return;
    const prev = previousRest();
    if (!prev) return;
    const label = prev.place ? prev.place.name : 'Previous map link';
    btn.innerHTML = `${icon('rest')}<span>Same as before: <b>${esc(label)}</b></span>`;
    btn.onclick = () => {
      if (prev.place) setPlace({ ...prev.place });
      if (prev.maps) { form.maps.value = prev.maps; openLinkField(true); }
      btn.hidden = true;
    };
    btn.hidden = false;
  }
  function previousRest() {
    const before = [];
    trip.days.forEach((d, di) => d.items.forEach(it => {
      if (it.type !== 'rest' || !(it.place || it.maps)) return;
      const isBefore = di < cur || (di === cur && toMin(it.start) <= toMin(pendingStart || '23:59'));
      before.push({ it, isBefore, key: di * 1440 + toMin(it.start) });
    }));
    const pick = before.filter(b => b.isBefore).sort((a, b) => b.key - a.key)[0] || before.sort((a, b) => b.key - a.key)[0];
    return pick?.it || null;
  }

  // bias results towards places already in this trip
  function biasPoint() {
    const all = trip.days.flatMap(d => d.items).map(i => i.place).filter(Boolean);
    return all.at(-1) || null;
  }
  async function searchPlaces(q, out = $('#placeResults'), onPick = p => { setPlace(p); $('#placeQ').value = ''; if (!form.title.value) form.title.value = p.name; }) {
    if (q.length < 3) { out.innerHTML = ''; return; }
    searchCtl?.abort(); searchCtl = new AbortController();
    const b = biasPoint();
    const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}&limit=6&lang=en${b ? `&lat=${b.lat}&lon=${b.lon}` : ''}`;
    out.innerHTML = '<div class="pr muted">Searching…</div>';
    try {
      const res = await fetch(url, { signal: searchCtl.signal });
      const data = await res.json();
      const list = (data.features || []).map(f => {
        const pr = f.properties || {}, [lon, lat] = f.geometry.coordinates;
        const name = pr.name || [pr.housenumber, pr.street].filter(Boolean).join(' ') || pr.city || 'Unnamed place';
        const address = [[pr.housenumber, pr.street].filter(Boolean).join(' '), pr.district || pr.locality, pr.city, pr.state, pr.country]
          .filter((v, i, a) => v && v !== name && a.indexOf(v) === i).join(', ');
        return { name, address, lat: +lat.toFixed(6), lon: +lon.toFixed(6), cc: (pr.countrycode || '').toLowerCase() };
      });
      out.innerHTML = list.length ? '' : '<div class="pr muted">No matches. Try another spelling, or paste a link below.</div>';
      list.forEach(p => {
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'pr';
        b.innerHTML = `${icon('pin')}<span><b>${esc(p.name)}</b><small>${esc(p.address)}</small></span>`;
        b.onclick = () => { out.innerHTML = ''; onPick(p); };
        out.appendChild(b);
      });
      if (list.length) out.insertAdjacentHTML('beforeend', '<div class="attr">Search by Photon · © OpenStreetMap contributors</div>');
    } catch (e) {
      if (e.name !== 'AbortError') out.innerHTML = '<div class="pr muted">Search is unavailable right now. Paste a link below instead.</div>';
    }
  }
  /* ---------- options editor (Meal + Activity) ---------- */
  let draftOpts = [], draftDecided = null, optTimer;
  function renderOptList() {
    $('#optList').innerHTML = draftOpts.map(o => `<div class="optrow">${icon(o.place ? 'pin' : 'link')}<span><b>${esc(o.name)}</b><small>${esc(o.place?.address || o.maps || '')}</small></span>
      <button type="button" data-id="${o.id}" aria-label="Remove option">${icon('x')}</button></div>`).join('');
    $('#optList').querySelectorAll('button').forEach(b => b.onclick = () => { draftOpts = draftOpts.filter(o => o.id !== b.dataset.id); renderOptList(); });
    $('#hideOpts').hidden = draftOpts.length > 0;
  }
  function setOptsMode(on) {
    $('#singleLoc').hidden = on;
    $('#optsBox').hidden = !on;
    $('#showOpts').hidden = on || !OPT_TYPES.has(pickedType);
    if (on) renderOptList();
  }
  $('#showOpts').onclick = () => { setOptsMode(true); $('#optQ').focus(); };
  $('#hideOpts').onclick = () => setOptsMode(false);
  $('#optQ').addEventListener('input', e => {
    clearTimeout(optTimer);
    optTimer = setTimeout(() => searchPlaces(e.target.value.trim(), $('#optResults'), p => {
      draftOpts.push({ id: uid(), name: p.name, place: p, maps: '' }); $('#optQ').value = ''; renderOptList();
    }), 350);
  });
  // A link button turns into the heading of the fields it reveals
  function asHeading(btn, on) { btn.classList.toggle('as-head', on); btn.disabled = on; }
  function openLinkField(on) { asHeading($('#showLink'), on); $('#linkField').hidden = !on; }
  $('#optLinkBtn').onclick = () => { asHeading($('#optLinkBtn'), true); $('#optLinkForm').hidden = false; $('#optName').focus(); };
  $('#optAdd').onclick = () => {
    const name = $('#optName').value.trim(), url = normaliseUrl($('#optUrl').value.trim());
    if (!name) { flagError($('#optName')); return; }
    if (!url) { flagError($('#optUrl')); return; }
    draftOpts.push({ id: uid(), name, place: null, maps: url });
    $('#optName').value = ''; $('#optUrl').value = ''; renderOptList();
  };
  ['optName', 'optUrl', 'optQ', 'placeQ'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (id === 'optUrl') $('#optAdd').click(); } }));
  ['optName', 'optUrl'].forEach(id => $('#' + id).addEventListener('input', e => e.target.classList.remove('invalid')));

  $('#showLink').onclick = () => { openLinkField(true); form.maps.focus(); };
  $('#placeQ').addEventListener('input', e => { clearTimeout(searchTimer); searchTimer = setTimeout(() => searchPlaces(e.target.value.trim()), 350); });

  // Links that open the user's preferred maps app
  // Timeline "Map" pill: pasted link first, otherwise Google Maps
  const gmaps = p => `https://www.google.com/maps/search/?api=1&query=${p.lat},${p.lon}`;
  const undecided = x => (x.options?.length || 0) > 0 && !x.options.some(o => o.id === x.decided);
  // The location that counts: the picked option, or the item's own place/link
  function effLoc(x) {
    if (x.options?.length) { const o = x.options.find(o => o.id === x.decided); return o ? { place: o.place || null, maps: o.maps || '' } : null; }
    return { place: x.place || null, maps: x.maps || '' };
  }
  function primaryMapUrl(x) { const l = effLoc(x); return !l ? '' : l.maps || (l.place ? gmaps(l.place) : ''); }
  const optionUrl = o => o.maps || (o.place ? gmaps(o.place) : '');
  /* ---------- maps app preference ---------- */
  const PREF = 'xkk-maps-app';
  const getPref = () => { try { return localStorage.getItem(PREF) || ''; } catch (e) { return ''; } };
  const setPref = v => { try { v ? localStorage.setItem(PREF, v) : localStorage.removeItem(PREF); } catch (e) {} };
  const appUrl = (app, p) => p.query
    ? (app === 'waze' ? `https://waze.com/ul?q=${encodeURIComponent(p.query)}&navigate=yes` : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.query)}`)
    : (app === 'waze' ? `https://waze.com/ul?ll=${p.lat},${p.lon}&navigate=yes` : gmaps(p));

  // One way to open any location: a pasted link opens as-is; a searched place
  // opens in the saved app, or asks which app the first time.
  function mapLink(t, inner, cls) {
    if (t?.maps) return `<a class="${cls}" href="${esc(t.maps)}" target="_blank" rel="noopener">${inner}</a>`;
    const target = t?.place || (t?.query ? { query: t.query } : null);
    if (!target) return '';
    const pref = getPref();
    if (pref) return `<a class="${cls}" href="${esc(appUrl(pref, target))}" target="_blank" rel="noopener">${inner}</a>`;
    return `<button type="button" class="${cls}" data-mapchoose="${esc(JSON.stringify(target))}">${inner}</button>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-mapchoose]');
    if (!b) return;
    e.stopPropagation(); e.preventDefault();
    openChooser(JSON.parse(b.dataset.mapchoose));
  }, true);
  function openChooser(p) {
    $('#pickApps').innerHTML = [['google', 'Google Maps'], ['waze', 'Waze']]
      .map(([v, label]) => `<a class="btn" data-v="${v}" href="${esc(appUrl(v, p))}" target="_blank" rel="noopener">${label}</a>`).join('');
    $('#pickApps').querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
      setPref(a.dataset.v); setTimeout(() => { hide(); renderGrid(); }, 50);
    }));
    show('#mapsPick');
  }
  function renderSeg() { const v = getPref(); document.querySelectorAll('#mapsSeg button').forEach(b => b.classList.toggle('on', b.dataset.v === v)); }
  document.querySelectorAll('#mapsSeg button').forEach(b => b.onclick = () => { setPref(b.dataset.v); renderSeg(); renderGrid(); toast('Saved'); });
  $('#openSettings').onclick = () => {
    renderSeg();
    const onTrips = currentView() === 'trips', f = $('#tripSetForm');
    f.hidden = onTrips;
    $('#settingsTitle').textContent = onTrips ? 'Settings' : 'Trip settings';
    if (!onTrips) {
      f.title.value = trip.title || '';
      f.start.value = trip.days[0]?.date || todayISO();
      f.end.value = trip.days.at(-1)?.date || f.start.value;
      $('#setErr').hidden = true; f.dataset.armed = '';
    }
    show('#settings');
  };
  $('#tripSetForm').addEventListener('submit', e => {
    e.preventDefault();
    const f = e.target;
    const s0 = f.start.value || trip.days[0]?.date || todayISO(), e0 = f.end.value || s0;
    if (e0 < s0) { $('#setErr').textContent = 'End date is before the start date.'; $('#setErr').hidden = false; return; }
    const n = Math.min(60, Math.round((new Date(e0 + 'T00:00:00') - new Date(s0 + 'T00:00:00')) / 864e5) + 1);
    const removing = trip.days.slice(n), lost = removing.reduce((c, d) => c + d.items.length, 0);
    if (lost && !f.dataset.armed) {
      $('#setErr').textContent = `This removes ${removing.length} day${removing.length > 1 ? 's' : ''} with ${lost} item${lost > 1 ? 's' : ''}. Tap Save again to confirm.`;
      $('#setErr').hidden = false; f.dataset.armed = '1'; return;
    }
    trip.title = f.title.value.trim() || 'My trip';
    const oldStart = trip.days[0]?.date, newStart = f.start.value || oldStart || todayISO();
    if (oldStart && newStart !== oldStart) {
      const delta = Math.round((new Date(newStart + 'T00:00:00') - new Date(oldStart + 'T00:00:00')) / 864e5);
      trip.days.forEach(d => { if (d.date) d.date = addDays(d.date, delta); });
    }
    if (n < trip.days.length) {
      const ids = new Set(removing.flatMap(d => d.items.map(i => i.id)));
      trip.bookings.forEach(b => b.itemIds = (b.itemIds || []).filter(id => !ids.has(id)));
      trip.days = trip.days.slice(0, n);
    }
    while (trip.days.length < n) trip.days.push({ id: uid(), date: addDays(trip.days.at(-1)?.date || newStart, trip.days.length ? 1 : 0), label: '', items: [] });
    cur = Math.min(cur, trip.days.length - 1);
    save(); hide(); renderHeader(); renderDays(); renderGrid(); toast('Trip updated');
  });
  ['end', 'start'].forEach(n => $('#tripSetForm')[n].addEventListener('input', () => { $('#tripSetForm').dataset.armed = ''; $('#setErr').hidden = true; }));

  /* ---------- day switching: tabs + swipe ---------- */
  function changeDay(i, dir) {
    if (i < 0 || i >= trip.days.length || i === cur) return;
    dir = dir || (i > cur ? 1 : -1);
    cur = i; render(); scrollToStart();
    const g = $('#grid'), h = $('#dayhead');
    [g, h].forEach(el => { el.classList.remove('in-l', 'in-r'); void el.offsetWidth; el.classList.add(dir > 0 ? 'in-r' : 'in-l'); });
  }
  let tx = 0, ty = 0, tt = 0;
  const swipeArea = $('#v-itinerary');
  swipeArea.addEventListener('touchstart', e => { const t = e.touches[0]; tx = t.clientX; ty = t.clientY; tt = Date.now(); }, { passive: true });
  swipeArea.addEventListener('touchend', e => {
    if (openEl || e.target.closest('.days')) return;
    const t = e.changedTouches[0], dx = t.clientX - tx, dy = t.clientY - ty;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.8 && Date.now() - tt < 600) changeDay(cur + (dx < 0 ? 1 : -1), dx < 0 ? 1 : -1);
  }, { passive: true });

  // Open each day at its first item (or 7 am when empty)
  function scrollToStart() {
    const day = trip.days[cur]; if (!day) return;
    const first = day.items.length ? Math.min(...day.items.map(i => toMin(i.start))) : 7 * 60;
    const grid = $('#grid');
    const top = grid.getBoundingClientRect().top + scrollY + (first / 60) * HOUR_PX - 150;
    scrollTo({ top: Math.max(0, top), behavior: 'auto' });
  }

  /* ---------- day menu ---------- */
  const dayForm = $('#dayForm');
  function openDayMenu() {
    const d = trip.days[cur];
    dayForm.label.value = d.label || '';
    dayForm.date.value = d.date || '';
    $('#delDay').textContent = 'Delete day'; $('#delDay').dataset.armed = '';
    show('#dayMenu');
  }
  dayForm.addEventListener('submit', e => {
    e.preventDefault();
    const d = trip.days[cur];
    d.label = dayForm.label.value.trim(); d.date = dayForm.date.value;
    save(); hide(); render();
  });
  $('#delDay').onclick = e => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap to confirm'; return; }
    trip.days.splice(cur, 1); cur = Math.max(0, cur - 1);
    save(); hide(); render(); toast('Day deleted');
  };

  /* ---------- drawer show/hide ---------- */
  let openEl = null;
  function show(sel) {
    if (openEl && openEl !== $(sel)) openEl.classList.remove('on');
    openEl = $(sel); openEl.classList.add('on'); $('#backdrop').classList.add('on');
  }
  document.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => hide()));
  function hide() { openEl?.classList.remove('on'); $('#backdrop').classList.remove('on'); openEl = null; }
  $('#backdrop').onclick = hide;
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hide(); });

  /* ---------- flight times across time zones ---------- */
  // UTC offsets (hours) for common airports; used only when the flight time is unknown
  const AIRPORT_TZ = { KUL: 8, PEN: 8, LGK: 8, BKI: 8, KCH: 8, JHB: 8, SZB: 8, SIN: 8, HKG: 8, MFM: 8, TPE: 8, MNL: 8, CEB: 8, DPS: 8, PEK: 8, PVG: 8, CAN: 8, PER: 8,
    PQC: 7, SGN: 7, HAN: 7, DAD: 7, CXR: 7, BKK: 7, DMK: 7, HKT: 7, CNX: 7, USM: 7, KBV: 7, CGK: 7, PNH: 7, REP: 7, VTE: 7,
    RGN: 6.5, DAC: 6, DXB: 4, DWC: 4, MCT: 4, JED: 3, RUH: 3, NCE: 1, FCO: 1, MAD: 1, BCN: 1, MUC: 1, ZRH: 1, KTM: 5.75, DEL: 5.5, BOM: 5.5, CMB: 5.5, MLE: 5, DXB: 4, AUH: 4, DOH: 3, IST: 3, NRT: 9, HND: 9, KIX: 9, ICN: 9, GMP: 9, LHR: 0, CDG: 1, FRA: 1, AMS: 1, SYD: 11, MEL: 11, BNE: 10 };
  // "1h 50m", "1hr 50min", "1 hour 50 minutes", "2h 07min"
  const parseDur = s => { const m = (s || '').match(/(\d{1,2})\s*h(?:rs?|ours?)?\s*(?:(\d{1,2})\s*m)?/i); return m ? +m[1] * 60 + (+m[2] || 0) : null; };
  const fmtDur = m => `${Math.floor(m / 60)}h${m % 60 ? ' ' + (m % 60) + 'm' : ''}`;
  // From local departure/arrival times: real flight length and the clock change on landing
  function flightInfo(f) {
    if (!f.depTime || !f.arrTime) return null;
    const dayGap = f.arrDate && f.depDate ? Math.round((new Date(f.arrDate + 'T00:00:00') - new Date(f.depDate + 'T00:00:00')) / 864e5) : 0;
    const wall = toMin(f.arrTime) + dayGap * 1440 - toMin(f.depTime);
    let dur = parseDur(f.duration), shift = null;
    const a = AIRPORT_TZ[(f.from || '').toUpperCase()], b = AIRPORT_TZ[(f.to || '').toUpperCase()];
    // Known time zones win: clocks move by whole time zones, not by a misread flight time
    if (a != null && b != null) { shift = (b - a) * 60; dur = wall - shift; }
    else if (dur != null) shift = wall - dur;
    if (shift != null) shift = Math.round(shift / 15) * 15;
    return { dur, shift };
  }
  const shiftText = s => !s ? '' : `clocks go ${s < 0 ? 'back' : 'forward'} ${Math.abs(s) % 60 ? fmtDur(Math.abs(s)) : Math.abs(s) / 60 + 'h'}`;

  /* ---------- bookings ---------- */
  const BOOK_C = { c: '#5b7fa6', bg: '#ecf1f7' };
  const ground = (label, ic, eg) => ({ label, icon: ic, ...BOOK_C, fields: [
    ['operator', 'Operator', 'text', eg.op],
    [['number', `${label} number`, 'text', eg.no], ['ref', 'Booking ref', 'text', '']],
    [['from', 'From', 'text', eg.from], ['to', 'To', 'text', eg.to]],
    [['depDate', 'Departure date', 'date'], ['depTime', 'Departure time', 'time']],
    [['arrDate', 'Arrival date', 'date'], ['arrTime', 'Arrival time', 'time']],
    [['duration', 'Journey time', 'text', 'e.g. 2h 7m'], ['passengers', 'Passengers', 'text', 'e.g. 3']],
    ['seats', 'Seats', 'text', eg.seat],
    ['notes', 'Notes', 'textarea', 'Platform, luggage, anything else'],
  ] });
  const BOOK = {
    flight: { label: 'Flight', icon: 'plane', ...BOOK_C, fields: [
      ['airline', 'Airline', 'text', 'e.g. AirAsia'],
      [['flightNo', 'Flight number', 'text', 'e.g. AK 545'], ['ref', 'Booking ref', 'text', 'e.g. GBSEQC']],
      [['from', 'From', 'text', 'e.g. KUL'], ['to', 'To', 'text', 'e.g. PQC']],
      [['depDate', 'Departure date', 'date'], ['depTime', 'Departure time', 'time']],
      [['arrDate', 'Arrival date', 'date'], ['arrTime', 'Arrival time', 'time']],
      ['duration', 'Flight time', 'text', 'e.g. 1h 50m (works out the time change)'],
      [['seats', 'Seats', 'text', 'e.g. 27E, 27F'], ['baggage', 'Baggage', 'text', 'e.g. 20kg checked']],
      ['notes', 'Notes', 'textarea', 'Terminal, meals, anything else'],
    ] },
    car: { label: 'Car rental', icon: 'car', ...BOOK_C, fields: [
      [['company', 'Rental company', 'text', 'e.g. Turo · host'], ['ref', 'Booking ref', 'text', '']],
      [['car', 'Car', 'text', 'e.g. Mercedes-Benz CLA'], ['plate', 'Plate', 'text', 'e.g. FP-017-DE']],
      ['pickup', 'Pick-up location', 'text', 'Address or meeting point'],
      [['pickDate', 'Pick-up date', 'date'], ['pickTime', 'Pick-up time', 'time']],
      [['retDate', 'Return date', 'date'], ['retTime', 'Return time', 'time']],
      ['dropoff', 'Return location', 'text', 'Leave empty if same as pick-up'],
      ['phone', 'Phone', 'tel', ''],
      ['notes', 'Notes', 'textarea', 'Extras, key handover, fuel'],
    ] },
    train: ground('Train', 'train', { op: 'e.g. OUIGO', no: 'e.g. 7613', from: 'e.g. Paris Montparnasse', to: 'e.g. Bordeaux Saint-Jean', seat: 'e.g. Coach 4, seats 51–53' }),
    bus: ground('Bus', 'bus', { op: 'e.g. FlixBus', no: '', from: 'e.g. TBS', to: 'e.g. Melaka Sentral', seat: 'e.g. 12A' }),
    ferry: ground('Ferry', 'ferry', { op: 'e.g. Superdong', no: '', from: 'e.g. Rach Gia', to: 'e.g. Phu Quoc', seat: '' }),
    stay: { label: 'Stay', icon: 'hotel', c: '#9a6fb0', bg: '#f3edf7', desc: 'Hotel, address, check-in and out', fields: [
      ['name', 'Name', 'text', 'e.g. Sunday Boutique Hotel'],
      ['address', 'Address', 'text', 'Street, area, city'],
      ['maps', 'Map link', 'url', 'Google Maps, Waze or Apple Maps link'],
      [['phone', 'Phone', 'tel', '+84…'], ['ref', 'Booking ID', 'text', '']],
      [['inDate', 'Check-in date', 'date'], ['inTime', 'Check-in time', 'time']],
      [['outDate', 'Check-out date', 'date'], ['outTime', 'Check-out time', 'time']],
      ['room', 'Room', 'text', 'e.g. Deluxe Twin'],
      ['notes', 'Notes', 'textarea', 'Breakfast, Wi-Fi, anything else'],
    ] },
    other: { label: 'Other', icon: 'other', c: '#c4902e', bg: '#fbf4e4', desc: 'Tours, tickets, anything else', fields: [
      ['title', 'What is it?', 'text', 'e.g. Island hopping tour'],
      [['date', 'Date', 'date'], ['time', 'Time', 'time']],
      [['ref', 'Booking ref', 'text', ''], ['phone', 'Phone', 'tel', '']],
      ['address', 'Location', 'text', 'Meeting point or address'],
      ['notes', 'Notes', 'textarea', ''],
    ] },
  };
  // Flights, car rental, buses, trains and ferries all sit under Transport
  const TRANSPORT = ['flight', 'car', 'train', 'bus', 'ferry'], GROUND = ['train', 'bus', 'ferry'];
  const groupOf = k => TRANSPORT.includes(k) ? 'transport' : k;
  const KINDS = { transport: { label: 'Transport', icon: 'transport', ...BOOK_C, desc: 'Flight, car rental, bus, train, ferry' }, stay: BOOK.stay, other: BOOK.other };
  // The same detail under each form's own name, kept when switching between Flight, Train, Car rental…
  const ALIAS = [['depDate', 'pickDate'], ['depTime', 'pickTime'], ['arrDate', 'retDate'], ['arrTime', 'retTime'], ['from', 'pickup'], ['airline', 'operator', 'company'], ['flightNo', 'number']];
  function convert(d) {
    const out = { ...d };
    ALIAS.forEach(g => { const v = g.map(k => d[k]).find(Boolean); if (v) g.forEach(k => { if (!out[k]) out[k] = v; }); });
    return out;
  }
  // When it happens, for sorting and for spotting the same booking uploaded twice
  const whenOf = (k, d) => k === 'car' ? [d.pickDate, d.pickTime] : k === 'stay' ? [d.inDate, d.inTime] : k === 'other' ? [d.date, d.time] : [d.depDate, d.depTime];
  const normNo = s => (s || '').replace(/\s+/g, '').toUpperCase();
  function sameTrip(k, a, b) {
    const [ad, at] = whenOf(k, a), [bd, bt] = whenOf(k, b);
    if (!ad || ad !== bd) return false;
    if (k === 'flight' && a.flightNo && b.flightNo) return normNo(a.flightNo) === normNo(b.flightNo);
    if (k === 'stay') return !!((a.ref && a.ref === b.ref) || (a.name && b.name && a.name.toLowerCase() === b.name.toLowerCase()) || (a.outDate && a.outDate === b.outDate));
    if (k === 'other') return at === bt && (a.title || '') === (b.title || '');
    return !at || !bt || at === bt;
  }
  const bForm = $('#bookForm');
  let bEditing = null, bKind = 'flight', bQueue = [], bFilter = 'all', bTotal = 0, bIndex = 0, bCur = null, bMatched = false;

  const shortDate = iso => iso ? fmtDate(iso, { weekday: 'short', day: 'numeric', month: 'short' }) : '';
  const nights = (a, b) => (a && b) ? Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5) : 0;
  const qLink = b => (b.name || b.address || b.title) ? { query: [b.name || b.title, b.address].filter(Boolean).join(', ') } : null;

  function renderBookings() {
    const list = $('#bookList'), all = trip.bookings;
    $('#bookFilters').hidden = !all.length;
    if (!all.length) {
      list.innerHTML = `<div class="pempty"><div class="big" style="color:var(--sea)">${icon('plane')}</div><p><b>No bookings yet</b></p><p class="muted">Add flights, trains, car rentals and stays by hand, or upload confirmations and screenshots.</p><button type="button" class="btn" id="bookBegin">Add booking</button></div>`;
      $('#bookBegin').onclick = () => openBooking(null);
      return;
    }
    const sortKey = b => { const [d, t] = whenOf(b.kind, b); return (d || '9') + (t || ''); };
    const groups = [['transport', 'Transport'], ['stay', 'Stays'], ['other', 'Other']];
    // Filter cards: All first, then only the kinds that exist
    const kinds = groups.filter(([k]) => all.some(b => groupOf(b.kind) === k));
    if (bFilter !== 'all' && !kinds.some(([k]) => k === bFilter)) bFilter = 'all';
    $('#bookFilters').innerHTML = [['all', 'All', all.length], ...kinds.map(([k, l]) => [k, l, all.filter(b => groupOf(b.kind) === k).length])]
      .map(([k, l, n]) => `<button type="button" data-f="${k}" class="${k === bFilter ? 'on' : ''}"><b>${l}</b><span>${n}</span></button>`).join('');
    $('#bookFilters').querySelectorAll('button').forEach(btn => btn.onclick = () => { bFilter = btn.dataset.f; renderBookings(); });
    list.innerHTML = groups.map(([k, label]) => {
      if (bFilter !== 'all' && bFilter !== k) return '';
      const items = all.filter(b => groupOf(b.kind) === k).sort((a, b) => sortKey(a).localeCompare(sortKey(b)));
      return items.length ? `<div class="bsect">${label}</div>${items.map(bookingCard).join('')}` : '';
    }).join('');
    list.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openBooking(trip.bookings.find(x => x.id === b.dataset.edit)));
    list.querySelectorAll('[data-copy]').forEach(b => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); toast('Copied'); } catch (e) { toast(b.dataset.copy); }
    });
  }
  function kv(label, value, extra = '', cls = '') { return value ? `<div class="kv ${cls}"><span>${label}</span><span>${esc(value)}</span>${extra}</div>` : ''; }
  const copyBtn = v => `<button type="button" class="mini" data-copy="${esc(v)}" aria-label="Copy">${icon('copy')}</button>`;
  const callBtn = v => `<a class="mini" href="tel:${esc(v.replace(/[^\d+]/g, ''))}" aria-label="Call">${icon('phone')}</a>`;
  function bookingCard(b) {
    const K = BOOK[b.kind], style = `style="--c:${K.c};--bg:${K.bg}"`;
    const head = (title, sub) => `<div class="bh"><span class="badge" ${style}>${icon(K.icon)}</span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><button type="button" class="round" data-edit="${b.id}" aria-label="Edit">${icon('edit')}</button></div>`;
    if (b.kind === 'flight') return `<div class="bcard" ${style}>${head([b.airline, b.flightNo].filter(Boolean).join(' · ') || 'Flight', shortDate(b.depDate))}
      <div class="route"><div class="end"><div class="code">${esc(b.from || '—')}</div><div class="tm">${fmtTime(b.depTime)}</div><div class="city">${esc(b.fromCity || '')}</div></div>
      <div class="mid">${icon('plane')}</div>
      <div class="end"><div class="code">${esc(b.to || '—')}</div><div class="tm">${fmtTime(b.arrTime)}</div><div class="city">${esc(b.toCity || '')}${b.arrDate && b.arrDate !== b.depDate ? ' · ' + shortDate(b.arrDate) : ''}</div></div></div>
      ${kv('Booking ref', b.ref, copyBtn(b.ref || ''))}${kv('Seats', b.seats)}${kv('Baggage', b.baggage)}${kv('Notes', b.notes, '', 'note')}</div>`;
    if (GROUND.includes(b.kind)) return `<div class="bcard" ${style}>${head([b.operator, b.number].filter(Boolean).join(' · ') || K.label, shortDate(b.depDate))}
      <div class="route long"><div class="end"><div class="code">${esc(b.from || '—')}</div><div class="tm">${fmtTime(b.depTime)}</div></div>
      <div class="mid">${icon(K.icon)}</div>
      <div class="end"><div class="code">${esc(b.to || '—')}</div><div class="tm">${fmtTime(b.arrTime)}</div><div class="city">${b.arrDate && b.arrDate !== b.depDate ? shortDate(b.arrDate) : ''}</div></div></div>
      ${kv('Booking ref', b.ref, copyBtn(b.ref || ''))}${kv('Journey time', b.duration)}${kv('Passengers', b.passengers)}${kv('Seats', b.seats)}${kv('Notes', b.notes, '', 'note')}</div>`;
    if (b.kind === 'car') {
      const n = nights(b.pickDate, b.retDate);
      return `<div class="bcard" ${style}>${head(b.car || 'Car rental', [b.company, n ? `${n} day${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · '))}
      <div class="stayd"><div><small>Pick-up</small><b>${shortDate(b.pickDate) || '—'}</b><span>${fmtTime(b.pickTime)}</span></div><div><small>Return</small><b>${shortDate(b.retDate) || '—'}</b><span>${fmtTime(b.retTime)}</span></div></div>
      ${kv('Pick-up', b.pickup)}${kv('Return to', b.dropoff)}${kv('Plate', b.plate)}${kv('Booking ref', b.ref, copyBtn(b.ref || ''))}${kv('Phone', b.phone, b.phone ? callBtn(b.phone) + copyBtn(b.phone) : '')}${kv('Notes', b.notes, '', 'note')}
      ${b.pickup ? mapLink({ query: b.pickup }, 'Open in Maps ↗', 'btn primary') : ''}</div>`;
    }
    if (b.kind === 'stay') {
      const n = nights(b.inDate, b.outDate);
      return `<div class="bcard" ${style}>${head(b.name || 'Stay', n ? `${n} night${n > 1 ? 's' : ''}` : '')}
      <div class="stayd"><div><small>Check-in</small><b>${shortDate(b.inDate) || '—'}</b><span>${b.inTime ? 'from ' + fmtTime(b.inTime) : ''}</span></div><div><small>Check-out</small><b>${shortDate(b.outDate) || '—'}</b><span>${b.outTime ? 'by ' + fmtTime(b.outTime) : ''}</span></div></div>
      ${kv('Address', b.address)}${kv('Phone', b.phone, b.phone ? callBtn(b.phone) + copyBtn(b.phone) : '')}${kv('Booking ID', b.ref, copyBtn(b.ref || ''))}${kv('Room', b.room)}${kv('Notes', b.notes, '', 'note')}
      ${mapLink(b.maps ? { maps: b.maps } : qLink(b), 'Open in Maps ↗', 'btn primary')}</div>`;
    }
    return `<div class="bcard" ${style}>${head(b.title || 'Booking', [shortDate(b.date), fmtTime(b.time)].filter(Boolean).join(' · '))}
      ${kv('Booking ref', b.ref, copyBtn(b.ref || ''))}${kv('Phone', b.phone, b.phone ? callBtn(b.phone) : '')}${kv('Location', b.address)}${kv('Notes', b.notes, '', 'note')}
      ${b.address ? mapLink(qLink(b), 'Open in Maps ↗', 'btn primary') : ''}</div>`;
  }

  // Drawer: step 1 pick a kind (or upload), step 2 the form
  function openBooking(b, prefill) {
    bEditing = b; bMatched = false; bCur = null; $('#bfound').hidden = true; $('#bprog').hidden = true;
    if (b) bTotal = 0;
    if (b || prefill) { bKind = b?.kind || prefill.kind; bStep2(b || prefill.data, !!prefill); }
    else bStep1();
    show('#bookDrawer');
  }
  function bStep1() {
    $('#bcards').innerHTML = Object.entries(KINDS).map(([k, K]) => `<button type="button" data-k="${k}" style="--c:${K.c};--bg:${K.bg}"><span class="ci">${icon(K.icon)}</span><span><b>${K.label}</b><small>${K.desc}</small></span></button>`).join('');
    $('#bcards').querySelectorAll('button').forEach(btn => btn.onclick = () => { bKind = btn.dataset.k === 'transport' ? 'flight' : btn.dataset.k; bStep2({}); });
    $('#bstep1').classList.add('on'); $('#bstep2').classList.remove('on');
  }
  let bFromFile = false;
  const srcWord = src => src === 'files' ? 'your files' : `your ${src || 'PDF'}`;
  // opts.added: only these fields were filled in from the file (updating a booking you already have)
  function bStep2(data, fromPdf, opts = {}) {
    const K = BOOK[bKind];
    bFromFile = !!fromPdf;
    $('#bbadge').style.setProperty('--c', K.c); $('#bbadge').style.setProperty('--bg', K.bg); $('#bbadge').innerHTML = icon(K.icon);
    $('#btitle').textContent = `${bMatched ? 'Update' : bEditing ? 'Edit' : 'New'} ${K.label}`;
    // Flight · Car rental · Bus · Train · Ferry
    const modes = $('#bmodes');
    modes.hidden = !TRANSPORT.includes(bKind);
    modes.innerHTML = TRANSPORT.map(k => `<button type="button" data-m="${k}" class="${k === bKind ? 'on' : ''}">${icon(BOOK[k].icon)}<span>${BOOK[k].label}</span></button>`).join('');
    modes.querySelectorAll('button').forEach(btn => btn.onclick = () => {
      if (btn.dataset.m === bKind) return;
      const now = {}; $('#bfields').querySelectorAll('input,textarea').forEach(el => now[el.name] = el.value.trim());
      bKind = btn.dataset.m; bStep2(convert(now), bFromFile, { keepFound: true });
    });
    const field = ([name, label, type, ph = '']) => type === 'textarea'
      ? `<label>${label}<textarea name="${name}" rows="2" placeholder="${esc(ph)}"></textarea></label>`
      : `<label>${label}<input name="${name}" type="${type}" placeholder="${esc(ph)}"></label>`;
    $('#bfields').innerHTML = K.fields.map(f => Array.isArray(f[0]) ? `<div class="two">${f.map(field).join('')}</div>` : field(f)).join('');
    let filled = 0;
    $('#bfields').querySelectorAll('input,textarea').forEach(el => {
      const v = data[el.name] || '';
      el.value = v;
      if (fromPdf && v && (!opts.added || opts.added.includes(el.name))) { el.classList.add('filled'); filled++; }
      el.addEventListener('input', () => el.classList.remove('filled'), { once: true });
    });
    // "Train 2 of 4 · Paris Montparnasse → Bordeaux Saint-Jean" while working through several bookings
    const many = fromPdf && bTotal > 1;
    $('#bprog').hidden = !many;
    if (many) {
      const route = (data.from || data.to) && bKind !== 'car' ? ` <span>·</span> ${esc(data.from || '?')} → ${esc(data.to || '?')}` : '';
      $('#bprog').innerHTML = `${BOOK[bKind].label} ${bIndex} of ${bTotal}${route}`;
    }
    if (fromPdf && !opts.keepFound) {
      const from = srcWord(bCur?.src), f = $('#bfound');
      f.hidden = false; f.classList.toggle('same', bMatched);
      f.innerHTML = bMatched
        ? `<b>You already have this booking.</b> ${filled ? `Added ${filled} missing detail${filled > 1 ? 's' : ''} from ${from} (highlighted).` : `Nothing new in ${from}.`} Saving updates it. <button type="button" class="linkbtn" id="bAsNew">Save as a new booking instead</button>`
        : filled ? `<b>Filled in ${filled} field${filled > 1 ? 's' : ''} from ${from}.</b> Check the highlighted ones before saving.`
        : `<b>Couldn't find details in ${from}.</b> Please fill them in by hand.`;
      const asNew = $('#bAsNew');
      if (asNew) asNew.onclick = () => { bEditing = null; bMatched = false; bStep2(bCur.data, true); };
    } else if (!fromPdf) $('#bfound').hidden = true;
    // Arrival before departure on the same day is usually a misread time
    if ((bKind === 'flight' || GROUND.includes(bKind)) && data.depDate && data.depDate === data.arrDate && data.depTime && data.arrTime && data.arrTime < data.depTime) {
      bForm.arrTime.classList.add('warn');
      $('#bfound').hidden = false;
      if (!/Check the arrival time/.test($('#bfound').innerHTML)) $('#bfound').insertAdjacentHTML('beforeend', '<br><b>Check the arrival time:</b> it looks earlier than departure.');
      bForm.arrTime.addEventListener('input', () => bForm.arrTime.classList.remove('warn'), { once: true });
    }
    updateReminder();
    $('#bsync').checked = bEditing ? !!bEditing.itemIds?.length : true;
    $('#bdel').hidden = !bEditing || bMatched; $('#bdel').textContent = 'Delete'; $('#bdel').dataset.armed = '';
    $('#bstep2').classList.add('on'); $('#bstep1').classList.remove('on');
  }
  // Show one booking found in a file: as an update if it's already saved, otherwise as new
  function showFound(item) {
    bCur = item; bKind = item.kind; bPrefillExtra = item.data;
    // "Hotel Mistral" from a screenshot takes the spelling you already have ("Hôtel Mistral")
    if (item.kind === 'stay' && item.data.name) {
      const p = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
      const known = trip.bookings.find(b => b.kind === 'stay' && b.name && p(b.name) === p(item.data.name));
      if (known) item.data.name = known.name;
    }
    const match = trip.bookings.find(b => b.kind === item.kind && sameTrip(item.kind, b, item.data));
    bEditing = match || null; bMatched = !!match;
    if (!match) return bStep2(item.data, true);
    const merged = { ...match }, added = [];
    Object.entries(item.data).forEach(([k, v]) => { if (v && !match[k]) { merged[k] = v; added.push(k); } });
    bStep2(merged, true, { added });
  }
  // "Flight 2 of 4 · EK 071 · DXB → CDG · Thu 26 Feb" just above Save, kept in sync with the form
  function updateReminder() {
    const many = !bEditing && bTotal > 1, fromPdf = !$('#bfound').hidden, v = n => bForm[n]?.value.trim() || '';
    const parts = [];
    if (bKind === 'flight') parts.push(v('flightNo') && `<b>${esc(v('flightNo'))}</b>`, (v('from') || v('to')) && `${esc(v('from') || '?')} → ${esc(v('to') || '?')}`, v('depDate') && shortDate(v('depDate')));
    else if (GROUND.includes(bKind)) parts.push((v('number') || v('operator')) && `<b>${esc(v('number') || v('operator'))}</b>`, (v('from') || v('to')) && `${esc(v('from') || '?')} → ${esc(v('to') || '?')}`, v('depDate') && shortDate(v('depDate')));
    else if (bKind === 'car') parts.push(v('car') && `<b>${esc(v('car'))}</b>`, v('pickDate') && `${fmtDate(v('pickDate'), { day: 'numeric', month: 'short' })}${v('retDate') ? '–' + fmtDate(v('retDate'), { day: 'numeric', month: 'short' }) : ''}`);
    else if (bKind === 'stay') parts.push(v('name') && `<b>${esc(v('name'))}</b>`, v('inDate') && `${fmtDate(v('inDate'), { day: 'numeric', month: 'short' })}${v('outDate') ? '–' + fmtDate(v('outDate'), { day: 'numeric', month: 'short' }) : ''}`);
    else parts.push(v('title') && `<b>${esc(v('title'))}</b>`, v('date') && shortDate(v('date')));
    const lead = many ? `${BOOK[bKind].label} ${bIndex} of ${bTotal}` : BOOK[bKind].label;
    $('#bremind').innerHTML = [lead, ...parts.filter(Boolean)].join(' · ');
    $('#bremind').hidden = !(many || fromPdf);
    $('#bsave').textContent = (bMatched ? 'Update' : 'Save') + (many && bIndex < bTotal ? ' & next' : '');
  }
  $('#bfields').addEventListener('input', () => updateReminder());
  $('#bback').onclick = () => { if (!bEditing || bMatched) { bEditing = null; bMatched = false; bStep1(); } else hide(); };
  $('#addBooking').onclick = () => { bQueue = []; bTotal = 0; openBooking(null); };

  bForm.addEventListener('submit', e => {
    e.preventDefault();
    const data = { kind: bKind };
    $('#bfields').querySelectorAll('input,textarea').forEach(el => data[el.name] = el.value.trim());
    let b = bEditing;
    if (b) {
      unlinkBooking(b); Object.keys(b).forEach(k => { if (!['id', 'itemIds', 'fromCity', 'toCity'].includes(k)) delete b[k]; }); Object.assign(b, data);
      if (bMatched) { b.fromCity ||= bPrefillExtra.fromCity || ''; b.toCity ||= bPrefillExtra.toCity || ''; }
    }
    else { b = { id: uid(), itemIds: [], ...data, fromCity: bPrefillExtra.fromCity || '', toCity: bPrefillExtra.toCity || '' }; trip.bookings.push(b); }
    const skipped = $('#bsync').checked ? linkBooking(b) : [];
    save(); renderBookings(); renderGrid();
    const word = bMatched ? 'Updated' : 'Saved';
    toast(skipped.length ? `${word}. Not added to itinerary: ${skipped.join(', ')}` : word);
    if (bQueue.length) { bIndex++; showFound(bQueue.shift()); }
    else { bMatched = false; hide(); }
  });
  $('#bdel').onclick = e => {
    const btn = e.currentTarget;
    if (!btn.dataset.armed) { btn.dataset.armed = '1'; btn.textContent = 'Tap to confirm'; return; }
    unlinkBooking(bEditing);
    trip.bookings = trip.bookings.filter(x => x !== bEditing);
    save(); hide(); renderBookings(); renderGrid(); toast('Booking deleted');
  };

  // Itinerary links: flights → Transport, stays → Rest, other → Other
  function unlinkBooking(b) {
    if (!b?.itemIds?.length) return;
    trip.days.forEach(d => d.items = d.items.filter(i => !b.itemIds.includes(i.id)));
    b.itemIds = [];
  }
  function linkBooking(b) {
    const skipped = [], add = (date, start, item, label) => {
      if (!date || !start) return;
      const day = trip.days.find(d => d.date === date);
      if (!day) { skipped.push(`${label} (no day for ${shortDate(date)})`); return; }
      const it = { id: uid(), end: '', maps: '', notes: '', options: [], decided: null, place: null, bookingId: b.id, start, ...item };
      // Overlaps are fine; only check-in waits until after you've landed or arrived (up to 3 hours later)
      let clash = findOverlap(day, it, null);
      for (let k = 0; clash && clash.type === 'transport' && label === 'check-in' && k < 6; k++) {
        const m = Math.ceil((toMin(it.start) + 1) / 30) * 30; if (m >= 24 * 60) break;
        it.start = fromMin(m); clash = findOverlap(day, it, null);
      }
      day.items.push(it); b.itemIds.push(it.id);
    };
    const gq = q => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
    if (b.kind === 'flight') {
      // One block from departure to landing, each end in its own local time
      const fi = flightInfo(b) || {};
      const sameDay = !b.arrDate || b.arrDate === b.depDate;
      const end = sameDay && b.arrTime && toMin(b.arrTime) > toMin(b.depTime) ? b.arrTime : '';
      add(b.depDate, b.depTime, {
        type: 'transport', mode: 'flight', end,
        title: ['Flight', b.flightNo, b.from && b.to ? `· ${b.from} → ${b.to}` : b.to ? `to ${b.to}` : ''].filter(Boolean).join(' '),
        notes: [b.ref && 'Ref ' + b.ref, b.seats && 'Seats ' + b.seats].filter(Boolean).join(' · '),
        flight: { from: b.from || '', to: b.to || '', arrTime: b.arrTime || '', arrDate: sameDay ? '' : b.arrDate, dur: fi.dur ?? null, shift: fi.shift ?? null },
      }, 'flight');
    } else if (b.kind === 'car') {
      const what = b.car || 'car', ref = [b.ref && 'Ref ' + b.ref, b.plate && 'Plate ' + b.plate].filter(Boolean).join(' · ');
      add(b.pickDate, b.pickTime || '10:00', { type: 'transport', mode: 'car', title: `Pick up ${what}`, maps: b.pickup ? gq(b.pickup) : '', notes: ref }, 'car pick-up');
      add(b.retDate, b.retTime || '10:00', { type: 'transport', mode: 'car', title: `Return ${what}`, maps: (b.dropoff || b.pickup) ? gq(b.dropoff || b.pickup) : '' }, 'car return');
    } else if (GROUND.includes(b.kind)) {
      // One block from departure to arrival
      const K = BOOK[b.kind], sameDay = !b.arrDate || b.arrDate === b.depDate;
      const end = sameDay && b.arrTime && toMin(b.arrTime) > toMin(b.depTime) ? b.arrTime : '';
      add(b.depDate, b.depTime, {
        type: 'transport', mode: b.kind, end,
        title: [K.label, b.number, b.from && b.to ? `· ${b.from} → ${b.to}` : b.to ? `to ${b.to}` : ''].filter(Boolean).join(' '),
        notes: [b.ref && 'Ref ' + b.ref, b.seats && 'Seats ' + b.seats].filter(Boolean).join(' · '),
        ...(end || !b.arrTime ? {} : { flight: { from: '', to: '', arrTime: b.arrTime, arrDate: sameDay ? '' : b.arrDate, dur: parseDur(b.duration), shift: null } }),
      }, K.label.toLowerCase());
    } else if (b.kind === 'stay') {
      const maps = b.maps || ((b.name || b.address) ? gq([b.name, b.address].filter(Boolean).join(', ')) : '');
      add(b.inDate, b.inTime || '14:00', { type: 'rest', title: `Check in · ${b.name || 'Stay'}`, maps, notes: b.ref ? 'Booking ID ' + b.ref : '' }, 'check-in');
      add(b.outDate, b.outTime || '11:00', { type: 'rest', title: `Check out · ${b.name || 'Stay'}`, maps }, 'check-out');
    } else {
      add(b.date, b.time, { type: 'other', title: b.title || 'Booking', maps: b.address ? gq(b.address) : '', notes: b.ref ? 'Ref ' + b.ref : '' }, b.title || 'booking');
    }
    return skipped;
  }

  // PDF: read text on the device with pdf.js, then pattern-match (parse.js)
  let bPrefillExtra = {};
  let pdfReady = null;
  function loadPdfJs() {
    pdfReady ||= new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'libs/pdf.min.js';
      s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'libs/pdf.worker.min.js'; res(window.pdfjsLib); };
      s.onerror = () => { pdfReady = null; rej(new Error('pdf.js failed to load')); };
      document.head.appendChild(s);
    });
    return pdfReady;
  }
  function toLines(src) {
    const items = [...src].sort((a, b) => b.y - a.y || a.x - b.x), lines = [];
    for (const it of items) { const l = lines.find(l => Math.abs(l.y - it.y) < 3); l ? l.items.push(it) : lines.push({ y: it.y, items: [it] }); }
    return lines.sort((a, b) => b.y - a.y).map(l => {
      let s = '', end = null;
      l.items.sort((a, b) => a.x - b.x).forEach(it => { if (end !== null) s += it.x - end > 12 ? '   ' : ' '; s += it.s.trim(); end = it.x + it.w; });
      return s;
    }).join('\n') + '\n\n';
  }
  async function pdfToText(buf) {
    const lib = await loadPdfJs();
    const doc = await lib.getDocument({ data: buf }).promise;
    let text = '', cols = '';
    for (let p = 1; p <= doc.numPages; p++) {
      const page = await doc.getPage(p), mid = page.getViewport({ scale: 1 }).width / 2;
      const all = (await page.getTextContent()).items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str, x: i.transform[4], y: i.transform[5], w: i.width }));
      text += toLines(all); cols += toLines(all.filter(i => i.x < mid)) + toLines(all.filter(i => i.x >= mid));
    }
    return { text, cols };
  }
  // Text recognition for screenshots, photos and image-only PDFs (tesseract.js, runs on the phone)
  let ocrReady = null;
  function loadOcr() {
    ocrReady ||= new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = (window.XKK_OCR || {}).script || 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
      s.onload = () => res(window.Tesseract); s.onerror = () => { ocrReady = null; rej(new Error('OCR failed to load')); };
      document.head.appendChild(s);
    });
    return ocrReady;
  }
  async function ocrImages(images, onProgress) {
    const T = await loadOcr();
    let done = 0;
    const worker = await T.createWorker('eng', 1, { ...((window.XKK_OCR || {}).options || {}), logger: m => { if (m.status === 'recognizing text') onProgress((done + m.progress) / images.length); } });
    let text = '';
    let cols = '';
    for (const img of images) {
      const { data } = await worker.recognize(img);
      // rebuild lines and columns from where each word sits on the image
      const words = (data.lines || []).flatMap((l, i) => (l.words || []).map(w => ({ t: w.text, c: w.confidence, l: i, b: [w.bbox.x0, w.bbox.y0, w.bbox.x1, w.bbox.y1] })));
      const r = words.length ? window.XKKParse.wordsToText(words) : { text: data.text, cols: data.text };
      text += r.text + '\n'; cols += r.cols + '\n'; done++;
    }
    await worker.terminate();
    return { text, cols };
  }
  async function pdfPagesToImages(buf) {
    const lib = await loadPdfJs(), doc = await lib.getDocument({ data: buf }).promise, out = [];
    for (let p = 1; p <= Math.min(doc.numPages, 5); p++) {
      const page = await doc.getPage(p), vp = page.getViewport({ scale: 2 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      await page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      out.push(c);
    }
    return out;
  }
  // PDF with text → read directly; image PDF or picture → text recognition first
  async function fileToText(file, setLabel) {
    const isPdf = /pdf/i.test(file.type) || /\.pdf$/i.test(file.name);
    const progress = f => setLabel(`Reading screenshot… ${Math.round(f * 100)}%`);
    if (isPdf) {
      setLabel('Reading PDF…');
      const buf = await file.arrayBuffer();
      const r = await pdfToText(buf.slice(0));
      if (r.text.replace(/\s/g, '').length > 40) return r;
      setLabel('Getting text recognition ready…');
      return ocrImages(await pdfPagesToImages(buf), progress);
    }
    setLabel('Getting text recognition ready…');
    return ocrImages([file], progress);
  }

  let uploadFrom = null;
  ['uploadPdf1', 'uploadPdf2'].forEach(id => $('#' + id).onclick = () => { uploadFrom = id; $('#pdfInput').value = ''; $('#pdfInput').click(); });
  // One or more files: read each, put everything found in one queue ("Train 1 of 2"),
  // and fold together the same trip seen in two files (an email and an app screen)
  $('#pdfInput').addEventListener('change', async e => {
    const files = [...e.target.files]; if (!files.length) return;
    const btn = $('#' + uploadFrom); btn.classList.add('busy');
    const label = btn.querySelector('b'), was = label.textContent;
    const found = [];
    let failed = 0, lastErr = null;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i], src = /pdf/i.test(f.type) || /\.pdf$/i.test(f.name) ? 'PDF' : 'screenshot';
        const pre = files.length > 1 ? `${i + 1} of ${files.length} · ` : '';
        try {
          const r = window.XKKParse.parseBooking(await fileToText(f, t => label.textContent = pre + t));
          if (r.items.length) r.items.forEach(x => found.push({ ...x, data: { ...x.data }, src }));
          else found.push({ kind: uploadFrom === 'uploadPdf2' ? bKind : 'other', data: r.other || {}, src });
        } catch (err) { failed++; lastErr = err; }
      }
      if (!found.length) throw lastErr || new Error('nothing');
      const list = [];
      found.forEach(x => {
        const m = list.find(y => y.kind === x.kind && sameTrip(x.kind, y.data, x.data));
        if (!m) return list.push(x);
        Object.entries(x.data).forEach(([k, v]) => { if (v && !m.data[k]) m.data[k] = v; });
        if (m.src !== x.src) m.src = 'files';
      });
      const key = x => whenOf(x.kind, x.data).join(' ') || '9';
      if (list.length > 1 && list.every(x => x.data && Object.values(x.data).some(Boolean))) list.sort((a, b) => key(a).localeCompare(key(b)));
      if (failed) toast(`Couldn't read ${failed} of ${files.length} files`);
      bTotal = list.length; bIndex = 1;
      bQueue = list.slice(1);
      showFound(list[0]);
    } catch (err) {
      toast(/OCR/.test(err?.message) ? 'Text recognition needs an internet connection the first time.' : `Couldn't read ${files.length > 1 ? 'those files' : 'that file'}. Try another, or fill in by hand.`);
    } finally { btn.classList.remove('busy'); label.textContent = was; }
  });

  // Floating + on Bookings: same as the Add booking button at the top
  $('#bookFab').onclick = () => $('#addBooking').click();

  /* ---------- Handy: useful places near each place you stay ---------- */
  // Map data © OpenStreetMap contributors, via Overpass (nearby places) and Photon (finding the hotel)
  const HANDY_CATS = [
    ['conv', 'Convenience store', 'nwr["shop"="convenience"]', 'convenience store'],
    ['pharm', 'Pharmacy', 'nwr["amenity"="pharmacy"];nwr["healthcare"="pharmacy"]', 'pharmacy'],
    ['clinic', 'Clinic & hospital', 'nwr["amenity"~"^(clinic|hospital|doctors)$"]', 'clinic'],
    ['police', 'Police', 'nwr["amenity"="police"]', 'police station'],
    ['cash', 'ATM & money changer', 'nwr["amenity"~"^(atm|bureau_de_change)$"]', 'atm'],
    ['super', 'Supermarket', 'nwr["shop"="supermarket"]', 'supermarket'],
    ['laundry', 'Laundry', 'nwr["shop"~"^(laundry|dry_cleaning)$"]', 'laundry'],
    ['fuel', 'Petrol station', 'nwr["amenity"="fuel"]', 'petrol station'],
  ];
  const CAT_OF = t => t.shop === 'convenience' ? 'conv' : t.amenity === 'pharmacy' || t.healthcare === 'pharmacy' ? 'pharm'
    : /^(clinic|hospital|doctors)$/.test(t.amenity) ? 'clinic' : t.amenity === 'police' ? 'police' : /^(atm|bureau_de_change)$/.test(t.amenity) ? 'cash'
    : t.shop === 'supermarket' ? 'super' : /^(laundry|dry_cleaning)$/.test(t.shop) ? 'laundry' : t.amenity === 'fuel' ? 'fuel' : '';
  // Emergency numbers by country (tap to call)
  const SOS = {
    vn: [['Police', '113'], ['Ambulance', '115'], ['Fire', '114']],
    my: [['Police & ambulance', '999'], ['Fire', '994'], ['From a mobile', '112']],
    sg: [['Police', '999'], ['Ambulance & fire', '995']],
    th: [['Police', '191'], ['Tourist police', '1155'], ['Ambulance', '1669'], ['Fire', '199']],
    id: [['Police', '110'], ['Ambulance', '118'], ['Fire', '113']],
    ph: [['Emergency', '911']], jp: [['Police', '110'], ['Ambulance & fire', '119']], kr: [['Police', '112'], ['Ambulance & fire', '119']],
    cn: [['Police', '110'], ['Ambulance', '120'], ['Fire', '119']], hk: [['Emergency', '999']], tw: [['Police', '110'], ['Ambulance & fire', '119']],
    kh: [['Police', '117'], ['Ambulance', '119'], ['Fire', '118']], au: [['Emergency', '000']], nz: [['Emergency', '111']],
    us: [['Emergency', '911']], ca: [['Emergency', '911']], gb: [['Emergency', '999'], ['Also works', '112']], ae: [['Police', '999'], ['Ambulance', '998']],
    qa: [['Emergency', '999']], in: [['Emergency', '112']], tr: [['Emergency', '112']],
    fr: [['Emergency (EU)', '112'], ['Ambulance (SAMU)', '15'], ['Police', '17'], ['Fire', '18']],
  };
  const sosFor = cc => SOS[cc] || [['Emergency', '112']];
  const distM = (a, b) => { const R = 6371e3, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r;
    const h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };
  const fmtDist = m => m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`;
  const walk = m => `${Math.max(1, Math.round(m / 80))} min walk`;
  let handyCur = null;
  const plain = s => (s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  // The places to look around: stays in Bookings, then any added by hand
  function handyPlaces() {
    // the same hotel twice (two stays, or "Hôtel" vs "Hotel") shows once, keeping the accented spelling
    const stays = [];
    trip.bookings.filter(b => b.kind === 'stay' && (b.name || b.address)).forEach(b => {
      const p = { id: b.id, name: b.name || b.address, address: b.address || '', maps: b.maps || '', stay: b };
      const same = stays.find(q => (b.name && plain(q.name) === plain(b.name)) || (b.address && plain(q.address) === plain(b.address)));
      if (!same) return stays.push(p);
      if (/[^\x00-\x7f]/.test(p.name) && !/[^\x00-\x7f]/.test(same.name)) same.name = p.name;
      if (!same.maps && p.maps) { same.maps = p.maps; same.stay = b; }
    });
    return [...stays, ...(trip.handy || []).map(p => ({ ...p, manual: true, src: p }))];
  }
  // A position from a pasted map link (Google, Waze, Apple). Short share links hide it.
  const SHORT_LINK = /(goo\.gl|maps\.app|g\.co\/|waze\.com\/ul\/h|bit\.ly)/i;
  function coordsFromLink(u) {
    try { u = decodeURIComponent(u || ''); } catch (e) { u = u || ''; }
    const plainC = u.match(/^\s*(-?\d{1,2}\.\d+)\s*,\s*(-?\d{1,3}\.\d+)\s*$/);   // "10.0285, 104.0255"
    if (plainC) return { lat: +plainC[1], lon: +plainC[2] };
    const m = u.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/) || u.match(/[?&](?:q|ll|query|daddr|sll|destination)=(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)/) || u.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    return m ? { lat: +m[1], lon: +m[2] } : null;
  }
  const withTimeout = (url, ms) => { const c = new AbortController(), t = setTimeout(() => c.abort(), ms); return fetch(url, { signal: c.signal }).finally(() => clearTimeout(t)); };
  const placeLabel = pr => [pr.district || pr.locality || pr.city || pr.county, pr.state, pr.country].filter((v, i, a) => v && a.indexOf(v) === i).join(', ');
  // Country words in an address, so emergency numbers can show before the map answers
  const CC_WORDS = { vietnam: 'vn', 'viet nam': 'vn', france: 'fr', malaysia: 'my', singapore: 'sg', thailand: 'th', indonesia: 'id', japan: 'jp', korea: 'kr', philippines: 'ph', cambodia: 'kh', australia: 'au', 'united kingdom': 'gb', uk: 'gb', usa: 'us', 'united states': 'us', 'phu quoc': 'vn', paris: 'fr', 'kuala lumpur': 'my', bali: 'id', bangkok: 'th' };
  const guessCC = t => { const s = plain(t); return Object.entries(CC_WORDS).find(([w]) => new RegExp(`\\b${w}\\b`).test(s))?.[1] || ''; };
  async function reverseCC(pt) {
    try { const f = (await (await withTimeout(`https://photon.komoot.io/reverse?lat=${pt.lat}&lon=${pt.lon}&lang=en`, 6000)).json()).features?.[0]; return f ? { cc: (f.properties.countrycode || '').toLowerCase(), label: placeLabel(f.properties) } : {}; } catch (e) { return {}; }
  }
  // Find a stay on the map: its map link first, else an address search that has to share a place name with the address
  async function locate(p) {
    if (p.manual && p.lat != null) return p;   // added by search or with a full link
    const b = p.stay || p.src || p, key = `v2|${b.name || ''}|${b.address || ''}|${b.maps || ''}`;
    if (b.geo && b.geo.key === key) return { ...p, ...b.geo };
    const fromLink = coordsFromLink(b.maps);
    if (fromLink) { const r = await reverseCC(fromLink); b.geo = { key, ...fromLink, cc: r.cc || guessCC(b.address + ' ' + b.name), label: r.label || '' }; save(); return { ...p, ...b.geo }; }
    const parts = (b.address || '').split(',').map(x => x.trim()).filter(Boolean);
    const places = parts.filter(x => !/\d/.test(x) && plain(x).length >= 4).map(plain);
    const tail = parts.filter(x => !/^\d/.test(x)).slice(-3).join(', ');
    const queries = [b.address, tail, tail && b.name ? `${b.name}, ${tail}` : '', b.name].filter((q, i, a) => q && a.indexOf(q) === i);
    for (const q of queries) {
      try {
        const feats = (await (await withTimeout(`https://photon.komoot.io/api/?q=${encodeURIComponent(q.slice(0, 180))}&limit=5&lang=en`, 8000)).json()).features || [];
        const ok = feats.find(f => {
          if (!places.length) return true;
          const pr = f.properties || {}, hay = plain([pr.name, pr.street, pr.district, pr.locality, pr.city, pr.county, pr.state, pr.country].join(' '));
          return places.some(w => hay.includes(w) || w.includes(plain(pr.city || '~~')) || w.includes(plain(pr.country || '~~')));
        });
        if (ok) { const [lon, lat] = ok.geometry.coordinates; b.geo = { key, lat, lon, cc: (ok.properties.countrycode || '').toLowerCase(), label: placeLabel(ok.properties) }; save(); return { ...p, ...b.geo }; }
      } catch (e) { /* too slow or offline: try the next, simpler search */ }
    }
    return null;
  }
  // Ask several map servers at once; the first good answer wins, nobody waits more than 10 s
  const OVERPASS = ['https://overpass-api.de/api/interpreter', 'https://overpass.private.coffee/api/interpreter', 'https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
  function overpass(q) {
    const ctls = OVERPASS.map(() => new AbortController());
    const timer = setTimeout(() => ctls.forEach(c => c.abort()), 10000);
    return Promise.any(OVERPASS.map((ep, i) => fetch(ep, { method: 'POST', signal: ctls[i].signal, body: 'data=' + encodeURIComponent(q), headers: { 'Content-Type': 'application/x-www-form-urlencoded' } })
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })))
      .then(d => { ctls.forEach(c => c.abort()); return d; })
      .finally(() => clearTimeout(timer));
  }
  const toPlaces = (data, pt) => data.elements.map(e => {
    const t = e.tags || {}, lat = e.lat ?? e.center?.lat, lon = e.lon ?? e.center?.lon, cat = CAT_OF(t);
    if (!cat || lat == null) return null;
    const name = t.name || t['name:en'] || t.brand || t.operator || (cat === 'cash' ? (t.amenity === 'atm' ? 'ATM' : 'Money changer') : HANDY_CATS.find(c => c[0] === cat)[1]);
    return { cat, name, lat, lon, phone: t.phone || t['contact:phone'] || '', d: Math.round(distM(pt, { lat, lon })) };
  }).filter(Boolean);
  const catQuery = (cats, r, pt, cap) => `[out:json][timeout:9];${cats.map(c => `(${c[2].split(';').map(x => `${x}(around:${r},${pt.lat},${pt.lon});`).join('')});out center tags ${cap};`).join('')}`;
  // Step 1: everything within 1 km. Step 2: only for empty categories, the nearest within 5 km.
  async function nearby(pt, onStep) {
    const ck = `xkk-handy2-${pt.lat.toFixed(4)},${pt.lon.toFixed(4)}`;
    try { const c = JSON.parse(localStorage.getItem(ck)); if (c && Date.now() - c.t < 30 * 864e5) return c.list; } catch (e) {}
    const near = toPlaces(await overpass(catQuery(HANDY_CATS, 1000, pt, 60)), pt);
    onStep(near, true);
    const empty = HANDY_CATS.filter(c => !near.some(x => x.cat === c[0]));
    let far = [];
    if (empty.length) { try { far = toPlaces(await overpass(catQuery(empty, 5000, pt, 25)), pt); } catch (e) {} }
    const list = [...near, ...far].sort((a, b) => a.d - b.d);
    try { localStorage.setItem(ck, JSON.stringify({ t: Date.now(), list })); } catch (e) {}
    return list;
  }
  const gSearch = (word, pt) => `https://www.google.com/maps/search/${encodeURIComponent(word)}/@${pt.lat},${pt.lon},16z`;
  async function renderHandy() {
    const places = handyPlaces(), box = $('#handyBody');
    if (!places.some(p => p.id === handyCur)) handyCur = places[0]?.id || null;
    $('#handyTabs').innerHTML = places.map(p => `<button type="button" data-id="${p.id}" class="${p.id === handyCur ? 'on' : ''}">${icon(p.manual ? 'pin' : 'hotel')}<span>${esc(p.name)}</span></button>`).join('')
      + `<button type="button" class="add" id="handyAdd">${icon('plus')}<span>Add place</span></button>`;
    $('#handyTabs').querySelectorAll('[data-id]').forEach(b => b.onclick = () => { handyCur = b.dataset.id; renderHandy(); });
    $('#handyAdd').onclick = () => openHandyLink(null);
    if (!places.length) {
      $('#handyNear').innerHTML = '';
      box.innerHTML = `<div class="empty"><div class="big">${icon('hotel')}</div><p><b>Where are you staying?</b></p><p class="muted">Add a stay in Bookings, or tap Add place, to see the nearest convenience stores, pharmacies, clinics and police.</p></div>`;
      return;
    }
    const p = places.find(p => p.id === handyCur);
    const live = () => handyCur === p.id && currentView() === 'handy';
    let pt = null;
    const sosHtml = cc => cc ? `<div class="hsos"><div class="hhead">${icon('phone')}<b>Emergency numbers</b></div><div class="hsosr">${sosFor(cc).map(([l, n]) => `<a href="tel:${n}"><b>${n}</b><small>${esc(l)}</small></a>`).join('')}</div></div>` : '';
    const row = x => `<div class="hrow"><span><b>${esc(x.name)}</b><small>${fmtDist(x.d)} · ${walk(x.d)}${x.phone ? ` · <a href="tel:${esc(x.phone.replace(/[^\d+]/g, ''))}">${esc(x.phone)}</a>` : ''}</small></span>${mapLink({ place: { name: x.name, lat: x.lat, lon: x.lon } }, 'Map ↗', 'map')}</div>`;
    // Google Maps Search works before the map lookup: by name and address first, by position once known
    const gUrl = c => pt ? gSearch(c[3], pt) : `https://www.google.com/maps/search/${encodeURIComponent(`${c[3]} near ${[p.name, p.address].filter(Boolean).join(', ')}`)}`;
    const gbtn = (c, cls) => `<a class="${cls}" href="${esc(gUrl(c))}" target="_blank" rel="noopener">Google Maps Search</a>`;
    const nearLine = () => {
      $('#handyNear').innerHTML = pt ? `<span>Near: ${esc(pt.label || p.address || `${pt.lat.toFixed(4)}, ${pt.lon.toFixed(4)}`)}</span> · <button type="button" class="hlink" id="hWrong">Wrong place?</button>`
        : `<span>Couldn't find ${esc(p.name)} on the map.</span> <button type="button" class="hlink" id="hWrong">Paste a map link</button>`;
      $('#hWrong').onclick = () => openHandyLink(p);
    };
    // state: 'locating' | 'nomap' | 'busy' | list (partial or final)
    const draw = (list, partial, state) => {
      const cats = HANDY_CATS.map(c => {
        const all = list ? list.filter(x => x.cat === c[0]).sort((a, b) => a.d - b.d) : null, near = all ? all.filter(x => x.d <= 1000).slice(0, 3) : [];
        let body;
        if (!all) body = `<div class="hfind">${state === 'locating' ? '<span class="hwait">Looking nearby…</span>' : 'Find one'} ${gbtn(c, 'btn small')}</div>`;
        else if (near.length) body = near.map(row).join('') + `<div class="hmore">More options · ${gbtn(c, 'hlink')}</div>`;
        else if (all.length) body = `<div class="hnone">None found within 1 km</div><div class="hfind">Find one closer ${gbtn(c, 'btn small')}</div>${row(all[0])}`;
        else body = `<div class="hnone">None found ${partial ? 'within 1 km' : 'nearby'}</div><div class="hfind">${partial ? 'Find one closer' : 'Find one'} ${gbtn(c, 'btn small')}</div>${partial ? '<div class="hnone hwait">Looking further…</div>' : ''}`;
        return `<div class="hcat"><div class="hhead"><b>${c[1]}</b></div>${body}</div>`;
      }).join('');
      const note = state === 'busy' ? `<div class="hcard"><p><b>The map server is busy right now.</b></p><p class="muted">Google Maps Search still works. Once loaded, nearby places are saved for offline use.</p><button type="button" class="btn small" id="hRetry">Try again</button></div>` : '';
      const cc = pt?.cc || guessCC(`${p.address} ${p.name}`);
      box.innerHTML = sosHtml(cc) + note + cats + (list && !partial ? `<div class="hfoot">${p.manual ? `<button type="button" class="linkbtn" id="hRemove">Remove ${esc(p.name)}</button>` : ''}<button type="button" class="linkbtn" id="hRefresh">Refresh list</button><p class="attr">Map data © OpenStreetMap contributors. Some smaller places may be missing: use Google Maps Search to find more.</p></div>`
        : p.manual ? `<div class="hfoot"><button type="button" class="linkbtn" id="hRemove">Remove ${esc(p.name)}</button></div>` : '');
      const rf = $('#hRefresh'); if (rf) rf.onclick = () => { localStorage.removeItem(`xkk-handy2-${pt.lat.toFixed(4)},${pt.lon.toFixed(4)}`); renderHandy(); };
      const rm = $('#hRemove'); if (rm) rm.onclick = () => { trip.handy = (trip.handy || []).filter(x => x.id !== p.id); handyCur = null; save(); renderHandy(); toast('Removed'); };
      const rt = $('#hRetry'); if (rt) rt.onclick = renderHandy;
    };
    $('#handyNear').innerHTML = '<span class="hwait">Finding it on the map…</span>';
    draw(null, true, 'locating');
    pt = await locate(p);
    if (!live()) return;
    nearLine();
    if (!pt) return draw(null, false, 'nomap');
    draw(null, true, 'locating');
    try {
      const list = await nearby(pt, near => { if (live()) draw(near, true); });
      if (live()) draw(list, false);
    } catch (e) { if (live()) draw(null, false, 'busy'); }
  }
  // One drawer for "Add place" (p = null) and "Wrong place?" (p = the place to fix),
  // the same as an itinerary item's location: search a place, or paste a link instead
  let linkFor = null;
  function openHandyLink(p) {
    linkFor = p;
    $('#hlTitle').textContent = p ? `Where is ${p.name}?` : 'Add a place';
    $('#hlSub').textContent = p ? 'Search for it, or paste a map link. It will be used from now on.' : 'Your Airbnb, a friend’s place, or anywhere you’ll be based.';
    $('#hlQ').value = p ? p.name : ''; $('#hlResults').innerHTML = '';
    $('#hlUrl').value = ''; $('#hlName').value = ''; $('#hlErr').hidden = true;
    $('#hlForm').hidden = true; $('#hlSearch').hidden = false; $('#hlShowLink').hidden = false;
    show('#handyAddDrawer');
    if (p) searchPlaces($('#hlQ').value, $('#hlResults'), pickHandy); else setTimeout(() => $('#hlQ').focus(), 250);
  }
  let hlTimer;
  $('#hlQ').addEventListener('input', () => { clearTimeout(hlTimer); hlTimer = setTimeout(() => searchPlaces($('#hlQ').value.trim(), $('#hlResults'), pickHandy), 350); });
  $('#hlShowLink').onclick = () => { $('#hlForm').hidden = false; $('#hlShowLink').hidden = true; $('#hlNameRow').hidden = !!linkFor; setTimeout(() => $('#hlUrl').focus(), 50); };
  // saving a place's position: on the stay (and its booking's map link) or on the added place
  async function placeAt(at, url, name, label, cc) {
    if (linkFor) {
      const target = linkFor.stay || linkFor.src;
      target.maps = url || gmaps(at);
      if (linkFor.manual) Object.assign(target, at, { cc: cc || '', address: target.address || label || '' });
      else { const key = `v2|${target.name || ''}|${target.address || ''}|${target.maps}`; target.geo = { key, ...at, cc: cc || guessCC(`${target.address} ${target.name}`), label: label || '' }; }
      save(); hide(); renderHandy(); if (!linkFor.manual) renderBookings(); toast('Location saved');
      return;
    }
    const id = uid();
    (trip.handy ||= []).push({ id, name: name || 'My place', address: label || '', maps: url || '', ...(at || {}), cc: cc || '' });
    handyCur = id; save(); hide(); renderHandy();
  }
  function pickHandy(pl) { placeAt({ lat: pl.lat, lon: pl.lon }, '', pl.name, pl.address, pl.cc); }
  $('#hlForm').addEventListener('submit', async e => {
    e.preventDefault();
    const raw = $('#hlUrl').value.trim(), name = $('#hlName').value.trim(), err = $('#hlErr');
    if (!raw) { err.textContent = 'Paste a map link first.'; err.hidden = false; return; }
    const at = coordsFromLink(raw), url = /[a-z]/i.test(raw) ? normaliseUrl(raw) : '';   // plain coordinates have no link
    if (at) { const r = await reverseCC(at); return placeAt(at, url || gmaps(at), name || r.label?.split(',')[0], r.label, r.cc); }
    // a short share link: keep it for the Map button, find the place by its name
    if (linkFor) {
      const target = linkFor.stay || linkFor.src; target.maps = url; delete target.geo;
      if (linkFor.manual) { delete target.lat; delete target.lon; }
      save(); hide(); renderHandy(); if (!linkFor.manual) renderBookings(); toast('Link saved');
      return;
    }
    if (!name) { err.textContent = 'Add a name for this place so it can be found on the map.'; err.hidden = false; $('#hlName').focus(); return; }
    placeAt(null, url, name, '', '');
  });

  /* ---------- routing ---------- */
  const VIEWS = ['trips', 'itinerary', 'bookings', 'packing', 'handy'];
  function currentView() { const h = location.hash.slice(1); return VIEWS.includes(h) ? h : 'trips'; }
  let lastView = null;
  function route() {
    const v = currentView();
    if (openEl) hide();
    VIEWS.forEach(x => document.getElementById('v-' + x).classList.toggle('on', x === v));
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
    renderHeader();
    if (v === 'trips') renderTrips();
    if (v === 'packing') renderPacking();
    if (v === 'bookings') renderBookings();
    $('#bookFab').hidden = v !== 'bookings';
    if (v === 'handy') renderHandy();
    if (v === 'itinerary' && lastView !== 'itinerary') { renderDays(); renderGrid(); requestAnimationFrame(scrollToStart); }
    if (v !== 'itinerary') { scrollTo(0, 0); $('#holdTip')?.remove(); }
    lastView = v;
  }
  addEventListener('hashchange', route);

  /* ---------- trips home ---------- */
  const tripRange = t => { const ds = t.days.map(d => d.date).filter(Boolean).sort(); return [ds[0], ds.at(-1)]; };
  function whenLabel(t) {
    const [a, b] = tripRange(t), today = todayISO();
    if (!a) return 'No dates yet';
    if (today < a) { const n = Math.round((new Date(a + 'T00:00:00') - new Date(today + 'T00:00:00')) / 864e5); return n === 1 ? 'Tomorrow!' : `${n} days to go`; }
    if (today <= b) return 'Happening now';
    return 'Done';
  }
  function renderTrips() {
    const list = $('#tripList'), today = todayISO();
    const sorted = [...db.trips].sort((x, y) => (tripRange(x)[0] || '9').localeCompare(tripRange(y)[0] || '9'));
    const upcoming = sorted.filter(t => !tripRange(t)[1] || tripRange(t)[1] >= today);
    const past = sorted.filter(t => tripRange(t)[1] && tripRange(t)[1] < today).reverse();
    const card = t => {
      const [c, bg] = PALETTE[t.color % PALETTE.length], [a, b] = tripRange(t);
      const dates = a ? `${fmtDate(a, { day: 'numeric', month: 'short' })} – ${fmtDate(b, { day: 'numeric', month: 'short', year: 'numeric' })}` : '';
      return `<div class="tcard${t.id === db.current ? ' cur' : ''}${past.includes(t) ? ' past' : ''}" data-id="${t.id}" style="--c:${c};--bg:${bg}">
        <span class="tc-ic">${icon('map')}${t.id === db.current ? `<span class="tick" aria-label="Selected">${icon('check')}</span>` : ''}</span>
        <span class="tc-b"><b>${esc(t.title || 'My trip')}</b><small>${dates}${dates ? ' · ' : ''}${t.days.length} day${t.days.length === 1 ? '' : 's'}</small><span class="when">${whenLabel(t)}</span></span>
        <button type="button" class="round" data-menu="${t.id}" aria-label="Trip options">${icon('more')}</button></div>`;
    };
    list.innerHTML = (upcoming.length ? upcoming.map(card).join('') : '<p class="muted" style="padding:8px 4px">No upcoming trips. Tap New Trip to start one.</p>')
      + (past.length ? `<div class="subhead">Past trips</div>${past.map(card).join('')}` : '');
    list.querySelectorAll('.tcard').forEach(el => el.addEventListener('click', e => {
      if (e.target.closest('[data-menu]')) { openTripMenu(e.target.closest('[data-menu]').dataset.menu); return; }
      openTrip(el.dataset.id);
    }));
  }
  function openTrip(id) {
    db.current = id; trip = db.trips.find(t => t.id === id); save();
    const ti = trip.days.findIndex(d => d.date === todayISO()); cur = ti >= 0 ? ti : 0;
    lastView = null;
    location.hash = '#itinerary';
    if (currentView() === 'itinerary') route();
  }

  // New trip
  const ntf = $('#newTripForm');
  $('#newTripBtn').onclick = () => { ntf.title.value = ''; ntf.start.value = todayISO(); ntf.end.value = addDays(todayISO(), 2); ntf.dataset.endTouched = ''; $('#ntErr').hidden = true; show('#newTrip'); };
  // End date follows the start date until it's changed by hand
  ntf.start.addEventListener('change', () => { if (!ntf.dataset.endTouched && ntf.start.value) ntf.end.value = addDays(ntf.start.value, 2); $('#ntErr').hidden = true; });
  ntf.end.addEventListener('change', () => { ntf.dataset.endTouched = '1'; $('#ntErr').hidden = true; });
  ntf.addEventListener('submit', e => {
    e.preventDefault();
    const s0 = ntf.start.value || todayISO(), e0 = ntf.end.value || s0;
    if (e0 < s0) { $('#ntErr').textContent = 'End date is before the start date.'; $('#ntErr').hidden = false; flagError(ntf.end); return; }
    const n = Math.min(60, Math.round((new Date(e0 + 'T00:00:00') - new Date(s0 + 'T00:00:00')) / 864e5) + 1);
    const t = normTrip({ title: ntf.title.value.trim() || 'New trip', days: Array.from({ length: n }, (_, i) => ({ id: uid(), date: addDays(ntf.start.value || todayISO(), i), label: '', items: [] })) }, db.trips.length);
    db.trips.push(t); save(); hide(); toast('Trip created');
    openTrip(t.id);
  });

  // Trip menu
  let menuTrip = null;
  function openTripMenu(id) {
    menuTrip = db.trips.find(t => t.id === id);
    $('#tripMenuTitle').textContent = menuTrip.title || 'Trip';
    $('#tmDelete').textContent = 'Delete trip'; $('#tmDelete').dataset.armed = '';
    show('#tripMenu');
  }
  $('#tmRename').onclick = () => openPrompt({ title: 'Rename trip', value: menuTrip.title, onSave: v => { menuTrip.title = v || 'My trip'; save(); renderTrips(); } });
  $('#tmDuplicate').onclick = () => {
    const copy = normTrip(structuredClone(menuTrip), db.trips.length);
    copy.id = uid(); copy.title = `${menuTrip.title} (copy)`; copy.color = db.trips.length % PALETTE.length;
    copy.days.forEach(d => { d.id = uid(); d.items.forEach(i => i.id = uid()); });
    copy.packing.travelers.forEach(tr => { tr.id = uid(); tr.sections.forEach(s => { s.id = uid(); s.items.forEach(i => { i.id = uid(); i.done = false; }); }); });
    copy.packing.cur = copy.packing.travelers[0]?.id;
    copy.bookings.forEach(b => { b.id = uid(); b.itemIds = []; });
    copy.days.forEach(d => d.items.forEach(i => delete i.bookingId));
    db.trips.push(copy); save(); hide(); renderTrips(); toast('Trip duplicated');
  };
  $('#tmDelete').onclick = e => {
    const b = e.currentTarget;
    if (db.trips.length === 1) { toast('Create another trip first'); return; }
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap again to delete for good'; return; }
    db.trips = db.trips.filter(t => t !== menuTrip);
    if (db.current === menuTrip.id) { db.current = db.trips[0].id; trip = db.trips[0]; cur = 0; }
    save(); hide(); renderTrips(); renderHeader(); toast('Trip deleted');
  };

  /* ---------- generic name prompt ---------- */
  let promptCfg = null;
  function openPrompt(cfg) {
    promptCfg = cfg;
    $('#promptTitle').textContent = cfg.title;
    $('#promptInput').value = cfg.value || '';
    $('#promptInput').placeholder = cfg.placeholder || '';
    $('#promptDelete').hidden = !cfg.onDelete; $('#promptDelete').textContent = 'Delete'; $('#promptDelete').dataset.armed = '';
    show('#promptDrawer');
    setTimeout(() => $('#promptInput').focus(), 260);
  }
  $('#promptForm').addEventListener('submit', e => { e.preventDefault(); const v = $('#promptInput').value.trim(); if (!v && !promptCfg.allowEmpty) { flagError($('#promptInput')); return; } hide(); promptCfg.onSave(v); });
  $('#promptDelete').onclick = e => {
    const b = e.currentTarget;
    if (!b.dataset.armed) { b.dataset.armed = '1'; b.textContent = 'Tap to confirm'; return; }
    hide(); promptCfg.onDelete();
  };
  $('#promptInput').addEventListener('input', e => e.target.classList.remove('invalid'));

  /* ---------- packing: one list per traveller ---------- */
  const STARTER = [
    ['Documents & money', ['Passports', 'Travel insurance', 'Booking confirmations', 'Some local cash', 'Main + backup card']],
    ['Medicine', ['Paracetamol', 'Stomach medicine', 'Plasters', 'Insect repellent', 'Any regular prescriptions']],
    ['Tech', ['Phone charger', 'Power bank', 'Travel adapter', 'eSIM / data plan']],
    ['Clothes', ['Tops', 'Bottoms', 'Underwear', 'Sleepwear', 'Light jacket']],
  ];
  const mkSection = (name, items = []) => ({ id: uid(), name, items: items.map(text => ({ id: uid(), text, done: false })) });
  const curTraveler = () => { const P = trip.packing; return P.travelers.find(t => t.id === P.cur) || P.travelers[0]; };
  const countOf = tr => { const all = tr.sections.flatMap(s => s.items); return [all.filter(i => i.done).length, all.length]; };

  function renderPacking() {
    const P = trip.packing, me = curTraveler();
    P.cur = me.id;
    // traveller tabs
    const tabs = $('#packTabs'); tabs.innerHTML = '';
    P.travelers.forEach(tr => {
      const [d, n] = countOf(tr), btn = document.createElement('button');
      btn.className = tr === me ? 'on' : '';
      btn.innerHTML = `<b>${esc(tr.name)}</b><span>${n ? `${d}/${n}` : 'empty'}</span>`;
      btn.onclick = () => { P.cur = tr.id; save(); renderPacking(); };
      tabs.appendChild(btn);
    });
    const add = document.createElement('button');
    add.className = 'add'; add.textContent = '+ Traveller';
    add.onclick = () => openPrompt({ title: 'New traveller', placeholder: 'e.g. Jolie', onSave: v => {
      const tr = { id: uid(), name: v, sections: [] }; P.travelers.push(tr); P.cur = tr.id; save(); renderPacking(); } });
    tabs.appendChild(add);
    tabs.querySelector('.on')?.scrollIntoView({ inline: 'nearest', block: 'nearest' });

    $('#packName').textContent = me.name;
    const [done, total] = countOf(me);
    $('#packBar').style.width = total ? `${done / total * 100}%` : '0';
    $('#packTxt').textContent = total ? `${done} of ${total} packed` : '';
    $('.packtop').hidden = !me.sections.length;

    const list = $('#packList');
    const whose = P.travelers.indexOf(me) === 0 ? 'Your list' : `${esc(me.name)}'s list`;
    if (!me.sections.length && !me.started) {
      // First thing on an empty list: the Start button
      list.innerHTML = `<div class="pstart"><button type="button" class="btn" id="packBegin">${icon('bag')}Start packing list</button><p><b>${whose} is empty</b></p><p class="muted">Start from a list, copy someone else's, or build your own.</p></div>`;
      $('#packBegin').onclick = openPackStart;
      return;
    }
    if (!me.sections.length) {
      list.innerHTML = `<div class="pstart"><button type="button" class="btn" id="packFirstCat">${icon('plus')}Add a category</button><p><b>${whose} is empty</b></p><p class="muted">Categories keep things tidy, e.g. Clothes, Toiletries, Documents.</p></div>`;
      $('#packFirstCat').onclick = () => $('#addCat').click();
      return;
    }
    list.innerHTML = '';
    me.sections.forEach(s => {
      const card = document.createElement('div');
      card.className = 'pcard';
      const n = s.items.filter(i => i.done).length;
      card.innerHTML = `<div class="ph"><span class="pi">${icon('list')}</span><b>${esc(s.name)}</b><small>${n}/${s.items.length}</small>
        <button type="button" class="round" aria-label="Category options">${icon('more')}</button></div>`;
      s.items.forEach(it => {
        const row = document.createElement('div');
        row.className = 'prow' + (it.done ? ' done' : '');
        row.innerHTML = `<label><input type="checkbox" ${it.done ? 'checked' : ''}><span>${esc(it.text)}</span></label><button type="button" class="del" aria-label="Remove">${icon('x')}</button>`;
        row.querySelector('input').onchange = e => { it.done = e.target.checked; save(); renderPacking(); };
        row.querySelector('.del').onclick = () => { s.items = s.items.filter(x => x !== it); save(); renderPacking(); };
        card.appendChild(row);
      });
      const form = document.createElement('form');
      form.className = 'padd';
      form.innerHTML = `${icon('plus')}<input placeholder="Add item…" enterkeyhint="done">`;
      form.onsubmit = e => {
        e.preventDefault();
        const v = form.querySelector('input').value.trim(); if (!v) return;
        s.items.push({ id: uid(), text: v, done: false }); save(); renderPacking();
        $('#packList').querySelectorAll('.pcard')[me.sections.indexOf(s)]?.querySelector('.padd input')?.focus();
      };
      card.appendChild(form);
      card.querySelector('.ph .round').onclick = () => openPrompt({
        title: 'Rename category', value: s.name,
        onSave: v => { s.name = v; save(); renderPacking(); },
        onDelete: () => { me.sections = me.sections.filter(x => x !== s); save(); renderPacking(); toast('Category removed'); },
      });
      list.appendChild(card);
    });
  }
  $('#packEdit').onclick = () => {
    const P = trip.packing, me = curTraveler();
    openPrompt({ title: 'Rename traveller', value: me.name,
      onSave: v => { me.name = v; save(); renderPacking(); },
      onDelete: P.travelers.length > 1 ? () => { P.travelers = P.travelers.filter(t => t !== me); P.cur = P.travelers[0].id; save(); renderPacking(); toast('Traveller removed'); } : null });
  };
  $('#addCat').onclick = () => openPrompt({ title: 'New category', placeholder: 'e.g. Toiletries', onSave: v => { const me = curTraveler(); me.started = true; me.sections.push(mkSection(v)); save(); renderPacking(); } });
  $('#untickAll').onclick = () => { curTraveler().sections.forEach(s => s.items.forEach(i => i.done = false)); save(); renderPacking(); toast('All unticked'); };
  function openPackStart() {
    const me = curTraveler();
    const here = trip.packing.travelers.filter(t => t !== me && t.sections.length).map(t => ['t:' + t.id, `Copy from ${t.name}`, `${t.sections.length} categories · ${countOf(t)[1]} items`]);
    const others = db.trips.filter(t => t !== trip).flatMap(t => t.packing.travelers.filter(tr => tr.sections.length).map(tr => ['o:' + t.id + ':' + tr.id, `Copy from ${t.title} · ${tr.name}`, `${countOf(tr)[1]} items`]));
    const opts = [['starter', 'Starter list', 'Documents, medicine, tech, clothes'], ...here, ...others, ['blank', 'Blank list', 'Add your own categories']];
    $('#packStartOpts').innerHTML = opts.map(([v, l, d]) => `<button type="button" data-v="${esc(v)}">${esc(l)}<small>${esc(d)}</small></button>`).join('');
    $('#packStartOpts').querySelectorAll('button').forEach(btn => btn.onclick = () => {
      const v = btn.dataset.v, clone = src => src.sections.map(s => mkSection(s.name, s.items.map(i => i.text)));
      if (v === 'starter') me.sections = STARTER.map(([n, items]) => mkSection(n, items));
      else if (v.startsWith('t:')) me.sections = clone(trip.packing.travelers.find(t => t.id === v.slice(2)));
      else if (v.startsWith('o:')) { const [, tid, rid] = v.split(':'); me.sections = clone(db.trips.find(t => t.id === tid).packing.travelers.find(t => t.id === rid)); }
      else me.sections = [];
      me.started = true;
      save(); hide(); renderPacking();
    });
    show('#packStart');
  }

  /* ---------- go ---------- */
  function render() { renderHeader(); renderDays(); renderGrid(); }
  const t = todayISO(), ti = trip.days.findIndex(d => d.date === t);
  if (ti >= 0) cur = ti;
  if (db.__relink?.length) {
    db.__relink.forEach(([tid, bid]) => {
      const t = db.trips.find(x => x.id === tid), b = t?.bookings.find(x => x.id === bid);
      if (!b) return;
      const keep = trip; trip = t; unlinkBooking(b); linkBooking(b); trip = keep;
    });
    delete db.__relink; save();
  }
  route();

  // service worker (network-first while we build)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
