# auto-mock

Typescript code for calculating boxes within a browser.

This project depends on `npm`, and uses TypeScript and Browserify. As long as you have `npm` installed you should be able to get the dependencies by running `npm install` from the root.

The source is located in `index.ts`. You can build by running `npm run-script build`, which compiles everything into a single JavaScript file in `main.js`. 

To run this in a browser, copy-paste the code into a web console. It depends on JQuery, so make sure that `$` is visible as the JQuery variable in the console. (You might have to run `let $ = jQuery;` before running the script; this is necessary on CNN.com).
