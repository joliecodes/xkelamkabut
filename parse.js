/* xkelamkabut: read booking details out of PDF text.
   Works on text rebuilt in reading order (`text`) plus a column-by-column
   version (`cols`) for two-column layouts such as hotel vouchers.
   Pattern matching only: every result is shown in a form for the user to check. */
(function (root) {
  const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
  const MON = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
  const pad = n => String(n).padStart(2, '0');
  const iso = (y, m, d) => (y && m && d) ? `${y}-${pad(m)}-${pad(d)}` : '';
  const clean = s => (s || '').replace(/\s+/g, ' ').trim();

  // "30 November 2026", "November 30, 2026", "Mon, Nov 30", "30 Nov", "30/11/2026", "2026-11-30"
  function parseDate(s, fallbackYear) {
    if (!s) return '';
    let m;
    if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) return iso(+m[1], +m[2], +m[3]);
    if ((m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s+${MON}\\.?,?\\s*(\\d{4})?`, 'i'))))
      return iso(+(m[3] || fallbackYear), MONTHS[m[2].slice(0, 3).toLowerCase()], +m[1]);
    if ((m = s.match(new RegExp(`${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s*(\\d{4})?`, 'i'))))
      return iso(+(m[3] || fallbackYear), MONTHS[m[1].slice(0, 3).toLowerCase()], +m[2]);
    if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return iso(+m[3], +m[2], +m[1]);
    return '';
  }
  const DATE_RE = new RegExp(`(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s+${MON}\\.?,?(?:\\s*\\d{4})?|${MON}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?,?(?:\\s*\\d{4})?|\\d{1,2}/\\d{1,2}/\\d{4})`, 'i');
  const yearIn = t => +((t.match(/\b(20\d{2})\b/) || [])[1] || new Date().getFullYear());
  const time24 = s => { const m = (s || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i); if (!m) return ''; let h = +m[1]; if (m[3]) { const pm = /pm/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; } return `${pad(h)}:${m[2]}`; };

  const AIRLINES = ['AirAsia X', 'AirAsia', 'Malaysia Airlines', 'Batik Air', 'Firefly', 'MYAirline', 'Singapore Airlines', 'Scoot', 'Jetstar', 'VietJet Air', 'Vietjet', 'Vietnam Airlines', 'Bamboo Airways', 'Thai AirAsia', 'Thai Airways', 'Garuda Indonesia', 'Lion Air', 'Cebu Pacific', 'Philippine Airlines', 'Cathay Pacific', 'Emirates', 'Qatar Airways', 'Etihad', 'Turkish Airlines', 'Japan Airlines', 'ANA', 'Korean Air', 'EVA Air', 'China Airlines', 'Qantas', 'British Airways', 'KLM', 'Lufthansa'];
  const NOT_AIRPORT = new Set(['GMT', 'UTC', 'THE', 'AND', 'FOR', 'PDF', 'USD', 'MYR', 'VND', 'SGD', 'THB', 'IDR', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'PNR', 'ETA', 'ETD', 'VAT', 'GST', 'SST', 'ID', 'NON']);

  function detectKind(t) {
    const f = (t.match(/\b(flight|airline|airport|depart|boarding|baggage|carry-on|seat \d|terminal|PNR|non-stop)\b/gi) || []).length;
    const s = (t.match(/\b(hotel|check-?in|check-?out|room type|property|arrival|guest|nights?|resort|agoda|booking\.com|voucher)\b/gi) || []).length;
    if (!f && !s) return 'other';
    return f >= s ? 'flight' : 'stay';
  }

  function bookingRef(t) {
    const m = t.match(/\b(?:booking\s*(?:no|number|ref(?:erence)?|code|id)|confirmation\s*(?:no|number|code)?|PNR|record locator|reservation\s*(?:no|number|code)?)\.?\s*[:#]?\s*\n?\s*([A-Z0-9][A-Z0-9-]{4,14})\b/i);
    return m ? m[1] : '';
  }

  /* ---------- flights ---------- */
  function parseFlights(text) {
    const year = yearIn(text);
    const ref = bookingRef(text);
    const flightNoRe = /\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{2,4})\b/g;
    const airlineRe = new RegExp(`(${AIRLINES.map(a => a.replace(/ /g, '\\s')).join('|')})`, 'i');

    // Airport code pairs in order, e.g. "KUL   PQC"
    const pairs = [];
    text.split('\n').forEach(l => {
      const m = l.trim().match(/^([A-Z]{3})\s+(?:→|->|-|to)?\s*([A-Z]{3})$/);
      if (m && !NOT_AIRPORT.has(m[1]) && !NOT_AIRPORT.has(m[2])) pairs.push([m[1], m[2]]);
    });

    // Sections that start with a heading holding a full date ("Depart: Monday, 30 November 2026")
    const lines = text.split('\n');
    const heads = [];
    lines.forEach((l, i) => {
      if (/^\s*(depart(?:ure)?|return|outbound|inbound|onward|flight\s*\d)\b/i.test(l) && DATE_RE.test(l) && /\d{4}/.test(l)) heads.push(i);
    });
    let sections = heads.map((h, k) => lines.slice(h, heads[k + 1] ?? lines.length).join('\n'));

    // Fallback: no headings, so cut around each flight number
    if (!sections.length) {
      const idx = [...text.matchAll(flightNoRe)].filter(m => !/^\d+$/.test(m[1])).map(m => m.index);
      sections = idx.map((at, k) => text.slice(Math.max(0, (idx[k - 1] ?? 0)), idx[k + 1] ?? text.length));
    }

    // Seats and baggage per leg from add-on blocks ("Kuala Lumpur to Phu Quoc ... Seat 27E")
    const addons = text.split(/\n(?=[A-Z][A-Za-z .'-]+ to [A-Z][A-Za-z .'-]+\n)/).slice(1);
    const seatsPerLeg = addons.map(b => [...b.matchAll(/\bSeat\s*(\d{1,2}[A-K])\b/gi)].map(m => m[1]));
    const allSeats = [...text.matchAll(/\bSeat\s*(\d{1,2}[A-K])\b/gi)].map(m => m[1]);
    const bag = (text.match(/checked\s*baggage\s*(\d+\s?kg)/i) || text.match(/(\d+\s?kg)\s*checked/i) || [])[1] || '';
    const carry = (text.match(/(\d+\s?kg)\s*carry-?on/i) || [])[1] || '';

    const flights = sections.map((sec, k) => {
      const head = sec.split('\n')[0];
      const depDate = parseDate(head, year);
      const fn = [...sec.matchAll(flightNoRe)].find(m => !/^\d+$/.test(m[1]) && !/^GMT/i.test(sec.slice(Math.max(0, m.index - 3), m.index + 3)));
      const airline = (sec.match(airlineRe) || [])[1] || '';
      const times = [...sec.matchAll(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)/gi)].map(m => time24(m[1]));
      // short dates inside the section ("30 Nov", "03 Dec"): the last one is the arrival date
      const short = [...sec.split('\n').slice(1).join('\n').matchAll(new RegExp(`\\b(\\d{1,2}\\s+${MON})\\b`, 'gi'))].map(m => parseDate(m[1], year));
      const cityLines = sec.split('\n').filter(l => /^\s*\d{1,2}:\d{2}/.test(l)).map(l => clean(l.replace(/^\s*\d{1,2}:\d{2}\s*(am|pm)?/i, '')));
      const terminal = (sec.match(/terminal\s*\w+/i) || [])[0] || '';
      const pair = pairs[k] || [];
      const seats = seatsPerLeg[k]?.length ? seatsPerLeg[k] : (allSeats.length && sections.length ? allSeats.slice(k * allSeats.length / sections.length, (k + 1) * allSeats.length / sections.length) : []);
      return {
        airline,
        flightNo: fn ? `${fn[1]} ${fn[2]}` : '',
        ref,
        from: pair[0] || '', to: pair[1] || '',
        fromCity: cityLines[0] || '', toCity: cityLines[1] || '',
        depDate: depDate || short[0] || '',
        depTime: times[0] || '',
        arrDate: short.length > 1 ? short.at(-1) : (depDate || short[0] || ''),
        arrTime: times[1] || '',
        duration: (() => { const m = sec.match(/\b(\d{1,2})\s*h(?:rs?|ours?)?\s*(\d{1,2})?\s*m?(?:in)?\b/i); return m ? `${+m[1]}h${m[2] ? ' ' + (+m[2]) + 'm' : ''}` : ''; })(),
        seats: seats.join(', '),
        baggage: [bag && `${bag.replace(/\s/g, '')} checked`, carry && `${carry.replace(/\s/g, '')} carry-on`].filter(Boolean).join(' + '),
        notes: terminal,
      };
    }).filter(f => f.flightNo || f.depTime);
    return flights;
  }

  /* ---------- stays ---------- */
  const LABEL = /^[A-Z][A-Za-z ./()-]{1,40}\s*:/;
  function after(src, labelRe, stopRe, maxLines = 6) {
    const lines = src.split('\n');
    const i = lines.findIndex(l => labelRe.test(l));
    if (i < 0) return '';
    const first = lines[i].replace(labelRe, '').trim();
    const out = first ? [first] : [];
    for (let j = i + 1; j < lines.length && out.length < maxLines; j++) {
      const l = lines[j].trim();
      if (!l || (stopRe && stopRe.test(l))) break;
      out.push(l);
    }
    return out.join('\n');
  }
  function parseStay(text, cols) {
    const src = cols || text, year = yearIn(text);
    // name: prefer a Latin name in brackets ("Khách sạn X (X Hotel)")
    let block = after(src, /^\s*(property|hotel(?: name)?|accommodation)\s*:/i, /^(address|check|arrival|phone|tel|contact|property contact)/i, 4);
    block = block.split('\n').map(l => l.replace(/^(hotel|property)\s*:\s*/i, '')).join(' ');
    const br = block.match(/\(([^()]*[A-Za-z][^()]*)\)/);
    let name = clean(br ? br[1] : block.split(/\s{3,}|\n/)[0]);
    if (!name) name = clean((src.match(/^(.*\b(?:hotel|resort|inn|hostel|villa|suites?|boutique)\b.*)$/im) || [])[1]);

    let address = clean(after(src, /^\s*address\s*:/i, /^(property|hotel|phone|tel|contact|check|arrival|number of|room|booking)\b/i, 5).replace(/\n/g, ' '));
    const pc = address.match(/^(.*?\b\d{5,6}\b)/); if (pc) address = pc[1];       // stop after the postcode
    const phone = clean((src.match(/(?:contact\s*number|phone|tel(?:ephone)?)\s*:?\s*(\+?\d[\d\s()-]{6,}\d)/i) || [])[1]);
    const ref = (text.match(/\b(?:booking\s*id|confirmation\s*(?:no|number|code)|reservation\s*(?:no|number|code)|booking\s*(?:no|number|reference))\.?\s*[:#]?\s*([A-Z0-9-]{5,})/i) || [])[1] || bookingRef(text);
    const grab = re => { const m = text.match(re); return m ? parseDate(m[1], year) : ''; };
    const inDate = grab(new RegExp(`(?:arrival|check[- ]?in)(?:\\s*date)?\\s*:?\\s*(?:[A-Za-z]{3,9},?\\s*)?${DATE_RE.source}`, 'i'));
    const outDate = grab(new RegExp(`(?:departure|check[- ]?out)(?:\\s*date)?\\s*:?\\s*(?:[A-Za-z]{3,9},?\\s*)?${DATE_RE.source}`, 'i'));
    const inTime = time24((text.match(/check[- ]?in[^\n]{0,30}?(\d{1,2}:\d{2}\s*(?:am|pm)?)/i) || [])[1]);
    const outTime = time24((text.match(/check[- ]?out[^\n]{0,30}?(\d{1,2}:\d{2}\s*(?:am|pm)?)/i) || [])[1]);
    let room = after(src, /^\s*room\s*type\s*:/i, LABEL, 2).split('\n');
    room = clean(room.length > 1 && room[1].length < 25 ? room.join(' ') : room[0]);
    const included = clean((text.match(/benefits\s*included\s*:?\s*(.+)/i) || [])[1]);
    return { name, address, phone, ref, inDate, inTime, outDate, outTime, room, notes: included ? `Included: ${included}` : '' };
  }

  function parseBooking({ text, cols }) {
    const kind = detectKind(text);
    if (kind === 'flight') return { kind, flights: parseFlights(text) };
    if (kind === 'stay') return { kind, stay: parseStay(text, cols) };
    return { kind: 'other', other: { ref: bookingRef(text), date: parseDate((text.match(DATE_RE) || [])[0], yearIn(text)) } };
  }

  const api = { parseBooking, parseDate, detectKind };
  if (typeof module !== 'undefined') module.exports = api; else root.XKKParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
