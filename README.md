# xkelamkabut

Rough travel itineraries, *tak kelam-kabut*.

A no-build PWA hosted on GitHub Pages. Trips are saved in the browser (localStorage) on each device.

## Files
- `index.html`: app shell
- `styles.css`: styles
- `app.js`: trips, itinerary, bookings, packing
- `parse.js`: reads booking details from PDF text (pattern matching)
- `libs/`: pdf.js 3.11 (Apache 2.0), loaded only when a PDF is uploaded
- Text recognition: tesseract.js 5 (Apache 2.0) from jsDelivr, loaded only for screenshots, photos and image-only PDFs
- `sw.js`: service worker (network-first while building)
- `manifest.json` + `icons/`: install to home screen

## Roadmap
1. ✅ Itinerary: add days, hour grid, tap an hour to add Activity / Meal / Rest / Transport / Other with Maps link + notes
2. ✅ Trips home (multiple trips) and Packing lists
3. ✅ Bookings: flight, stay and other cards; PDF upload read on-device (pdf.js) with a review form; optional sync to the itinerary
4. Export/import, full offline caching

## PDF reader tests
`tests/fixtures/` holds the text of real booking PDFs (AirAsia, Agoda, Emirates, Qatar Airways, a direct hotel booking, and a Batik Air screenshot read by text recognition) with personal details replaced by fakes. Run `node tests/run.js` to check the reader still gets every field right; GitHub runs it on every push. Never commit the original PDFs.
