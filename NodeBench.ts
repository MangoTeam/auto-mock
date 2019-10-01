import fs = require('fs');
import util = require('util');
import {runYoga, BenchResult} from './Bench';
import {Tree} from './Tree'
// import {GraphFormat, genFromGF} from './Graph';
import {evalExamples} from './Interop';

// import VE = require('vega-embed');


// async function read(fp: string) : Promise<Buffer> {
//   return util.promisify(fs.readFile)(fp)
// }

async function read(fp: string) : Promise<Buffer> {
  return new Promise((accept, fail) => {
    fs.readFile(fp, (err, data) => {
      if (err) {
        return fail('file not found: ' + fp);
      } else {
        return accept(data);
      }
    })
  });
  
}


async function loadBench(fp: string) : Promise<BenchResult> {
  // my kingdom for . or $
  return read(fp)
    .then(d => 
      BenchResult.fromJSON(
        JSON.parse(
          d.toString()
        )
      )
    );
}

// Promise<GraphFormat>
async function plotResult(fp: string) : Promise<number[]> {
  let benchRes = await loadBench(fp);
  let allExamples = benchRes.output;
  let err : number[] = [];
  for (let bidx in allExamples) {
    let theseExamples = allExamples.slice(0, parseInt(bidx)+1);
    let predictedTrees = await evalExamples(theseExamples);
    let currErr = 0;
    for (let exidx in theseExamples) {
      currErr += await allExamples[exidx].rms(predictedTrees[exidx]);
    }
    err.push(currErr/theseExamples.length);
  }
  // return new GraphFormat(benchRes.name, err);
  return err;
}

// async function writeBenchResults(lhs: string, rhs: string, ) : Promise<GraphFormat> {
//   let lhsBR = await loadBench(lhs);
//   let rhsBR = await loadBench
// }


function saveBench(b: BenchResult) {
  let prefix = "./bench_cache";
  console.log(fs);
  fs.writeFile(prefix + b.name + '.json', JSON.stringify(b), (err: any) => {
    if (err) {
      console.log(err);
      throw err;
    }
  });
}

// runYoga().then( (yr) => {
//   saveBench(yr);
// })

function test() {
  const whereat = "./bench_cache/yoga-result.json";
  read(whereat)
    .then(data => {
      const json = JSON.parse(data.toString());
      BenchResult.fromJSON(json).then(console.log);
    });
}



async function plotYoga() : Promise<number[]> {
  let output = await plotResult('./bench_cache/yoga-result.json');
  return output;
  // return genFromGF(output);
}


plotYoga().then(console.log).catch(console.log);
  // .then(_ => console.log('success!!'))
  // .catch(console.log)