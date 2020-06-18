import { readFile, writeFile, writeFileSync } from 'fs';
import { BenchResult } from './Bench';
// import {GraphFormat, genFromGF} from './Graph';
import { calcConstraints, evalExamples, tree2Mock } from './Interop';
import { MockdownClient, ConstraintParser } from 'mockdown-client';

import { difference } from './Set';

import { formatHTML, formatConstraints } from './Pretty';

import {Strength} from 'flightlessbird.js';

// import process from 'process';
// const {argv} = process;

import * as yargs from 'yargs';
import { toNumber } from 'vega';

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
    debugging: boolean,
    height: {
        lower: number,
        upper: number
    },
    width: {
        lower: number,
        upper: number
    },
    
}

// Promise<GraphFormat>
async function plotResult(opts: PlottingOptions): Promise<number[][]> {
    const {fp, sanity, type, height, width} = opts;
    let benchRes = await loadBench(fp);
    let {train, test} = benchRes;

    let minEx = [...train, ...test].reduce((l, r) => l.width < r.width ? l : r);
    let maxEx = [...train, ...test].reduce((l, r) => l.width > r.width ? l : r);

    // train = [minEx, maxEx, ...train];
    train=train.slice(0,2);
    let name = opts.fp.split( '/' ).pop();
    let baselineRMS = 0;

    if (sanity) {
        train = [];
        for (let tree of test) {
            train.push(tree.copy())
        }
    }

    if (opts.debugging) {
        console.log('test dimensions:')
        // console.log(`number: left, top x height, width`)
        for (const tidx in test) {
            const t = test[tidx];
            // console.log(`${ti}: ${t.left}, ${t.top} x ${t.height}, ${t.width}`)
            // left top right bottom
            const [left, top, right, bottom] = [t.left, t.top, t.left+t.width, t.top+t.height].map(Math.round)
            console.log(`RRect(${left}, ${top}, ${right}, ${bottom})`);

            writeFileSync(`debug/expected-${tidx}-${name}.html`, formatHTML(t));
        }  
        console.log('train dimensions:')
        // console.log(`number: left, top x height, width`)
        for (let t of train) {
            // console.log(`${ti}: ${t.left}, ${t.top} x ${t.height}, ${t.width}`)
            // left top right bottom
            console.log(`RRect(${t.left}, ${t.top}, ${t.left + t.width}, ${t.top + t.height})`);
            
        }   
    }

    let err: number[][] = [];
    

    let oldConstraints : Set<ConstraintParser.IConstraintJSON> = new Set();
    for (let bidx in train) {

        let theseExamples = train.slice(0, parseInt(bidx) + 1);
        console.log(`getting constraints for ${bidx}`);
        let constraints = await calcConstraints(theseExamples, type, {"height": height, "width": width});

        // console.log(`got ${constraints.length} constraints`);

        // let debugOut = {'constraints': constraints, 'view': tree2Mock(test[0])};

        // writeFileSync(`debug/${name}-bench.json`, JSON.stringify(debugOut));

        console.log(`evaling constraints for ${bidx}`);

        // const lowerW = theseExamples.map(t => t.width).reduce((x, y) => Math.min(x, y));
        // const upperW = theseExamples.map(t => t.width).reduce((x, y) => Math.max(x, y));
        
        let predictedTrees = evalExamples(constraints, test);

        // let nextConstraints = new Set(constraints);
        // let newConstraints = difference(nextConstraints, oldConstraints);


        // console.log("new after widths ");
        // console.log(theseExamples.map(v => v.width));
        // console.log(nextConstraints);
        // console.log('removed:');
        // console.log(difference(oldConstraints, nextConstraints));

        // oldConstraints = nextConstraints;

        if (predictedTrees.length != test.length) {
            return Promise.reject('Unexpected error in output of evalExamples');
        }

        // console.log(theseExamples[0].find('box203'))
        let currErr = 0;
        for (let exidx in test) {
            if (opts.debugging) console.log(`evaluating errors`);
            const nextErr = await test[exidx].rms(predictedTrees[exidx]);
            currErr += nextErr;

            if (sanity && exidx <= bidx && nextErr >= 0.5) {
                console.log(`Sanity error: nonzero error ${nextErr} for ${bidx}-${exidx}`);
            }

            if (opts.debugging && nextErr > 0) {
                console.log(`RMS of ${nextErr} for ${bidx}-${exidx}`);
                writeFileSync(`debug/actual-${bidx}-${exidx}-${name}.html`, formatHTML(predictedTrees[exidx]) + '\n' +  formatConstraints(new Set(constraints)));
            }
        }
        console.log(`ex/err for round ${bidx}: ${train[bidx].width}, ${currErr / test.length}`)
        err.push([train[bidx].width, currErr / test.length]);
    }
    return err;
}


// async function plotYoga(): Promise<number[][]> {

//     const opts = {
//         type: MockdownClient.SynthType.BASE,
//         sanity: false,
//         fp: './bench_cache/yoga-result.json',
//         debugging: false,
//         lower: 400,
//         upper: 900
//     }
//     let output = await plotResult(opts);
//     return output;
// }

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
        },
        'wrange': {
            describe: "input width range",
            type: 'array',
            demandOption: true
        },
        'hrange': {
            describe: "input width range",
            type: 'array',
            demandOption: true
        }        
    })
        .choices('filter',['base', 'fancy', 'none', 'hier', 'cegis'])
        .coerce(['wrange', 'hrange'], (it) => {
            const range = it.map((x: any) => parseInt(x.toString()));
            if (range.length != 2) {
                throw Error('range should be two numeric values');
            }
            return range as [number, number];
        })
        .help()
        .argv;
    const {_, __, fp, typI, sanity, debug, hrange, wrange, filter} = argv;
    // console.log(`filter ${filter}`)
    let type;
    switch (filter) {
        case 'base':
            type = MockdownClient.SynthType.BASE;
            break;
        case 'margins':
            type = MockdownClient.SynthType.BASE;
            break;
        case 'base':
            type = MockdownClient.SynthType.BASE;
            break;
        case 'hier':
            type = MockdownClient.SynthType.HIER;
            break;
        case 'cegis':
                type = MockdownClient.SynthType.CEGIS;
                break;
        case 'none':
        default:
            type = MockdownClient.SynthType.NONE
            break;
    }

    console.log(`Running mockdown benchmarks for ${fp} - ${wrange} with constraint picker: ${type}`);

    const opts = {
        type: type,
        sanity: sanity,
        fp: './bench_cache/' + fp,
        debugging: debug,
        height: {
            lower: hrange![0],
            upper: hrange![1]
        },
        width: {
            lower: wrange![0],
            upper: wrange![1]
        }
        
    }
    return await plotResult(opts);
}

// export async function debug() {
//     const it = 'bench_cache/ace-container-simpl.json'
//     const benches = await loadBench(it);
//     // const train = benches.train.slice(0,1);
//     // const test = benches.test.slice(0,1);
//     const {train, test} = benches;

//     const type = MockdownClient.SynthType.BASE;
//     const bounds = [500, 1000] as [number, number];
//     const constraints = await calcConstraints(train, type, bounds);
    
//     const output = await evalExamples(constraints, test);

//     return output;
// }

main().then(console.log).catch(console.log);
// debug().then(console.log).catch(console.log);

