# Subdesk

An English-language support and billing dashboard demo using fictional USD data. It has no backend or payment provider. Support and Admin are demo roles, not security controls. Only Admin can record a full test refund. Browser data is stored locally in IndexedDB and is independent for each browser.

Run locally with `npm ci` followed by `npm run dev`. Use `npm run build` and `npm run lint` for the project checks, and `node --test tests/data.test.mjs` for the IndexedDB service tests (Node 25).

Reset demo restores the seed and clears locally recorded refunds and activity. No real payments are made.
