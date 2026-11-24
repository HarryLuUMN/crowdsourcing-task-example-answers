# CrowdCode task example answers

Reference answers for all **12 current formal tasks**: three each for KnitScript, Idyll, Penrose, and Vega-Lite. The Python onboarding exercise is not a formal task and is not included.

Copy the contents of an answer into its corresponding CrowdCode task editor and choose **Run**, then inspect **Checks**. Answers target the CrowdCode environment, including its supplied data and components; they are not standalone websites or scripts.

| Directory | Task 1 | Task 2 | Task 3 |
| --- | --- | --- | --- |
| `knitscript/` | Plain swatch | Ribbed swatch | Striped swatch |
| `idyll/` | Interactive calculator | Linked sales explorer | Scroll-driven sales story |
| `penrose/` | Nested sets | Overlapping sets | Points and sets |
| `vegalite/` | Bar chart | Line chart | Scatterplot |

Each directory contains `task1_answer`, `task2_answer`, and `task3_answer` with the appropriate `.ks`, `.idyll`, `.substance`, or `.json` extension. [tasks.json](tasks.json) maps each file to its exact task ID.

Idyll Tasks 2 and 3 use the replacement **v2** tasks (`idyll-explorer-v2` and `idyll-story-v2`), rather than the retired temperature converter and conditional-label tasks. Their files include the provided article text and the interaction implementation.

## Environment

These answers target [CrowdCode](https://github.com/HarryLuUMN/crowdsource-coding-platform) at commit `95692d6bba95f7298734aa701e34adfe0ebe0035`.

- Vega-Lite uses CrowdCode's `/sales-data.json` route.
- Advanced Idyll uses the fixed `sales-data.json` dataset and CrowdCode's Table, Chart, Scroller, Step, and Pinned components.
- Penrose edits Substance only; CrowdCode supplies Domain and Style.
- KnitScript uses the compiler and simulator installed by CrowdCode.

No separate dependencies are added to this answers repository.

## Reproduce validation

Prepare the platform's documented Python and Node environments, then run this repository's verifier **with the platform's Python environment**:

```sh
/path/to/crowdsource-code-platform/.venv/bin/python scripts/verify.py \
  --platform /path/to/crowdsource-code-platform \
  --report validation-report.json
```

The verifier reads the actual answer files, checks that their IDs match the platform's complete current catalog, runs every real compiler/runtime and checker, and exits unsuccessfully if any answer fails. It does not change the platform's checkers. [validation-report.json](validation-report.json) records the platform commit, per-file SHA-256 hashes, and individual check results from the most recent recorded run.

Browser interaction verification is recorded separately in [browser-validation.md](browser-validation.md). Passing compiler/model checks and passing actual browser interactions are distinct evidence; a static check report alone does not establish scroll or rendering behavior.

## Recorded validation results

- All 12 answer files compiled and passed all 57 individual platform checks.
- All three Idyll answers passed real browser interaction tests, including 16 explorer control combinations and forward/reverse story scrolling.
- Answer SHA-256 hashes are recorded in both reports so evidence can be matched to these exact files.
