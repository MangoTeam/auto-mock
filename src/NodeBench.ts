import { writeFileSync, readFileSync } from 'fs';
import { BenchResult } from './Bench';
import { calcConstraints, evalExamples } from './Interop';

import { getSolverTimes, getSynthTime, setSynthTimeout} from './Benchmarking'
import { MockdownClient } from 'mockdown-client';

import { formatHTML, formatConstraints} from './Pretty';

import * as yargs from 'yargs';

async function loadBench(fp: string): Promise<BenchResult> {
    // my kingdom for . or $
    const data = readFileSync(fp);
    return BenchResult.fromJSON(JSON.parse(data.toString()));
}

type BenchOptions = {
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
    unambig: boolean,
    localLearner: "simple" | "bayesian"
}

type EvalOutput = {
    elems: number,
    constraints: number,
    error: number,
    prep: number,
    resize: number,
    synth: number,
    accuracy: number
}

async function runBench(opts: BenchOptions): Promise<EvalOutput> {
    const {fp, sanity, type, height, width, unambig, localLearner} = opts;
    let benchRes = await loadBench(fp);
    let {train, test} = benchRes;

    // const numExamples = 999;
    // train=train.slice(0,numExamples);
    let name = opts.fp.split( '/' ).pop();

    if (sanity) {
        train = [];
        for (let tree of test) {
            train.push(tree.copy())
        }
    }

    if (opts.debugging) {
        // console.log('test dimensions:')
        // console.log(`number: left, top x height, width`)
        for (const tidx in test) {
            const t = test[tidx];
            writeFileSync(`debug/expected-${tidx}-${name}.html`, formatHTML(t));
        }   
    }

    let localOpt : "simple" | "noisetolerant";
    switch (localLearner) {
        case "simple": localOpt = "simple"; break;
        case "bayesian": localOpt = "noisetolerant"; break;
    }

    let constraints = await calcConstraints(train, type, {"height": height, "width": width}, unambig, localOpt);
    
    const synth = getSynthTime();

    let predictedTrees = evalExamples(constraints, test);

    if (predictedTrees.length != test.length) {
        return Promise.reject('Unexpected error in output of evalExamples');
    }

    let totalError = 0;
    let totalCorrect = 0;
    let totalElems = 0;
    for (let exidx in test) {
        // if (opts.debugging) console.log(`evaluating errors`);
        const nextErr = await test[exidx].rms(predictedTrees[exidx]);
        totalError += nextErr;
        totalCorrect += test[exidx].identicalPlaced(predictedTrees[exidx]);
        totalElems += test[exidx].size;

        if (opts.debugging && nextErr > 0) {
            console.log(`RMS of ${nextErr} for ${numExamples}-${exidx}`);
            writeFileSync(`debug/actual-${numExamples}-${exidx}-${name}.html`, formatHTML(predictedTrees[exidx]) + '\n' +  formatConstraints(new Set(constraints)));
        }
    }

    const {prep, resize} = getSolverTimes();
    
    const output : EvalOutput = {
        error: totalError / test.length,
        elems: train[0].size,
        constraints: constraints.length,
        prep: prep,
        resize: resize,
        synth: synth,
        accuracy: totalCorrect/totalElems
    }

    writeFileSync('eval/tmp/benchmark.json', JSON.stringify(output));

    return output;
}

export async function main(): Promise<EvalOutput> {

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
        'loclearn' : {
            describe: "type of local learning method",
            demandOption: true,
            type: 'string'
        },
        'sanity': {
            describe: "sanity check",
            type: 'boolean',
            default: false
        }, 
        'unambig': {
            describe: "explicitly solve for an unambiguous layout",
            type: 'boolean',
            default: false
        },
        'timeout' : {
            describe: "synthesis timeout cutoff in seconds",
            type: 'number'
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
        .choices('loclearn', ['simple', 'bayesian'])
        .coerce(['wrange', 'hrange'], (it) => {
            const range = it.map((x: any) => parseFloat(x.toString()));
            if (range.length != 2) {
                throw Error('range should be two numeric values');
            }
            return range as [number, number];
        })
        .help()
        .argv;
    const {_, __, fp, sanity, debug, hrange, wrange, filter, unambig, loclearn} = argv;
    let type;
    switch (filter) {
        case 'base':
            type = MockdownClient.SynthType.BASE;
            break;
        case 'margins':
            console.log('unsupported margin pruner, default to base');
            type = MockdownClient.SynthType.BASE;
            break;
        case 'hier':
            type = MockdownClient.SynthType.HIER;
            break;
        case 'none':
        default:
            type = MockdownClient.SynthType.NONE
            break;
    }
    let locLearn: "simple" | "bayesian";
    switch (loclearn) {
        case 'simple': locLearn = "simple"; break;
        case 'bayesian': locLearn = "bayesian"; break;
        default:
            locLearn = "simple";
            break;
    }

    console.log(`Running mockdown benchmarks for ${fp} - ${wrange} with local learner ${locLearn} and global picker: ${type}`);

    if (argv.timeout) {
        setSynthTimeout(argv.timeout);
    }

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
        },
        unambig: unambig,
        localLearner: locLearn
    }
    return await runBench(opts);
}


main().then(console.log).catch(console.log);

