# Idyll browser verification

This verifies the **actual three answer files in this repository**, using the platform's compiler, canonical sales data, and isolated Idyll preview in a real headless Chrome browser.

Checks:

- Task 1: quantity changes update both the displayed quantity and total.
- Task 2: 16 category/threshold combinations update table rows, chart rows, count, total, average, and empty-result messaging together.
- Task 3: forward and reverse scrolling activate the correct chart stages; controls update focus and highlights; reference values are monthly all-category means; the pin stays visible while scrolling; control selections persist across stages.
- The preview continues to block network access.

Reproduce with Node 22+ and Chrome installed, after building and starting the platform locally:

```sh
STUDIO_URL=http://127.0.0.1:8000 node scripts/verify_idyll_browser.cjs /path/to/crowdsource-code-platform
```

Set `CHROME_BIN` if Chrome is installed elsewhere. The browser uses a temporary profile, does not modify answer files, and creates no formal participant submissions. On success it writes [browser-validation.json](browser-validation.json), including hashes of the actual answer files and the platform commit.

The separate [validation-report.json](validation-report.json) covers all 12 answer files against the platform's existing compilers and checkers. Browser verification here is limited to the Idyll interactions described above; it is not a visual comparison for the other three languages.
