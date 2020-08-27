import { writeFileSync, readFileSync } from 'fs';
import { BenchResult } from './Bench';
import { calcConstraints, evalExamples } from './Interop';

import { getSolverTimes, getSynthTime, setSynthTimeout} from './Benchmarking'
import { MockdownClient } from 'mockdown-client';

import { formatHTML, formatConstraints} from './Pretty';

import { Tree } from './Tree'

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
    localLearner: "simple" | "heuristic" | "bayesian",
    trainAmount: number,
    noise: number
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

export async function runHierBench() {
    // opts: height/width, filepath, number of examples, number of training examples
    const argv = yargs.default.options({
        'fp': {
            describe: "name of input json",
            demandOption: true,
            type: 'string'
        },
        'alg': {
            describe: "name of algorithm",
            demandOption: true,
            type: 'string'
        },   
        'train-size': {
            describe: "number of training examples",
            type: 'number',
            demandOption: true
        },
        'rows': {
            describe: "number of rows",
            type: 'number',
            demandOption: true
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
        }, 
        'timeout' : {
            describe: "synthesis timeout cutoff in seconds",
            type: 'number',
            demandOption: true
        }    
    })
        .choices('alg', ['base', 'hier'])
        .coerce(['wrange', 'hrange'], (it) => {
            const range = it.map((x: any) => parseFloat(x.toString()));
            if (range.length != 2) {
                throw Error('range should be two numeric values');
            }
            return range as [number, number];
        })
        .help()
        .argv;

    let {train, test} = await loadBench('bench_cache/' + argv.fp);
    const idx = argv.fp.slice(0, argv.fp.length - 5);
    let benchTargets = JSON.parse(readFileSync('hier-config.json').toString());

    let nms : string [] | undefined = benchTargets[idx];
    if (!nms) {
        nms = train[0].children.map(c => c.name!);
    }
    
    // console.log(benchTargets);
    // console.log(idx);
    // console.log(benchTargets[idx]);
    console.log(nms);

    const focus = (nms).slice(0, argv.rows)
    // console.log('names: ')
    // console.log(focus);
    
    const names: Set<string> = new Set(focus);

    train = train.map(t => t.filterNames(names));
    test = test.map(t => t.filterNames(names));

    let alg: MockdownClient.SynthType;
    switch (argv.alg) {
        case 'base': alg = MockdownClient.SynthType.BASE; break;
        case 'hier': alg = MockdownClient.SynthType.HIER; break;
        default: alg = MockdownClient.SynthType.HIER; break;
    }

    const opts: BenchOptions = {
        type: alg,
        sanity: false,
        fp: './bench_cache/' + argv.fp,
        debugging: true,
        height: {
            lower: argv.hrange![0],
            upper: argv.hrange![1]
        },
        width: {
            lower: argv.wrange![0],
            upper: argv.wrange![1]
        },
        unambig: false,
        localLearner: 'bayesian',
        noise: 0.0,
        trainAmount: argv["train-size"]
    }

    if (argv.timeout) {
        setSynthTimeout(argv.timeout);
    }
    
    return await runBench(opts, train, test);

    
}

async function runBenchFromFile(opts: BenchOptions) : Promise <EvalOutput> {
    const {fp} = opts;
    let benchRes = await loadBench(fp);
    let {train, test} = benchRes;
    return await runBench(opts, train, test);
}

async function runBench(opts: BenchOptions, train: Tree[], test: Tree[]): Promise<EvalOutput> {
    const {sanity, type, height, width, unambig, localLearner, noise, trainAmount} = opts;

    const numExamples = train.length;
    train=train.slice(0,trainAmount);
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

    let localOpt : "simple" | "heuristic" | "noisetolerant";
    switch (localLearner) {
        case "simple": localOpt = "simple"; break;
        case "bayesian": localOpt = "noisetolerant"; break;
        case "heuristic": localOpt = "heuristic"; break;
    }

    let constraints = await calcConstraints(train, type, {"height": height, "width": width}, unambig, localOpt, noise);
    
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
        'noise': {
            describe: "add noise",
            type: 'number',
            default: 0.0
        },
        'train-size': {
            describe: "number of train examples",
            type: 'number',
            default: 10.0
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
        .choices('loclearn', ['simple', 'heuristic', 'bayesian'])
        .coerce(['wrange', 'hrange'], (it) => {
            const range = it.map((x: any) => parseFloat(x.toString()));
            if (range.length != 2) {
                throw Error('range should be two numeric values');
            }
            return range as [number, number];
        })
        .help()
        .argv;
    const {_, __, fp, sanity, debug, hrange, wrange, filter, unambig, loclearn, noise} = argv;
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
    let locLearn: "simple" | "heuristic" | "bayesian";
    switch (loclearn) {
        case 'simple': locLearn = "simple"; break;
        case 'bayesian': locLearn = "bayesian"; break;
        case 'heuristic': locLearn = "heuristic"; break;
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
        localLearner: locLearn,
        noise: noise,
        trainAmount: argv["train-size"]
    }
    return await runBenchFromFile(opts);
}