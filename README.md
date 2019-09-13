# auto-mock

Typescript code for calculating boxes within a browser.

This project depends on `npm`, and uses TypeScript and Browserify. As long as you have `npm` installed you should be able to get the dependencies by running `npm install` from the root.

The source is located in `index.ts`. You can build by running `npm run-script build`, which compiles everything into a single JavaScript file in `main.js`. 

To run this in a browser, copy-paste the code into a web console. It depends on JQuery, so make sure that `$` is visible as the JQuery variable in the console. (You might have to run `let $ = jQuery;` before running the script; this is necessary on CNN.com).

## Yoga benchmark

Our first benchmark is <https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html>. To run this benchmark, do the following:

  1. Open the benchmark in a new tab (tested on Firefox).
  2. Compile the benchmark code to `main.js` via `tsc && browserify Bench.js -o main.js`. There should be no errors.
  3. From the benchmark site, open up the developer console.
  4. Copy-paste the contents of `main.js` into the console. There should be a sequence of pop-ups.
  5. Once the last pop-up closes, access the results by querying `window.localStorage.getItem('bench')`. There should be a JSON object detailing the results.
  6. The TypeScript source is in `Bench.ts` and the JSON schema is in the `Bench`, `BenchResult`, and `Tree` classes.
