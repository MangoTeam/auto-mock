import { readFile, writeFile } from 'fs';
import { BenchResult } from './Bench';
// import {GraphFormat, genFromGF} from './Graph';
import { evalExamples } from './Interop';
import { MockdownClient } from 'mockdown-client';

import { difference } from './Set';

import { formatHTML } from './Pretty';

// import process from 'process';
// const {argv} = process;

import * as yargs from 'yargs';

async function read(fp: string): Promise<Buffer> {
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


async function loadBench(fp: string): Promise<BenchResult> {
    // my kingdom for . or $
    return read(fp)
        .then(d => BenchResult.fromJSON(JSON.parse(d.toString())))
        .catch(e => {
            console.log('error: bad file path ' + fp);
            throw e;
        });
}

type PlottingOptions = {
    sanity: boolean,
    type: MockdownClient.SynthType,
    fp: string,
    debugging: boolean
}

// Promise<GraphFormat>
async function plotResult(opts: PlottingOptions): Promise<number[][]> {
    const {fp, sanity, type} = opts;
    let benchRes = await loadBench(fp);
    let {train, test} = benchRes;

    let baselineRMS = 0;

    if (sanity) {
        train = [];
        for (let tree of test) {
            train.push(tree.copy())
        }
    }

    let err: number[][] = [];

    let oldConstraints : Set<string> = new Set();
    for (let bidx in train) {
        let theseExamples = train.slice(0, parseInt(bidx) + 1);
        let [constraints, predictedTrees] = await evalExamples(theseExamples, test, type);

        let nextConstraints = new Set(constraints.map(c => c.toString()));
        let newConstraints = difference(nextConstraints, oldConstraints);


        // console.log("new after widths ");
        // console.log(theseExamples.map(v => v.width));
        // console.log(newConstraints);
        // console.log('removed:');
        // console.log(difference(oldConstraints, nextConstraints));

        oldConstraints = nextConstraints;

        if (predictedTrees.length != test.length) {
            return Promise.reject('Unexpected error in output of evalExamples');
        }

        // console.log(theseExamples[0].find('box203'))
        let currErr = 0;
        for (let exidx in test) {
            const nextErr = await test[exidx].rms(predictedTrees[exidx])
            currErr += nextErr;

            if (opts.debugging && nextErr > 0) {
                console.log(`RMS of ${nextErr} for ${bidx}-${exidx}`);
                let name = opts.fp.split( '/' ).pop();
                writeFile(`debug/expected-${bidx}-${exidx}-${name}.html`, formatHTML(test[exidx]), (err) => {
                    if (err) {
                        console.log(err);
                        throw err;
                    }
                });

                writeFile(`debug/actual-${bidx}-${exidx}-${name}.html`, formatHTML(predictedTrees[exidx]), (err) => {
                    if (err) {
                        console.log(err);
                        throw err;
                    }
                });
            }
        }
        err.push([train[bidx].width, currErr / test.length]);
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


async function plotYoga(): Promise<number[][]> {

    const opts = {
        type: MockdownClient.SynthType.BASE,
        sanity: false,
        fp: './bench_cache/yoga-result.json',
        debugging: false
    }
    let output = await plotResult(opts);
    return output;
}

export async function main(): Promise<number[][]> {

    const argv = yargs.default.options({
        'filter': {
            describe: "mockdown filter",
            demandOption: true,
            type: 'string'
        }, 
        'fp': {
            describe: "name of input json",
            demandOption: true,
            type: 'string'
        },
        'sanity': {
            describe: "sanity check",
            type: 'boolean',
            default: false
        }, 
        'debug': {
            describe: "output debug info",
            type: 'boolean',
            default: false
        }        
    })
        .choices('filter',['base', 'fancy', 'none'])
        .help()
        .argv;
    const {_, __, fp, typI, sanity, debug} = argv;
    let type;
    switch (argv.filter) {

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

    const opts = {
        type: type,
        sanity: sanity,
        fp: './bench_cache/' + fp,
        debugging: debug
    }
    return await plotResult(opts);
}

main().then(console.log);
