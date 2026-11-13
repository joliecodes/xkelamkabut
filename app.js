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
    title: 'Phu Quoc',
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

  let trip = store.load() || structuredClone(SAMPLE);
  let cur = 0;
  const save = () => store.save(trip);

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
    $('#tripTitle').textContent = trip.title || 'My trip';
    const ds = trip.days.map(d => d.date).filter(Boolean).sort();
    $('#tripDates').textContent = ds.length
      ? `${fmtDate(ds[0], { day: 'numeric', month: 'short' })} – ${fmtDate(ds.at(-1), { day: 'numeric', month: 'short', year: 'numeric' })} · ${trip.days.length} day${trip.days.length > 1 ? 's' : ''}`
      : 'Tap + Add Day to start';
    document.title = `${trip.title} · xkelamkabut`;
  }
  $('#tripTitle').addEventListener('blur', e => { trip.title = e.target.textContent.trim() || 'My trip'; save(); renderHeader(); });
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

    // side-by-side columns for overlapping items
    layoutColumns(items).forEach(({ x, s, e, col, cols }) => {
      const el = itemEl(x, s, e);
      el.style.top = `${y(s) + 1}px`;
      el.style.height = `${Math.max((e - s) / 60 * HOUR_PX - 3, 22)}px`;
      el.style.left = `calc(${(col / cols) * 100}% + ${col ? 2 : 0}px)`;
      el.style.width = `calc(${100 / cols}% - ${cols > 1 ? 2 : 0}px)`;
      lane.appendChild(el);
    });

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

  function itemEl(x, s, e) {
    const T = TYPES[x.type] || TYPES.other;
    const typeKey = TYPES[x.type] ? x.type : 'other';
    const mins = e - s;
    const el = document.createElement('div');
    el.className = 'item' + (mins <= 30 ? ' short' : '') + (mins >= 90 ? ' tall' : '');
    el.style.setProperty('--c', T.c); el.style.setProperty('--bg', T.bg);
    el.innerHTML = `<div class="ic">${icon(typeKey)}</div>
      <div class="body"><div class="t">${esc(x.title)}</div>
      <div class="m">${fmtTime(x.start)}${x.end ? ' – ' + fmtTime(x.end) : ''}</div></div>
      <div class="flags">${x.notes ? `<span title="Has notes">${icon('note')}</span>` : ''}${undecided(x) ? `<span class="optpill">${x.options.length} options</span>` : primaryMapUrl(x) ? `<a class="map" href="${esc(primaryMapUrl(x))}" target="_blank" rel="noopener">Map ↗</a>` : ''}</div>`;
    el.addEventListener('click', ev => { if (!ev.target.closest('.map')) openView(x); });
    return el;
  }

  /* ---------- view item ---------- */
  let viewing = null;
  function openView(x) {
    if (viewing !== x) deciding = false;
    viewing = x;
    const k = TYPES[x.type] ? x.type : 'other', T = TYPES[k];
    const d = $('#viewDrawer');
    d.style.setProperty('--c', T.c); d.style.setProperty('--bg', T.bg);
    $('#vBadge').innerHTML = icon(k);
    $('#vType').textContent = T.label;
    $('#vTitle').textContent = x.title;
    $('#vTime').textContent = fmtTime(x.start) + (x.end ? ' – ' + fmtTime(x.end) : '');
    $('#vNotesRow').hidden = !x.notes;
    $('#vNotes').textContent = x.notes || '';
    const loc = effLoc(x), p = loc?.place;
    $('#vPlaceRow').hidden = !p;
    if (p) $('#vPlace').innerHTML = `<b>${esc(p.name)}</b>${p.address ? `<small>${esc(p.address)}</small>` : ''}`;
    const links = [];
    if (loc?.maps) links.push(['Open in maps ↗', loc.maps, 'primary']);
    if (p) links.push(...openInLinks(p));
    renderViewOptions(x);
    $('#vLinks').innerHTML = links.map(([label, href, cls]) =>
      `<a class="btn ${cls || 'ghost'}" href="${esc(href)}" target="_blank" rel="noopener">${label}</a>`).join('');
    $('#vLinks').hidden = !links.length;
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
        : `<a href="${esc(optionUrl(o))}" target="_blank" rel="noopener"><span>${esc(o.name)}</span><i>↗</i></a>`).join('');
      $('#vPills').querySelectorAll('button').forEach(b => b.onclick = () => {
        x.decided = b.dataset.id; deciding = false; save(); renderGrid(); openView(x); toast('Decided!');
      });
      $('#vDecide').textContent = deciding ? 'Cancel' : 'Decide';
    } else {
      const others = opts.filter(o => o !== picked);
      $('#vOtherSum').textContent = `Other options (${others.length})`;
      $('#vOtherPills').innerHTML = others.map(o => `<a href="${esc(optionUrl(o))}" target="_blank" rel="noopener"><span>${esc(o.name)}</span><i>↗</i></a>`).join('');
      $('#vOther').open = false;
    }
  }
  $('#vDecide').onclick = () => { deciding = !deciding; renderViewOptions(viewing); };
  $('#vChange').onclick = () => { viewing.decided = null; deciding = true; save(); renderGrid(); openView(viewing); };

  /* ---------- item drawer ---------- */
  const form = $('#itemForm');
  let editing = null, pickedType = 'activity', pendingStart = '';
  const PLACEHOLDER = { activity: 'e.g. Beach', meal: 'Meal', rest: 'Rest', transport: 'e.g. Grab to airport', other: 'e.g. Shopping' };
  const DEFAULT_TITLE = { rest: 'Rest', meal: 'Meal' };
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
    $('#linkField').hidden = !item?.maps; $('#showLink').hidden = !!item?.maps;
    setPlace(item?.place || null); $('#placeQ').value = ''; $('#placeResults').innerHTML = '';
    draftOpts = structuredClone(item?.options || []); draftDecided = item?.decided || null;
    $('#optQ').value = ''; $('#optResults').innerHTML = ''; $('#optLinkForm').hidden = true; $('#optLinkBtn').hidden = false;
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
    const clash = findOverlap(day, data, editing);
    if (clash) {
      $('#timeErr').textContent = `Overlaps with ${clash.title} (${fmtTime(clash.start)}${clash.end ? ' – ' + fmtTime(clash.end) : ''}). Pick another time.`;
      $('#timeErr').hidden = false;
      flagError(form.start); if (data.end) flagError(form.end);
      return;
    }
    if (editing) Object.assign(editing, data);
    else day.items.push({ id: uid(), ...data });
    save(); renderGrid();
    if (editing) openView(editing); else hide();
    toast(editing ? 'Saved' : 'Added');
  });

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
      if (prev.maps) { form.maps.value = prev.maps; $('#linkField').hidden = false; $('#showLink').hidden = true; }
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
        return { name, address, lat: +lat.toFixed(6), lon: +lon.toFixed(6) };
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
  $('#optLinkBtn').onclick = () => { $('#optLinkBtn').hidden = true; $('#optLinkForm').hidden = false; $('#optName').focus(); };
  $('#optAdd').onclick = () => {
    const name = $('#optName').value.trim(), url = normaliseUrl($('#optUrl').value.trim());
    if (!name) { flagError($('#optName')); return; }
    if (!url) { flagError($('#optUrl')); return; }
    draftOpts.push({ id: uid(), name, place: null, maps: url });
    $('#optName').value = ''; $('#optUrl').value = ''; renderOptList();
  };
  ['optName', 'optUrl', 'optQ', 'placeQ'].forEach(id => $('#' + id).addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); if (id === 'optUrl') $('#optAdd').click(); } }));
  ['optName', 'optUrl'].forEach(id => $('#' + id).addEventListener('input', e => e.target.classList.remove('invalid')));

  $('#showLink').onclick = () => { $('#showLink').hidden = true; $('#linkField').hidden = false; form.maps.focus(); };
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
  function openInLinks(p) {
    const ll = `${p.lat},${p.lon}`, q = encodeURIComponent(p.name);
    return [
      ['Google Maps', `https://www.google.com/maps/search/?api=1&query=${ll}`],
      ['Waze', `https://waze.com/ul?ll=${ll}&navigate=yes`],
    ];
  }

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

  /* ---------- routing ---------- */
  const VIEWS = ['itinerary', 'bookings'];
  function route() {
    const v = VIEWS.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'itinerary';
    VIEWS.forEach(x => document.getElementById('v-' + x).classList.toggle('on', x === v));
    document.querySelectorAll('.tabs a').forEach(a => a.classList.toggle('on', a.dataset.v === v));
  }
  addEventListener('hashchange', route);

  /* ---------- go ---------- */
  function render() { renderHeader(); renderDays(); renderGrid(); }
  const t = todayISO(), ti = trip.days.findIndex(d => d.date === t);
  if (ti >= 0) cur = ti;
  render(); route(); requestAnimationFrame(scrollToStart);

  // service worker (network-first while we build)
  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
})();
