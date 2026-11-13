# xkelamkabut

Rough travel itineraries, *tak kelam-kabut*.

A no-build PWA hosted on GitHub Pages. Trips are saved in the browser (localStorage) on each device.

## Files
- `index.html`: app shell
- `styles.css`: styles
- `app.js`: itinerary logic (days, hour grid, add/edit drawer)
- `sw.js`: service worker (network-first while building)
- `manifest.json` + `icons/`: install to home screen

## Roadmap
1. ✅ Itinerary: add days, hour grid, tap an hour to add Activity / Meal / Rest / Transport / Other with Maps link + notes
2. Bookings: flight + hotel cards, PDF upload with review form
3. Multiple trips, export/import
4. Full offline caching
