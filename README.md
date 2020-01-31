# auto-mock
Auto-Mock instruments an HTML page and compares a web browser's rendering
of the layout to Mockdown's rendering of the layout.

This works in two phases, *capturing* and *evaluation*.

## Capturing
Auto-Mock uses a web browser to snapshot several examples of an HTML page's layout. During this phase Auto-Mock captures both training data and testing data.

## Evaluation
Auto-Mock evaluates Mockdown on the captured layouts. First, Auto-Mock passes the training data to Mockdown as examples for synthesis. Auto-Mock uses the resulting constraints to evaluate Mockdown's performance on the testing data.

## Usage

### Capturing
Capturing is complicated because I couldn't get Node to open up a browser window.
So as a consequence, we'll use `npm run-script browser` to compile Auto-Mock into
a standalone script and run this script from a browser console.

This script needs to be specialized to each benchmark. In particular edit `Bench.ts` in the following way:
  1. Make sure that the hook at the bottom of the file calls the correct benchmark function, i.e. one of the `runXXX` functions.
  2. Make sure that the benchmark function opens the correct file. It's currently specialized to my local path. The variable to edit is `const url = ...` in the `runXXX` functions.
  
Once this is done, run `npm run-script browser`, which copies `Bench.ts` into a standalone script in your clipboard.
Then, open up a web browser console and copy-paste the output into the console. After a number of pop-ups the benchmark results
will be present in the console.

Copy-paste this result into a new JSON file in the `bench-cache/` subdirectory and give a name as you like.

### Evaluation
Evaluation is straightforward so long as `mockdown` is currently running and the website has been captured into a file in `bench-cache/`.
The command for this is `npm run-script mock -- --fp='<captured_file.json>' --filter='<base or none>' --range <low_width> <high_width>`.
For example, like so: `npm run-script mock -- --fp='yoga-empty.json' --filter='base' --range 400 900`. The output is a 
list of normalized RMS values where each `x` entry is that particular new width of the training set, and the `y` is the average
normalized RMS for the trees in the training set.
