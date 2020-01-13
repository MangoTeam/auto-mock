import {readFile, writeFile} from 'fs';
import {runYoga, BenchResult, Bench} from './Bench';
import {Tree} from './Tree'
// import {GraphFormat, genFromGF} from './Graph';
import {evalExamples} from './Interop';
import {MockdownClient} from 'mockdown-client'

import {argv} from 'process';
import { fail } from 'assert';

async function read(fp: string) : Promise<Buffer> {
  return new Promise((accept, fail) => {
    readFile(fp, (err, data) => {
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
    .then( d =>  BenchResult.fromJSON(JSON.parse(d.toString())))
    .catch(e => {
        console.log('error: bad file path ' + fp);
        throw e;
    });
}

// Promise<GraphFormat>
async function plotResult(fp: string, type?: MockdownClient.SynthType, sanity? : boolean) : Promise<number[][]> {
  let benchRes = await loadBench(fp);
  let {train, test} = benchRes;
  

  let baselineRMS = 0;
  

  if (sanity) {
    test = train;
  }
  let err : number[][] = [];
  for (let bidx in train) {
    let theseExamples = train.slice(0, parseInt(bidx)+1);
    let predictedTrees = await evalExamples(theseExamples, test, type);

    if (predictedTrees.length != test.length) {
      return Promise.reject('Unexpected error in output of evalExamples');
    }

    // console.log(theseExamples[0].find('box203'))
    let currErr = 0;
    let pdiff = 0;
    for (let exidx in test) {
      currErr += await test[exidx].rms(predictedTrees[exidx]);
      pdiff += await test[exidx].pixDiff(predictedTrees[exidx]);
    }
    err.push([currErr/test.length, pdiff]);
  }
  // return new GraphFormat(benchRes.name, err);
  return err;
}


function saveBench(b: BenchResult) {
  let prefix = "./bench_cache";
  writeFile(prefix + b.name + '.json', JSON.stringify(b), (err: any) => {
    if (err) {
      console.log(err);
      throw err;
    }
  });
}

// runYoga().then( (yr) => {
//   saveBench(yr);
// })

async function test() {
  const data = await read("./bench_cache/yoga-result.json");
  const json = JSON.parse(data.toString());
  return BenchResult.fromJSON(json).then(console.log);
}



async function plotYoga() : Promise<number[][]> {
  let output = await plotResult('./bench_cache/yoga-result.json');
  return output;
}

export async function main() : Promise<number[][]> {
  const [_, __, fp, typI, san] = argv;
  if (!fp) {
    throw new Error("Missing command-line argument for path:" + argv.slice(2).toString());
  }
  let type;
  switch (typI) {

    case 'base':
      type = MockdownClient.SynthType.BASE;
      break;
    case 'fancy': 
      type = MockdownClient.SynthType.FANCY;
      break;
    case 'none':
    default:
      type = MockdownClient.SynthType.NONE
      break;
  }

  

  console.log('Running mockdown benchmarks for ' + fp + ' with constraint picker: ' + type)
  let sanity;
  if (san) {
    console.log('Running sanity check; test and train are identical');
    sanity = true;
  }
  return await plotResult('./bench_cache/' + fp, type, sanity);
}

main().then(console.log); 