// Re-checks the PDF reader against saved (cleaned-up) ticket and hotel texts.
// Run with: node tests/run.js
const fs = require('fs'), path = require('path');
const { parseBooking } = require('../parse.js');
const dir = path.join(__dirname, 'fixtures');
let fail = 0;
for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json'))) {
  const fx = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
  const got = JSON.stringify(parseBooking({ text: fx.text, cols: fx.cols }));
  const ok = got === JSON.stringify(fx.expected);
  if (!ok) fail++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${f}`);
}
process.exit(fail ? 1 : 0);
