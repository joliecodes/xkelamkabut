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

  // No year on the page: take the next year (from today) where the date is still ahead,
  // and, when a weekday is written next to it ("Sat 30 Jan"), the year where it falls on that day
  const WD = { sun: 0, mon: 1, tue: 2, wed: 3, thu: 4, fri: 5, sat: 6 };
  function guessYear(mo, d, ctx) {
    const now = new Date(), y0 = now.getFullYear(), soon = new Date(now - 30 * 864e5);
    const wm = (ctx || '').match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s*\d{1,2}\s*(?:st|nd|rd|th)?\s*[a-z]/i) || (ctx || '').match(/\b(sun|mon|tue|wed|thu|fri|sat)[a-z]*\.?,?\s+[a-z]{3,9}\.?\s+\d/i);
    const wd = wm ? WD[wm[1].slice(0, 3).toLowerCase()] : null;
    for (let y = y0; y <= y0 + 6; y++) {
      const dt = new Date(y, mo - 1, d);
      if (dt < soon) continue;
      if (wd == null || dt.getDay() === wd) return y;
    }
    return new Date(y0, mo - 1, d) < soon ? y0 + 1 : y0;
  }
  // "30 November 2026", "November 30, 2026", "Mon, Nov 30", "30 Nov", "30/11/2026", "2026-11-30"
  function parseDate(s, fallbackYear) {
    if (!s) return '';
    let m;
    if ((m = s.match(/(\d{4})-(\d{2})-(\d{2})/))) return iso(+m[1], +m[2], +m[3]);
    if ((m = s.match(new RegExp(`(\\d{1,2})(?:st|nd|rd|th)?\\s*${MON}\\.?,?\\s*(\\d{4})?`, 'i'))))
      { const mo = MONTHS[m[2].slice(0, 3).toLowerCase()]; return iso(+(m[3] || fallbackYear || guessYear(mo, +m[1], s)), mo, +m[1]); }
    if ((m = s.match(new RegExp(`${MON}\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?`, 'i'))))
      { const mo = MONTHS[m[1].slice(0, 3).toLowerCase()]; return iso(+(m[3] || fallbackYear || guessYear(mo, +m[2], s)), mo, +m[2]); }
    if ((m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/))) return iso(+m[3], +m[2], +m[1]);
    return '';
  }
  const DATE_RE = new RegExp(`(\\d{4}-\\d{2}-\\d{2}|\\d{1,2}(?:st|nd|rd|th)?\\s*${MON}\\.?,?(?:\\s*\\d{4})?|${MON}\\.?\\s+\\d{1,2}(?:st|nd|rd|th)?\\s*,?(?:\\s*\\d{4})?|\\d{1,2}/\\d{1,2}/\\d{4})`, 'i');
  // The year written on the page (0 if none, so each date gets a guessed year). Old years, such as a car's model year, don't count
  const yearIn = t => { const y = [...t.matchAll(/\b(20\d{2})\b/g)].map(m => +m[1]).find(y => y >= new Date().getFullYear() - 1); return y || 0; };
  const time24 = s => { const m = (s || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i); if (!m) return ''; let h = +m[1]; if (m[3]) { const pm = /pm/i.test(m[3]); if (h === 12) h = pm ? 12 : 0; else if (pm) h += 12; } return `${pad(h)}:${m[2]}`; };

  const AIRLINES = ['AirAsia X', 'AirAsia', 'Malaysia Airlines', 'Batik Air', 'Firefly', 'MYAirline', 'Singapore Airlines', 'Scoot', 'Jetstar', 'VietJet Air', 'Vietjet', 'Vietnam Airlines', 'Bamboo Airways', 'Thai AirAsia', 'Thai Airways', 'Garuda Indonesia', 'Lion Air', 'Cebu Pacific', 'Philippine Airlines', 'Cathay Pacific', 'Emirates', 'Qatar Airways', 'Etihad', 'Turkish Airlines', 'Japan Airlines', 'ANA', 'Korean Air', 'EVA Air', 'China Airlines', 'Qantas', 'British Airways', 'KLM', 'Lufthansa'];
  const NOT_AIRPORT = new Set(['GMT', 'UTC', 'THE', 'AND', 'FOR', 'PDF', 'USD', 'MYR', 'VND', 'SGD', 'THB', 'IDR', 'EUR', 'GBP', 'AUD', 'JPY', 'KRW', 'PNR', 'ETA', 'ETD', 'VAT', 'GST', 'SST', 'ID', 'NON']);

  // Airport names as written on tickets -> [code, city]
  const AIRPORT_NAMES = [
    [/kuala\s*lumpur|klia/i, 'KUL', 'Kuala Lumpur'], [/doha|hamad/i, 'DOH', 'Doha'], [/charles\s*de\s*gaulle/i, 'CDG', 'Paris'], [/orly/i, 'ORY', 'Paris'],
    [/dubai/i, 'DXB', 'Dubai'], [/abu\s*dhabi/i, 'AUH', 'Abu Dhabi'], [/changi|singapore/i, 'SIN', 'Singapore'], [/suvarnabhumi/i, 'BKK', 'Bangkok'],
    [/don\s*mueang/i, 'DMK', 'Bangkok'], [/heathrow/i, 'LHR', 'London'], [/gatwick/i, 'LGW', 'London'], [/narita/i, 'NRT', 'Tokyo'], [/haneda/i, 'HND', 'Tokyo'],
    [/kansai/i, 'KIX', 'Osaka'], [/incheon/i, 'ICN', 'Seoul'], [/hong\s*kong/i, 'HKG', 'Hong Kong'], [/tan\s*son\s*nhat|ho\s*chi\s*minh/i, 'SGN', 'Ho Chi Minh City'],
    [/noi\s*bai|hanoi/i, 'HAN', 'Hanoi'], [/da\s*nang/i, 'DAD', 'Da Nang'], [/phu\s*quoc/i, 'PQC', 'Phu Quoc'], [/penang/i, 'PEN', 'Penang'], [/langkawi/i, 'LGK', 'Langkawi'],
    [/kota\s*kinabalu/i, 'BKI', 'Kota Kinabalu'], [/kuching/i, 'KCH', 'Kuching'], [/istanbul/i, 'IST', 'Istanbul'], [/soekarno|jakarta/i, 'CGK', 'Jakarta'],
    [/ngurah\s*rai|denpasar|\bbali\b/i, 'DPS', 'Bali'], [/taoyuan|taipei/i, 'TPE', 'Taipei'], [/ninoy|manila/i, 'MNL', 'Manila'], [/sydney/i, 'SYD', 'Sydney'],
    [/melbourne/i, 'MEL', 'Melbourne'], [/frankfurt/i, 'FRA', 'Frankfurt'], [/schiphol|amsterdam/i, 'AMS', 'Amsterdam'], [/zurich/i, 'ZRH', 'Zurich'],
    [/fiumicino|\brome\b/i, 'FCO', 'Rome'], [/madrid/i, 'MAD', 'Madrid'], [/barcelona/i, 'BCN', 'Barcelona'], [/munich/i, 'MUC', 'Munich'], [/jeddah/i, 'JED', 'Jeddah'], [/muscat/i, 'MCT', 'Muscat'],
  ];
  const airportFromName = s => { const a = AIRPORT_NAMES.find(([re]) => re.test(s || '')); return a ? { code: a[1], city: a[2] } : null; };
  const titleCase = s => clean(s).toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

  // Table-style e-tickets: "FROM-NAME   TO-NAME   QR39   08:10   13:15" with names
  // and dates continuing on the next line ("INTERNATIONAL   GAULLE   28Jan2027 28Jan2027")
  function parseTableFlights(text) {
    const year = yearIn(text), ref = bookingRef(text);
    const lines = text.split('\n');
    const rowRe = /^(.*?)\b([A-Z]{2}|[A-Z]\d|\d[A-Z])\s?(\d{1,4})\s+(\d{1,2}:\d{2})\s+(\d{1,2}:\d{2})/;
    const rows = lines.map((l, i) => [l.match(rowRe), i]).filter(([m]) => m && !/^\d+$/.test(m[2]));
    return rows.map(([m, i], k) => {
      const next = (lines[i + 1] || '').replace(/^[_\s]+/, '');
      const dates = [...next.matchAll(new RegExp(DATE_RE.source, 'gi'))].map(d => parseDate(d[1], year)).filter(Boolean);
      const cont = next.replace(new RegExp(DATE_RE.source, 'gi'), '').split(/\s{3,}/).map(clean).filter(Boolean);
      const head = m[1].split(/\s{3,}/).map(clean).filter(Boolean);
      const fromName = [head[0], cont[0]].filter(Boolean).join(' '), toName = [head[1], cont[1]].filter(Boolean).join(' ');
      const sec = lines.slice(i, rows[k + 1]?.[1] ?? Math.min(lines.length, i + 12)).join('\n');
      const A = airportFromName(fromName), B = airportFromName(toName);
      const dur = sec.match(/duration\s*:?\s*(\d{1,2}):(\d{2})/i);
      const bag = sec.match(/baggage[^:\n]*:\s*(\d+)\s*k(?:gs?)?\b/i);
      const operated = clean((sec.match(/operated\s*by\s*:?\s*([A-Za-z .'-]+?)(?:\s{3,}|$)/im) || [])[1]);
      const marketed = clean((sec.match(/marketed\s*by\s*:?\s*([A-Za-z .'-]+?)(?:\s{3,}|$)/im) || [])[1]);
      const terminal = (sec.match(/terminal\s*:?\s*\w+/i) || [])[0] || '';
      return {
        airline: titleCase(marketed || operated || ''),
        flightNo: `${m[2]} ${m[3]}`, ref,
        from: A?.code || '', to: B?.code || '',
        fromCity: A?.city || titleCase(fromName), toCity: B?.city || titleCase(toName),
        depDate: dates[0] || '', depTime: time24(m[4]),
        arrDate: dates[1] || dates[0] || '', arrTime: time24(m[5]),
        duration: dur ? `${+dur[1]}h${+dur[2] ? ' ' + (+dur[2]) + 'm' : ''}` : '',
        seats: '', baggage: bag ? `${bag[1]}kg checked` : '',
        notes: [terminal.replace(/\s*:\s*/, ' '), operated && marketed && operated.toLowerCase() !== marketed.toLowerCase() ? `Operated by ${titleCase(operated)}` : ''].filter(Boolean).join(' · '),
      };
    }).sort((a, b) => (a.depDate + a.depTime).localeCompare(b.depDate + b.depTime));
  }

  function detectKind(t) {
    const n = re => (t.match(re) || []).length;
    const score = {
      flight: n(/\b(flight|airline|airport|depart|boarding pass|baggage|carry-on|seat \d|terminal|PNR|non-stop)\b/gi),
      stay: n(/\b(hotel|check-?in|check-?out|room type|property|arrival|guest|nights?|resort|agoda|booking\.com|voucher)\b/gi),
      train: 2 * n(/\b(train|rail|railway|ouigo|sncf|tgv|inoui|eurostar|trenitalia|italo|renfe|deutsche bahn|thalys|ktm|ets|grande vitesse|coach \d+|carriage|platform)\b/gi),
      bus: 2 * n(/\b(bus|flixbus|coach operator|bus terminal|easybook|redbus|busonlineticket)\b/gi),
      ferry: 2 * n(/\b(ferry|jetty|pier|vessel|speedboat|catamaran|crossing)\b/gi),
      car: 2 * n(/\b(turo|car rental|rental car|car hire|hertz|avis|europcar|sixt|getaround|pick-?up\s*(?:&|and)\s*return|hosted by|booked trip with|licen[cs]e plate)\b/gi) + n(CAR_MAKES),
    };
    // check-in words also turn up in flight and train confirmations: only a stay if nothing stronger
    const best = Object.entries(score).sort((a, b) => b[1] - a[1])[0];
    if (!best[1]) return 'other';
    if (best[0] === 'stay' && score.flight && score.flight >= score.stay) return 'flight';
    return best[0];
  }
  const CAR_MAKES = /\b(Mercedes-?Benz|BMW|Audi|Toyota|Honda|Perodua|Proton|Volkswagen|VW|Peugeot|Renault|Citro[eë]n|Fiat|Ford|Kia|Hyundai|Nissan|Mazda|Tesla|Volvo|Skoda|Seat|Opel|Mini|Dacia|Mitsubishi|Suzuki|Lexus|Jeep|Chevrolet|Subaru|Porsche|Land Rover|Cupra|MG|BYD)\b/g;

  function bookingRef(t) {
    const re = /\b(?:booking\s*(?:no|number|ref(?:erence)?|code|id)|confirmation\s*(?:no|number|code)?|PNR|record locator|reservation\s*(?:no|number|code)?)\b\.?\s*[:#]?\s*\n?\s*(?:[A-Z0-9]{1,3}\/)?([A-Za-z0-9][A-Za-z0-9-]{4,14})\b/gi;
    for (const m of t.matchAll(re)) if (/^[A-Z0-9-]+$/.test(m[1]) && /\d|^[A-Z]{5,8}$/.test(m[1])) return m[1];
    const pnr = t.match(/booking\s*reference\s*(?:\(PNR\))?[^\n]*\n\s*([A-Z0-9]{5,8})\b/i);
    if (pnr && /^[A-Z0-9]+$/.test(pnr[1])) return pnr[1];
    // "Reference\nUPW4JA", "for reference UPW4JA": capitals and digits only
    for (const m of t.matchAll(/\breference\s*[:#]?\s*\n?\s*([A-Za-z0-9]{5,8})\b/gi)) if (/^[A-Z0-9]+$/.test(m[1]) && /\d/.test(m[1]) && /[A-Z]/.test(m[1])) return m[1];
    return '';
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

    // Sections: "Leg 1 of 4 | Kuala Lumpur (KUL) to Dubai (DXB)" style headings first,
    // otherwise headings holding a full date ("Depart: Monday, 30 November 2026")
    const lines = text.split('\n');
    let heads = [];
    lines.forEach((l, i) => {
      if (/^\s*(leg|segment|sector)\s*\d+/i.test(l) || /^\s*flight\s*\d+\s*of\s*\d+/i.test(l)
        || /^\s*(outbound|inbound|onward|return|departing|returning)\s+flight\b.*\([A-Z]{3}\)/i.test(l)) heads.push(i);
    });
    if (!heads.length) lines.forEach((l, i) => {
      if (/^\s*(depart(?:ure)?|return|outbound|inbound|onward|flight\s*\d)\b/i.test(l) && DATE_RE.test(l) && /\d{4}/.test(l)) heads.push(i);
    });
    // A section ends at the next heading, or where passenger / payment details begin
    const stopAt = (from, to) => { const j = lines.slice(from + 1, to).findIndex(l => /^\s*(passenger\s*details|payment\s*(summary|details)|fare\s*(details|information|calculation)|price\s*details|add-ons)\b/i.test(l)); return j < 0 ? to : from + 1 + j; };
    let sections = heads.map((h, k) => lines.slice(h, stopAt(h, heads[k + 1] ?? lines.length)).join('\n'));

    // Fallback: no headings, so cut around each flight number
    if (!sections.length) {
      const idx = [...text.matchAll(flightNoRe)].filter(m => !/^\d+$/.test(m[1])).map(m => m.index);
      sections = idx.map((at, k) => text.slice(Math.max(0, (idx[k - 1] ?? 0)), idx[k + 1] ?? text.length));
    }

    // Seats and baggage per leg from add-on blocks ("Kuala Lumpur to Phu Quoc ... Seat 27E")
    const addons = text.split(/\n(?=[A-Z][A-Za-z .'-]+ to [A-Z][A-Za-z .'-]+\n)/).slice(1);
    const seatsPerLeg = addons.map(b => [...b.matchAll(/\bSeat\s*(\d{1,2}[A-K])\b/gi)].map(m => m[1]));
    const allSeats = [...text.matchAll(/\bSeat\s*(\d{1,2}[A-K])\b/gi)].map(m => m[1]);
    const kg = s => s ? s.replace(/\s/g, '').replace(/kgs$/i, 'kg') : '';
    const bagAll = (text.match(/checked\s*baggage\s*(\d+\s?kgs?)/i) || text.match(/(\d+\s?kgs?)\s*checked/i) || text.match(/\bbaggage\s*:?\s*(\d+\s?kgs?)\b/i) || [])[1] || '';
    const carry = (text.match(/(\d+\s?kg)\s*carry-?on/i) || [])[1] || '';

    let flights = sections.map((sec, k) => {
      const secLines = sec.split('\n');
      const head = secLines[0];
      const body = secLines.filter(l => !/validity|not (before|after)|booking date|issued|birth|\bDOB\b/i.test(l)).join('\n');
      const fn = [...sec.matchAll(flightNoRe)].find(m => !/^\d+$/.test(m[1]) && !/^GMT/i.test(sec.slice(Math.max(0, m.index - 3), m.index + 3)));
      const airline = (sec.match(airlineRe) || [])[1] || '';
      // "Check-in at" layouts list check-in time first, then departure, then arrival
      const hasCheckin = /check[- ]?in\s*(?:at|time)\b/i.test(sec);
      const times = [...body.matchAll(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)/gi)].map(m => time24(m[1]));
      const off = hasCheckin && times.length >= 3 ? 1 : 0;
      const dates = [...body.matchAll(new RegExp(DATE_RE.source, 'gi'))].map(m => parseDate(m[1], year)).filter(Boolean);
      const headDate = /\d{4}/.test(head) ? parseDate(head, year) : '';
      const depDate = headDate || dates[hasCheckin && dates.length >= 2 ? 1 : 0] || '';
      // Route from the heading: "City (KUL) to City (DXB)"
      const hr = head.match(/([A-Za-z .'-]+?)\s*\(([A-Z]{3})\)\s*(?:to|→|->|>|-|–)\s*([A-Za-z .'-]+?)\s*\(([A-Z]{3})\)/);
      const pair = hr ? [hr[2], hr[4]] : (pairs[k] || []);
      const cityLines = secLines.filter(l => /^\s*\d{1,2}:\d{2}/.test(l)).map(l => clean(l.replace(/^\s*(\d{1,2}:\d{2}\s*(am|pm)?\s*)+/i, '')));
      const terminal = (sec.match(/terminal\s*\w+/i) || [])[0] || '';
      const seats = seatsPerLeg[k]?.length ? seatsPerLeg[k] : (allSeats.length && sections.length ? allSeats.slice(k * allSeats.length / sections.length, (k + 1) * allSeats.length / sections.length) : []);
      const bag = (sec.match(/\bbaggage\s*:?\s*(\d+\s?kgs?)\b/i) || [])[1] || bagAll;
      const dur = sec.match(/\b(\d{1,2})\s*h(?:rs?)?\s*(\d{1,2})\s*m(?:in)?s?\b/i);
      return {
        airline,
        flightNo: fn ? `${fn[1]} ${fn[2]}` : '',
        ref,
        from: pair[0] || '', to: pair[1] || '',
        fromCity: hr ? clean(hr[1].replace(/^.*\|/, '').replace(/^\s*(outbound|inbound|onward|return|departing|returning)\s+flight\s*/i, '')) : (cityLines[0] || ''),
        toCity: hr ? clean(hr[3]) : (cityLines[1] || ''),
        depDate,
        depTime: times[off] || '',
        arrDate: dates.length > 1 ? dates.at(-1) : depDate,
        arrTime: times[off + 1] || '',
        duration: dur ? `${+dur[1]}h${+dur[2] ? ' ' + (+dur[2]) + 'm' : ''}` : '',
        seats: seats.join(', '),
        baggage: [bag && `${kg(bag)} checked`, carry && `${kg(carry)} carry-on`].filter(Boolean).join(' + '),
        notes: terminal,
      };
    }).filter(f => f.flightNo || f.depTime);
    // one entry per flight, in date order
    flights = flights.filter((f, i, a) => a.findIndex(g => g.flightNo === f.flightNo && g.depDate === f.depDate) === i)
      .sort((a, b) => (a.depDate + a.depTime).localeCompare(b.depDate + b.depTime));
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
  // A street address line: "24 rue Cels, 75014 Paris, France" / "D2-38-40, Diamond 2 Street, ..."
  const ADDRESS_LINE = /^\s*[A-Z]?\d[\w\/-]*,?\s+[^\n]*,\s*[^\n]*\b\d{4,6}\b/i;
  const NOT_NAME = /website|booking|email|e-mail|policy|back to|confirm|cancel|modify|payment|privacy|information|contact us|discount|total|price|guest|\bhttps?:/i;
  function parseStay(text, cols) {
    const src = cols || text, year = yearIn(text);
    const lines = text.split('\n').map(l => l.trim());
    // name: labelled ("Property :"), else the line just above the street address
    let block = after(src, /^\s*(property|hotel(?: name)?|accommodation)\s*(?::|\s{3,}(?=\S))/i, /^(address|check|arrival|phone|tel|contact|property contact)/i, 4);
    block = block.split('\n').map(l => l.replace(/^(hotel|property)\s*(?::\s*|\s{3,})/i, '')).join(' ');
    const br = block.match(/\(([^()]*[A-Za-z][^()]*)\)/);
    let name = clean(br ? br[1] : block.split(/\s{3,}|\n/)[0]);
    const addrIdx = lines.findIndex(l => ADDRESS_LINE.test(l.replace(/^[^\w]+/, '')) && !/^\s*address\s*:/i.test(l));
    // a hotel-like name in the first few lines ("Hôtel Mistral" at the top of a card)
    if (!name) { const top = lines.slice(0, 4).map(l => clean(l.split(/\s{3,}/)[0].replace(/[^\p{L}\d)]+$/u, ''))).find(l => /\b(h[oô]tel|resort|inn|hostel|villa|suites?|boutique|lodge|guesthouse)\b/i.test(l) && !NOT_NAME.test(l) && l.length < 60); if (top) name = top; }
    if (!name && addrIdx > 0) {
      for (let j = addrIdx - 1; j >= Math.max(0, addrIdx - 3); j--) { const l = clean(lines[j].replace(/^[^\p{L}\d]+/u, '')); if (l && !NOT_NAME.test(l) && l.length < 60) { name = l; break; } }
    }
    if (!name) name = clean((lines.find(l => /\b(h[oô]tel|resort|inn|hostel|villa|suites?|boutique|lodge|guesthouse)\b/i.test(l) && !NOT_NAME.test(l)) || ''));

    let address = clean(after(src, /^\s*address\s*:/i, /^(property|hotel|phone|tel|contact|check|arrival|number of|room|booking)\b/i, 5).replace(/\n/g, ' '));
    const pc = address.match(/^(.*?\b\d{5,6}\b)/); if (pc) address = pc[1];       // stop after the postcode
    if (!address && addrIdx >= 0) address = clean(lines[addrIdx].replace(/^[^\w]+/, ''));
    let phone = clean((src.match(/(?:contact\s*number|phone|tel(?:ephone)?)\s*:?\s*(\+?\d[\d\s()-]{6,}\d)/i) || [])[1]);
    if (!phone && addrIdx >= 0) phone = clean((lines.slice(addrIdx + 1, addrIdx + 4).find(l => /^[^\w+]*\+?\d[\d\s().-]{7,}\d$/.test(l)) || '').replace(/^[^\d+]+/, ''));
    phone = fixPlus(phone);
    const ref = (text.match(/\b(?:booking\s*id|confirmation\s*(?:no|number|code)|reservation\s*(?:no|number|code)|booking\s*(?:no|number|reference))\.?\s*[:#]?\s*((?=[A-Z-]*\d)[A-Z0-9-]{5,})/i) || [])[1]
      || (text.match(/\b(?:booking|reservation|confirmation)\s*#\s*([A-Z0-9]{5,12})\b/i) || [])[1] || bookingRef(text);
    const grab = re => { const m = text.match(re); return m ? parseDate(m[1], year) : ''; };
    let inDate = grab(new RegExp(`(?:arrival|check[- ]?in)(?:\\s*date)?\\s*:?\\s*(?:[A-Za-z]{3,9},?\\s*)?${DATE_RE.source}`, 'i'));
    let outDate = grab(new RegExp(`(?:departure|check[- ]?out)(?:\\s*date)?\\s*:?\\s*(?:[A-Za-z]{3,9},?\\s*)?${DATE_RE.source}`, 'i'));
    let inTime = time24((text.match(/check[- ]?in[^\n]{0,30}?(\d{1,2}:\d{2}\s*(?:am|pm)?)/i) || [])[1]);
    let outTime = time24((text.match(/check[- ]?out[^\n]{0,30}?(\d{1,2}:\d{2}\s*(?:am|pm)?)/i) || [])[1]);
    // "Jan 28, 2027 (from 14:00) → Jan 30, 2027 (to 12:00)"
    const range = text.match(new RegExp(`${DATE_RE.source}\\s*(?:\\((?:from|after)\\s*(\\d{1,2}:\\d{2})\\))?\\s*(?:→|->|–|—|until)\\s*(?:[A-Za-z]{3,9},?\\s+)?${DATE_RE.source}\\s*(?:\\((?:to|until|before|by)\\s*(\\d{1,2}:\\d{2})\\))?`, 'i'));
    if (range) {
      const g = range.slice(1).filter(v => v !== undefined);
      const ds = [...range[0].matchAll(new RegExp(DATE_RE.source, 'gi'))].map(m => parseDate(m[1], year));
      inDate ||= ds[0] || ''; outDate ||= ds[1] || '';
      const ft = range[0].match(/\((?:from|after)\s*(\d{1,2}:\d{2})\)/i), tt = range[0].match(/\((?:to|until|before|by)\s*(\d{1,2}:\d{2})\)/i);
      inTime ||= ft ? time24(ft[1]) : ''; outTime ||= tt ? time24(tt[1]) : '';
    }
    let room = after(src, /^\s*room\b[^:\n]{0,14}\btype\b[^:\n]{0,6}:/i, LABEL, 2).split('\n');
    room = clean(room.length > 1 && room[1].length < 25 ? room.join(' ') : room[0]);
    room = clean(room.replace(/(^|\s)(?![aA&])[A-Za-z](?=\s|$)/g, ' ').replace(/\b[B-DF-HJ-NP-TV-Z]{2,4}\b/g, ''));   // stray letters from text recognition
    if (!room) {
      const ri = lines.findIndex(l => /^rooms?$/i.test(l));
      const cand = lines.slice(ri >= 0 ? ri : 0).find(l => /\b(room|suite|studio|apartment|villa|bungalow|chalet|dorm|cabin)\b/i.test(l) && !/^rooms?$/i.test(l) && !NOT_NAME.test(l) && !/number of/i.test(l));
      room = clean((cand || '').replace(/\s{3,}.*$/, '').replace(/[€$£¥]\s*[\d.,]+.*$/, ''));
    }
    const included = clean((text.match(/benefits\s*included\s*:?\s*(.+)/i) || [])[1]);
    const perks = clean((lines.find(l => /breakfast|internet|wi-?fi/i.test(l) && /included|not included/i.test(l) && l.length < 90) || '').replace(/\s*[•|]\s*/g, ' · '));
    const bal = text.match(/(?:remaining\s*balance|balance\s*due|(?:to\s*)?pay\s*at\s*(?:the\s*)?(?:hotel|property))\s*:?\s*([€$£¥]|[A-Z]{3})?\s*([\d.,]+)\s*([€$£¥]|[A-Z]{3})?/i);
    const balance = bal && +bal[2].replace(/,/g, '') > 0 ? `${(bal[1] || bal[3] || '').trim()}${bal[2]} left to pay at the hotel` : '';
    const notes = [included ? `Included: ${included}` : perks, balance].filter(Boolean).join(' · ');
    return { name, address, phone, ref, inDate, inTime, outDate, outTime, room, notes };
  }


  /* ---------- trains, buses and ferries ---------- */
  const OPERATORS = ['OUIGO', 'TGV INOUI', 'SNCF', 'Eurostar', 'Thalys', 'Trenitalia', 'Italo', 'Renfe', 'Deutsche Bahn', 'ÖBB', 'SBB', 'TER', 'Intercités', 'KTM', 'ETS', 'FlixBus', 'BlaBlaCar Bus', 'Aeroline', 'Transnasional', 'Plusliner', 'Konsortium', 'Langkawi Ferry Line', 'Bluewater Express', 'Superdong', 'Phu Quoc Express', 'Batam Fast'];
  const MODE_WORD = { train: 'train', bus: 'bus', ferry: 'ferry' };
  const dur = s => { const m = (s || '').match(/\b(\d{1,2})\s*h(?:rs?|ours?)?\s*(\d{1,2})?\s*(?:m(?:in(?:ute)?s?)?)?\b/i); return m ? `${+m[1]}h${+m[2] ? ' ' + (+m[2]) + 'm' : ''}` : ''; };
  const stripTail = s => clean((s || '').split(/\s{3,}/)[0].replace(/[(\[{]\s*x?\d*\s*$/i, ''));
  function parseGround(text, mode) {
    const year = yearIn(text), lines = text.split('\n'), ref = bookingRef(text);
    const opRe = new RegExp(`\\b(${OPERATORS.map(o => o.replace(/ /g, '\\s')).join('|')})\\b`, 'i');
    const op = (text.match(opRe) || [])[1] || (/grande\s+vitesse/i.test(text) ? 'OUIGO' : '');
    const operator = op ? OPERATORS.find(o => o.toLowerCase() === op.toLowerCase().replace(/\s+/g, ' ')) || op : '';
    const pax = (text.match(/\b(\d{1,2})\s*(?:passengers?|adults?|travell?ers?|pax)\b/i) || text.match(/\(?\bx\s?(\d{1,2})\b/) || [])[1] || '';
    const number = (text.match(new RegExp(`\\b(?:${mode}|service)\\s*(?:no\\.?|number)?\\s*:?\\s*([A-Z]{0,3}\\s?\\d{2,5})\\b`, 'i')) || [])[1] || '';
    const legs = [];
    // App layout: "12:39 PM Paris Montparnasse" then "2:46 PM Bordeaux Saint-Jean", under a date heading
    const tl = /^\s*(\d{1,2}[:.]\d{2}\s*(?:am|pm)?)\s+([A-ZÀ-Ý][^\n]*?)\s*$/i;
    for (let i = 0; i < lines.length - 1; i++) {
      const a = lines[i].match(tl), b = lines[i + 1].match(tl);
      if (!a || !b) continue;
      let head = '';
      for (let j = i - 1; j >= Math.max(0, i - 4); j--) if (DATE_RE.test(lines[j])) { head = lines[j]; break; }
      const dm = head.match(DATE_RE), depDate = dm ? parseDate(head.slice(Math.max(0, dm.index - 12)), year) : '';
      const sec = lines.slice(i, i + 4).join('\n');
      const depTime = time24(a[1].replace('.', ':')), arrTime = time24(b[1].replace('.', ':'));
      const nextDay = arrTime && depTime && arrTime < depTime && depDate;
      const arrDate = nextDay ? new Date(new Date(depDate + 'T12:00:00').getTime() + 864e5).toISOString().slice(0, 10) : depDate;
      legs.push({ operator, number, ref, from: stripTail(a[2]), to: stripTail(b[2]), depDate, depTime, arrDate, arrTime,
        duration: dur(sec), passengers: pax, seats: '', notes: /\bdirect\b/i.test(sec) ? 'Direct' : '' });
      i++;
    }
    // Email layout: "Outbound: Saturday, 30 January 2027 at 12:39" with the route given once
    if (!legs.length) {
      let A = '', B = '';
      const yj = text.match(/^\s*your\s+([^\n]+?)\s*\n(?:[^\n]*\n){0,2}?\s*journey\s+([^\n]+)/im);
      if (yj) { A = stripTail(yj[1]); B = stripTail(yj[2]); }
      if (!A) { const r = text.match(/\b(?:from\s+)?([A-Z][\w .'-]{2,40}?)\s*(?:→|->|–|>|\bto\b)\s*([A-Z][\w .'-]{2,40})/); if (r) { A = clean(r[1]); B = clean(r[2]); } }
      lines.forEach(l => {
        const m = l.match(/^\s*(outbound|outward|departure|depart|return|inbound)\s*(?:journey|trip)?\s*:?\s*(.+)$/i);
        if (!m || !DATE_RE.test(m[2])) return;
        const back = /return|inbound/i.test(m[1]);
        const t = m[2].match(/\b(\d{1,2}[:.h]\d{2}\s*(?:am|pm)?)/i);
        legs.push({ operator, number, ref, from: back ? B : A, to: back ? A : B, depDate: parseDate(m[2], year), depTime: t ? time24(t[1].replace(/[.h]/, ':')) : '',
          arrDate: '', arrTime: '', duration: '', passengers: pax, seats: '', notes: '' });
      });
    }
    return legs.filter((l, i, a) => a.findIndex(g => g.depDate === l.depDate && g.depTime === l.depTime) === i)
      .sort((a, b) => (a.depDate + a.depTime).localeCompare(b.depDate + b.depTime));
  }

  /* ---------- car rental ---------- */
  function parseCar(text) {
    const year = yearIn(text), lines = text.split('\n').map(l => l.trim());
    const HEAD = /^[A-Z][A-Z &'’-]{3,}$/;              // "LOCATION", "EXTRAS"
    const under = (re, list, sep = ' ') => { const i = lines.findIndex(l => re.test(l)); if (i < 0) return ''; const out = []; for (let j = i + 1; j < lines.length && out.length < 4; j++) { if (!lines[j] || HEAD.test(lines[j]) || (list && out.length && /\.\s*$|\btrip\b/i.test(lines[j]))) break; out.push(lines[j]); } return out.map(l => l.split(/\s{3,}/).filter(x => /[A-Za-z0-9]{2}/.test(x)).join(' ')).join(typeof list === 'string' ? list : sep); };
    const host = clean((text.match(/(?:trip|booked|hosted)\s+(?:with|by)\s+([^\n]+?)(?:\s{3,}|$)/im) || [])[1]);
    const brand = /booked trip with/i.test(text) && /hosted by/i.test(text) ? 'Turo' : (text.match(/\b(Turo|Hertz|Avis|Europcar|Sixt|Getaround|Enterprise|Budget|Thrifty|Hertz|Socar|Trevo|GoCar)\b/i) || [])[1] || '';
    const mi = lines.findIndex(l => CAR_MAKES.test(l)); CAR_MAKES.lastIndex = 0;
    let car = '', plate = '';
    if (mi >= 0) {
      const make = (lines[mi].match(CAR_MAKES) || [''])[0]; CAR_MAKES.lastIndex = 0;
      const rest = lines.slice(mi, mi + 3).join('   ').replace(make, '').split(/\s{3,}|\n/).map(clean).filter(Boolean);
      const ok = x => /^[A-Z0-9][\w-]*(?:\s+[\w-]+){0,3}$/.test(x) && !/^[A-Z]{2}[O0-9]{3}[A-Z]{2}$/.test(x);
      const model = rest.find(x => ok(x) && /\b(19|20)\d{2}\b/.test(x)) || rest.find(x => ok(x) && x.length >= 3 && /\d/.test(x)) || '';
      const pm = lines.slice(mi, mi + 3).join(' ').match(/\b([A-Z]{2}[-\s]?[O0-9]{3}[-\s]?[A-Z]{2}|[A-Z]{1,3}\s?\d{1,4}\s?[A-Z]{0,3})\b(?=\s*$|\s{3})/m);
      car = clean(`${make} ${model.replace(/\s+[A-Z]{2}[O0-9]{3}[A-Z]{2}$/, '')}`);
      const pf = lines.slice(mi, mi + 3).join(' ').match(/\b([A-Z]{2})[-\s]?([O0-9]{3})[-\s]?([A-Z]{2})\b/);
      plate = pf ? pf[1] + pf[2].replace(/O/g, '0') + pf[3] : (pm ? pm[1] : '');
    }
    // "Mon 1Feb - Thu 4Feb" then "12:00 pm   6:00 pm"
    let pickDate = '', retDate = '', pickTime = '', retTime = '';
    const ri = lines.findIndex(l => (l.match(new RegExp(DATE_RE.source, 'gi')) || []).length >= 2);
    if (ri >= 0) {
      const ds = [...lines[ri].matchAll(new RegExp(DATE_RE.source, 'gi'))];
      pickDate = parseDate(lines[ri].slice(Math.max(0, ds[0].index - 5), ds[0].index + ds[0][0].length), year);
      retDate = parseDate(lines[ri].slice(Math.max(0, ds[1].index - 5), ds[1].index + ds[1][0].length), year);
      const ts = [...lines.slice(ri, ri + 3).join(' ').matchAll(/\b(\d{1,2}:\d{2}\s*(?:am|pm)?)/gi)].map(m => time24(m[1]));
      pickTime = ts[0] || ''; retTime = ts[1] || '';
    } else {
      pickDate = parseDate((text.match(new RegExp(`pick-?\\s?up[^\\n]{0,20}?${DATE_RE.source}`, 'i')) || [])[1], year);
      retDate = parseDate((text.match(new RegExp(`(?:return|drop-?\\s?off)[^\\n]{0,20}?${DATE_RE.source}`, 'i')) || [])[1], year);
    }
    const pickup = clean(under(/^(location|pick-?up location|pick-?up address)\b/i) || (text.match(/pick-?up\s*(?:location|address)\s*:?\s*([^\n]+)/i) || [])[1]);
    const instr = under(/instructions/i), extras = under(/^extras\b/i, ', ');
    const company = [brand, host].filter(Boolean).join(' · ');
    return { company, car, plate, ref: bookingRef(text), pickup, pickDate, pickTime, retDate, retTime, dropoff: '', phone: '',
      notes: [extras && `Extras: ${extras}`, instr].filter(Boolean).join(' · ') };
  }

  /* ---------- screenshots: rebuild lines and columns from recognised words ---------- */
  // words: [{t: text, c: confidence, b: [x0, y0, x1, y1]}]
  function wordsToText(words) {
    const ws = words.filter(w => w.t && w.t.trim() && !(w.c < 45 && !/[A-Za-z0-9]{2}/.test(w.t)));
    if (!ws.length) return { text: '', cols: '' };
    const cy = w => (w.b[1] + w.b[3]) / 2, ht = w => w.b[3] - w.b[1];
    // start from the recogniser's own lines (w.l), then put lines sitting side by side on one row
    const groups = {};
    ws.forEach((w, i) => (groups[w.l ?? 'w' + i] ||= []).push(w));
    const lines = [];
    Object.values(groups).map(g => {
      const y0 = Math.min(...g.map(w => w.b[1])), y1 = Math.max(...g.map(w => w.b[3]));
      return { cy: (y0 + y1) / 2, h: y1 - y0, ws: g };
    }).sort((a, b) => a.cy - b.cy).forEach(g => {
      const l = lines.find(l => Math.abs(l.cy - g.cy) < Math.min(g.h, l.h) * 0.5);
      if (l) { l.ws.push(...g.ws); l.h = Math.max(l.h, g.h); } else lines.push(g);
    });
    const H = [...lines.map(l => l.h)].sort((a, b) => a - b)[lines.length >> 1] || 20;
    const minX = Math.min(...ws.map(w => w.b[0])), maxX = Math.max(...ws.map(w => w.b[2])), maxY = Math.max(...ws.map(w => w.b[3]));
    const mid = (minX + maxX) / 2;
    // each line splits into segments wherever there is a wide gap (a second column)
    const rows = lines.sort((a, b) => a.cy - b.cy).map(l => {
      const segs = [];
      l.ws.sort((a, b) => a.b[0] - b.b[0]).forEach(w => {
        const s = segs.at(-1);
        if (s && w.b[0] - s.x1 < H * 1.6) { s.t += ' ' + w.t; s.x1 = w.b[2]; } else segs.push({ t: w.t, x0: w.b[0], x1: w.b[2] });
      });
      return { cy: l.cy, segs };
    }).filter((r, i) => !(i === 0 && r.cy < maxY * 0.06 && /^\d{1,2}:\d{2}\b/.test(r.segs[0].t)));  // phone status bar clock
    const text = rows.map(r => r.segs.map(s => s.t).join('   ')).join('\n');
    const left = rows.map(r => r.segs.filter(s => s.x0 < mid).map(s => s.t).join('   ')).filter(Boolean);
    const right = rows.map(r => r.segs.filter(s => s.x0 >= mid).map(s => s.t).join('   ')).filter(Boolean);
    return { text: text + '\n', cols: left.join('\n') + '\n\n' + right.join('\n') + '\n' };
  }
  // Text recognition often reads "+" as 4 or 1 in front of a country code
  const COUNTRY = /^(84|60|65|66|62|63|33|44|61|81|82|86|91|852|971|974)/;
  function fixPlus(p) {
    const d = (p || '').replace(/[^\d+]/g, '');
    if (!p || d.startsWith('+')) return p || '';
    if (/^[41]/.test(d) && d.length >= 11 && d.length <= 14 && COUNTRY.test(d.slice(1))) return '+' + p.replace(/^\s*[41]\s*/, '');
    return p;
  }

  // Everything found, as a list of bookings: [{kind, data}]
  function parseBooking({ text, cols }) {
    const r = parseOne({ text, cols });
    r.items = r.kind === 'flight' ? r.flights.map(d => ({ kind: 'flight', data: d }))
      : r.kind === 'stay' ? [{ kind: 'stay', data: r.stay }]
      : r.kind === 'car' ? [{ kind: 'car', data: r.car }]
      : MODE_WORD[r.kind] ? r.legs.map(d => ({ kind: r.kind, data: d }))
      : [];
    return r;
  }
  // Two labels side by side with their values on the line below become "Label: value" lines
  const LABELISH = /\b(number|phone|address|reference|ref|code|date|time|name|confirmation|booking|check|pin|guests?|room)\b/i;
  function pairLabels(t) {
    const L = t.split('\n');
    for (let i = 0; i < L.length - 1; i++) {
      const a = L[i].split(/\s{3,}/).map(x => x.trim().replace(/^(?:[^\p{L}\s]{1,3}|\d{1,2})\s+(?=\p{L})/u, '')), b = L[i + 1].split(/\s{3,}/).map(x => x.trim());
      if (a.length >= 2 && a.length === b.length && a.every(x => LABELISH.test(x) && !/\d/.test(x) && x.length <= 30) && b.every(x => x && !LABELISH.test(x))) {
        L.splice(i, 2, ...a.map((x, k) => `${x}: ${b[k]}`)); i += a.length - 1;
      }
    }
    return L.join('\n');
  }
  function parseOne({ text, cols }) {
    text = pairLabels(text); if (cols) cols = pairLabels(cols);
    const kind = detectKind(text);
    if (kind === 'car') return { kind, car: parseCar(text) };
    if (MODE_WORD[kind]) return { kind, legs: parseGround(text, kind) };
    if (kind === 'flight') {
      const hasLegs = /^\s*(leg|segment|sector)\s*\d+/im.test(text);
      const table = hasLegs ? [] : parseTableFlights(text);
      return { kind, flights: table.length ? table : parseFlights(text) };
    }
    if (kind === 'stay') return { kind, stay: parseStay(text, cols) };
    return { kind: 'other', other: { ref: bookingRef(text), date: parseDate((text.match(DATE_RE) || [])[0], yearIn(text)) } };
  }

  const api = { parseBooking, parseDate, detectKind, wordsToText, fixPlus };
  if (typeof module !== 'undefined') module.exports = api; else root.XKKParse = api;
})(typeof window !== 'undefined' ? window : globalThis);
