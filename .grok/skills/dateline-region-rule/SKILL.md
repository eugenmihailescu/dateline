---
name: dateline-region-rule
description: >
  Add or change a Dateline score rule and its Appearance CSS for a country
  or region in the running Brave browser. Use when the user asks for a new
  country or region rule, a score band, a dl- class, or a flag-colored
  border on x.com posts (as with Sweden, West Asia, or South Asia), or
  runs /dateline-region-rule.
---

# Dateline country or region rule

Personal rules and CSS live in the running Brave profile, not in the repo.
Change product code only when an About label does not already map to a
place. Do not commit unless the user asks. Do not push. Do not edit sibling
extensions. Do not change git config.

Read the live options page before writing a score or a stylesheet. Memory
topics and this skill go stale. Africa and India have been blur and later
`display: none`. Copy whatever is in the textarea now.

## Where the mechanism lives

- Region ids and labels: `src/data/places.js` (`regions`, `regionByCountry`).
  The options checkbox shows the label. Its value is the id.
- About text maps through `exactRegionId` in `src/lib/normalize.js`. Every
  region label is exact. The only extra alias is `West Asia` → `middle_east`.
  There is no `west_asia` id. Do not add one.
- Signal order is `buildSignal` in `src/lib/signals.js`. An exact About
  region label is confidence 0.90 and `resolved`. A stated country is kept
  only when its region agrees. Otherwise the scored country is null, and
  confidence stays 0.90. That 0.50 cap applies only when About itself is a
  country and the stated country disagrees.
- Connected via is `normalizeConnectedVia`. Empty and generic app words are
  ignored. One country phrase wins. Otherwise one region phrase wins, longest
  first, at confidence 0.70. Account based in wins over Connected via.
- `not { country in [...] }` is false when the country is null
  (`matchesCondition` returns false for `in` on null, and `not` inverts that).
  Excepting India does not exclude an account whose country did not resolve.
- Aggregation is on the Rules tab. Leave it as it is. Under **sum**, every
  matching rule adds points, then one band wins (`matchRange` in
  `src/lib/ranges.js`). A country rule plus a region rule for the same post
  misses both exact bands, and the old style disappears.
- Class names must match `/^dl-[a-z0-9-]{1,32}$/` (`src/lib/validate.js`).
  Overlapping bands are rejected on save. An exact band needs both ends
  inclusive. `min === max` with the end excluded saves as "does not include
  any score."
- `sanitizeCss` (`src/lib/css-sanitize.js`) rejects `@import`, `@font-face`,
  `@namespace`, `expression(`, `javascript:`, `-moz-binding`, and `url(`.
  `border`, `border-color`, `filter`, and `display` are allowed.
- User CSS is injected as `#dl-user-css` and updates from storage without
  reloading x.com. A change under `src/` is invisible until `npm test`
  rebuilds the generated bundles, the unpacked extension is reloaded, and
  each open x.com tab is reloaded. Do not hand-edit `src/page/content.js`
  or `src/page/net-hook.js`.

## Before saving

1. Open the example account's About page in the already-open Brave window.
   Record Account based in and Connected via. Record the profile's stated
   place.
2. See whether that stated place resolves. Use the options Places playground
   or `normalizeLocation` against `places.js`. An unknown city leaves the
   country null.
3. Match the About label, not the stated city. A region label uses the
   region checkbox. A country label uses Countries. Check the region that
   already contains a country with its own exact band, and put that country
   in Except countries. Type the country name. The form stores the code.
4. If the About label is not a country and not an exact region label, add
   one alias in `src/lib/normalize.js` next to `West Asia`, plus a test next
   to the West Asia tests in `test/places.test.js`. Run `npm test`. Reload
   the unpacked extension and the x.com tab after that code change. Do not
   invent a new region id when an existing id already covers the countries.
5. Pick an unused integer score. Read the Appearance list. Do not reuse a
   band that is already there. Keep the band exact: From and To the same
   number, both "include" boxes checked.

## Options page

