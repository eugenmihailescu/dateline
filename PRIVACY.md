# Privacy policy for Dateline

Last updated: 10 November 2026

Dateline is a browser extension by Eugen Mihailescu. On x.com it reads public signals about where an account is based, scores the posts you can already see with rules you wrote, and colors those posts. This policy says what the extension stores, why, and who can see it.

Contact: [eugen.mihailescu@protonmail.com](mailto:eugen.mihailescu@protonmail.com)

## What Dateline stores

Dateline stores data in Chrome storage on your browser profile. It does not create an account. It does not send profiles, rules, or scores to Eugen Mihailescu or to any other server.

On this browser, Dateline can store:

- Your rules, score bands, country-to-region overrides, location aliases, and settings.
- A local cache of accounts it has already resolved: the handle, the place text x.com showed, the normalized country and region, a confidence value, and the time that entry expires. The cache holds at most 5,000 accounts. Bios are not stored.
- The last 50 debug decisions, in memory, while a tab is open and debug mode is on.

If you turn on **Sync rules across browsers**, Chrome sync copies the rules and settings. It does not copy the account cache. There is no export of the accounts Dateline has seen. Export downloads the rules you wrote.

## What it reads from x.com

Dateline reads the page you are viewing: the author of each visible post, and, on a profile, the location and website the profile shows. When enrichment is on, it also reads x.com’s own “About this account” response for accounts on screen, using the session you already have. Those requests go to x.com, not to a Dateline server. The extension does not ask you for an X developer key.

Location labels are signals, not proof of where a person is.

## Why this data is stored

The rules are stored so your colors come back. The account cache is stored so a timeline does not ask x.com for the same account again and again. Settings are stored so the extension stays on or off as you left it.

## How long it is kept

An “About this account” country, region, or Connected via label is kept for 30 days. A stated location with none of those is kept for 7 days. A miss is kept for 24 hours. **Clear saved places** deletes the cache. Removing Dateline deletes the extension’s stored data.

## Who can see it

The data stays in this browser profile, plus Chrome sync if you turn that on. Dateline does not sell it, upload it, or share it. There are no advertisements and no analytics.

## Permissions

- `storage` keeps rules, settings, and the account cache.
- Access to `https://x.com/*` and `https://twitter.com/*` lets the extension run on those sites and read the page you opened.

One script runs in the page’s own JavaScript world so it can see profile data x.com already requested and so it can send the same “About this account” read the site uses. That script does not send the result anywhere except to the rest of Dateline in the same tab.

## Limited use

Dateline uses this data only to color posts on x.com according to your rules. The use of information received from Chrome extension APIs adheres to the [Chrome Web Store User Data Policy](https://developer.chrome.com/docs/webstore/program-policies/user-data), including the Limited Use requirements.

## Changes

Changes to this policy will be posted in this document with a new date.
