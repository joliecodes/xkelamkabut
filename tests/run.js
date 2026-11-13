// Re-checks the PDF reader against saved (cleaned-up) ticket and hotel texts.
// Run with: node tests/run.js
const fs = require('fs'), path = require('path');
// Screenshots often show no year, so the reader guesses one from today's date: pin "today" for the tests
const RealDate = Date, TODAY = RealDate.UTC(2026, 10, 14);
global.Date = class extends RealDate { constructor(...a) { super(...(a.length ? a : [TODAY])); } static now() { return TODAY; } };
const { parseBooking } = require('../parse.js');
const dir = path.join(__dirname, 'fixtures');
let fail = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const r = parseBooking({ text: fx.text, cols: fx.cols });
  delete r.items;                                   // same bookings, listed again for the app
  const got = JSON.stringify(r), want = JSON.stringify(fx.expected);
  const ok = got === want;
  if (!ok) { fail++; console.log('  want', want, '\n  got ', got); }
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}`);
}
process.exit(fail ? 1 : 0);