Last known unpacked id: `phjekcicelackinkfbjkffingiachcmm`, loaded from this
repo. Options URL:
`chrome-extension://phjekcicelackinkfbjkffingiachcmm/src/options/options.html`.
If that page does not load, read the id from `brave://extensions`.

Open that URL with Ctrl+T in the existing Brave window. Do not pass
`chrome-extension://` or `brave://` to `brave-bin`. That opens another window.

Rule form: `#rule-name`, `#rule-points`, `#region-choices` (check one region),
`#rule-countries`, `#rule-except`, `#rule-contains`, `#rule-confidence`
(leave 0.6), `#rule-enabled`. Placeholders such as "France, IL" and
"diaspora" are not values. Leave them empty. Submit Add rule.

The form resets on success, so the page can look unchanged. Scroll up. The
status line says "Rule added." Open Edit on the new row and confirm the
region, the excepted codes, the points, and 0.6.

Appearance: `#range-name`, `#range-classes` (`dl-` plus a short slug),
`#range-min`, `#range-max`. `#range-min-in` starts checked. `#range-max-in`
starts unchecked. Check it. `#range-badge` starts checked. Uncheck it unless
the user asked for a badge. Do not click Low, Medium, High, or Dim. They
toggle those class names into the field. Status "Band added." The row reads
"N to N inclusive."

## CSS

Select all in `#user-css` and copy it before typing. Append one block. Paste
the whole sheet back so the other rules stay.

```css
article[data-testid="tweet"].dl-example,
article.dl-example {
  border-style: solid;
  border-width: 2px;
  border-color: #top #right #bottom #left;
}
```

`border-color` is top, right, bottom, left.

A country uses that country's flag. Two main colors go on opposite sides:
top and left one color, right and bottom the other, unless the user names
the sides.

A region uses four different colors, one per side, from the most
representative flags in that region. Look up each official RGB. Do not pick
a nearby hex from memory. Tell the user which flag each side comes from. A
black side is faint on X's dark background. Say so.

Click Save CSS. The status line must say "CSS saved." Any other text is the
sanitizer error. Fix the sheet and save again.

## Check it on x.com

Storage rules and CSS do not need an extension reload.

Use the profile timeline, not the About route. About has no articles. Wait
until a post is on screen. Confirm an article has the new class and the
computed border colors. Pixel colors are enough when DevTools is closed.
`border-color` top, right, bottom, left must match the hex you saved
(2px). Then open an account that must not match, especially a country you
excepted. Its old style must remain. If that post becomes visible and
unstyled, the scores were added together and missed both bands.

A `dl-*` class that vanishes for about a second and comes back is X rewriting
`class`. `lostDatelineClass` in `src/page/main.js` paints it again. A class
that stays missing means the score did not hit the band.

## Driving the running Brave window

CDP on this Brave is not usable. `DevToolsActivePort` is not a working
endpoint. The chrome-devtools MCP server starts a different browser. Drive
the `brave-bin` window that is already open.

- Do not kill Brave. Do not write its LevelDB. Do not close the user's tabs.
- `DISPLAY=:0.0`. Find the window with `xdotool search` and
  `getwindowname`. Re-measure its origin. It has sat on the right monitor
  at 1920,0. Screen coordinates are window coordinates plus that origin.
- Activate the window, then send keys without `--window`. Ctrl+L replaces
  the address bar of the current tab. Ctrl+1 selects the first tab.
- Screenshot with `import -window`. Tesseract misses the beige pills. Find
  controls by pixel color: white fields, the dark selected tab.
- The first click on Appearance often misses. Screenshot again and click
  the pill that is actually white.
- Back up the clipboard with `xclip -selection clipboard -o` before a paste,
  and restore it afterward.
- Do not click a DevTools console link. That has opened Intercom and an ads
  page. If such a tab appears and then closes, the user closed it.

## Done

Say the score, the match (region or country, and any excepted countries),
the class, each border color and its flag, and what you checked on the
example account and on the account that must not match. Say whether a code
change was required. Leave the example profile open.
