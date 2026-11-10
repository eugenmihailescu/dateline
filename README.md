# Dateline

Color posts on x.com by where the account is based. You write the rules. The score picks a color.

Dateline runs in desktop Chrome and Brave, Manifest V3. It does not use an X developer app, and it does not send accounts or rules to another server.

## Install

1. Clone this repository.
2. Open `chrome://extensions` or `brave://extensions`.
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this folder.

After a change to the manifest or a script, reload Dateline from that page, then reload the x.com tab.

## What you can do

- Add a rule such as “Europe except UK and Ireland, 20 points” or “Israel, 50 points”.
- Choose how several matching rules combine: add the points, keep the highest, or keep the first rule in the list.
- Map a score band to CSS classes. Packaged classes are `dl-band-low`, `dl-band-mid`, `dl-band-high`, and `dl-dim`.
- Move a country to another region, or teach an alias such as “Holland” → Netherlands.
- Export and import a ruleset. The shape is described in `schema/ruleset.schema.json`.

Example rules live in `samples/example-ruleset.json`. **Load examples** in the options page adds them turned off.

A post with no usable place is not scored as zero. Zero means the place was known and no rule matched.

## Signals

| Signal | Where it comes from | How sure |
| --- | --- | --- |
| About this account | Country x.com shows, or a region when that label is only a continent such as Africa. X’s “West Asia” label is the Middle East country set. | Strongest. Still not proof of residence. Confidence 0.90. A profile country in another region does not replace it, and that profile country is not scored. |
| Connected via | The app or store on the same About screen, such as “Africa Android App” or “United States App Store” | Used when Account based in has no place. One country, or one region, at confidence 0.70. “Web” is ignored. “South Africa Android App” is South Africa, not the Africa region alone. |
| Stated location | The profile’s free-text place | Country name 0.75, known city 0.60. Jokes, “Earth”, and a bare continent are unknown. |
| Website host, account language | Profile fields | Optional rule conditions. They never assign a country by themselves. |

Timeline posts do not include a place. Dateline reads places from profiles you open, from responses x.com already made, and, when enrichment is on, from a slow queue of “About this account” reads for posts on screen. The queue waits at least 800 ms between reads and stops at 40 new accounts a minute. A rate limit pauses it.

You need to be logged in for “About this account”. Stated locations on profiles still work when you are logged out.

## Develop

```bash
npm test
```

`npm test` rebuilds two generated scripts. `src/page/net-hook.js` comes from `src/lib/graphql.js` and `src/page/hook-main.js`. `src/page/content.js` is the isolated page script, bundled into one classic file so x.com’s content-security policy cannot block it. Edit the source modules, not the generated files.

`python3 scripts/build-places.py` refreshes the country list. It needs the system `iso-codes` package. The generated `src/data/places.js` is committed.

Country and region assignment, including Turkey, Cyprus, Russia, Mexico, Egypt, and Israel, is covered by `test/places.test.js`. Change a country from the Places tab, or in `scripts/build-places.py` if the default should change for everyone.

## Privacy

See [PRIVACY.md](PRIVACY.md). Processing stays on this browser. Chrome sync, if you turn it on, copies rules and settings only.
