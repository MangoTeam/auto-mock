1. make a configuration in Bench.ts (I would copy-paste from hackernews ). I make sure that the width range is linear by eyeballing and by using document.body.getBoundingClientRect() in console.
2. make sure the benchmark fully loads within the configuration timeout (which is in milliseconds)
3. replace the first parameter of browserbench with the new configuration object
4. make sure rollup.config.js points to Bench.ts
5. run npm run-script browser
6. open the website and copy-paste the contents into the console
7. wait while it opens windows
8. copy-paste the resulting output object into a new json file in bench_cache
9. add a new entry to benches.json  such that the top-level key is fresh and the second-level key is the filename of the bench_cache file. e.g. if the new json is ieee.json the second-level key is ieee.
10. make sure that the height/width dimensions of the new benches.json key match up with the dimensions of train and test data. Normally this is fine but sometimes the child body is fixed-height and ignores the browser window’s height (I think this is true for ieee).
11. run ./bench.sh <new-top-key> <new-second-key> hier --loclearn bayesian and pray