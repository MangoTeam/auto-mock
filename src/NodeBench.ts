import { writeFileSync, readFileSync } from 'fs';
import { BenchResult } from './Bench';
import { calcConstraints, evalExamples } from './Interop';

import { getSolverTimes, getSynthTime, setSynthTimeout, reset, setSynthTime} from './Benchmarking'
import { ConstraintParser, MockdownClient } from 'mockdown-client';

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
    noise: number, 
    useSBP: boolean
}


// Dependent types in typescript ;)
// we use conditional types to encode the following type:
// {timeout: boolean, elems: number, constraints: number, error: number|undefined if this.timeout, prep: number|undefined if this.timeout, etc}
type EvalOutput = {
    elems: number,
    constraints: number,
    error: number,
    prep: number,
    resize: number,
    synth: number,
    accuracy: number
};

function timeoutEOValue() : EvalOutput {
    return {
        elems: 0,
        constraints: 0,
        error: 0,
        prep: 0,
        resize: 0,
        synth: 0,
        accuracy: 0
    }
}

export function csvHeader(prefix: string) {
    return prefix + ",elems,constraints,error,prep,resize,synth,accuracy";
}

export function fmtCSVTimeout(result: {elems: number, constraints: number}, prefix? : string) {
    const teov = timeoutEOValue();
    // teov['elems'] = result.elems;
    // teov['constraints'] = result.constraints;
    const blanks = Object.values(teov).map(_ => "-");
    blanks.unshift(result.constraints.toPrecision(3))
    blanks.unshift(result.elems.toPrecision(3));
    let suff = blanks.slice(0, blanks.length-2).join(',');
    return prefix + suff;
}


export function fmtCSVOutput(result: EvalOutput, prefix?: string): string {
    const fmt = (x: number) => x.toPrecision(3);

    // if (result) {
    //     const blanks = Object.keys(result).map(_ => "-");

    //     blanks.unshift(fmt(result.elems), fmt(result.constraints));
    //     blanks.slice(0, blanks.length-2);
        
    //     return blanks.join(',');

    // } else {
    //     let foo = result.elems
    // }

    return (prefix ? prefix : "") + Object.values(result).map(fmt).join(',')
}

type HierStats = {
    depth: number | undefined,
    size: number | undefined
}

export async function calcHierStats() : Promise<HierStats[]> {

    const argv = yargs.default.options({
        'fp': {
            describe: "name of input json",
            demandOption: true,
            type: 'string'
        }
    })
        .help()
        .argv;

    let {train, test} = await loadBench('bench_cache/' + argv.fp);
    const idx = argv.fp.slice(0, argv.fp.length - 5);
    let benchTargets = JSON.parse(readFileSync('hier-config.json').toString());

    let nms : string [] | undefined = benchTargets[idx];

    const things = nms!.map(name => train[0].find(name));

    return Promise.resolve(things.map(x => {return {depth: x?.depth, size: x?.size}}));
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
            // console.log('coercing: ');
            // console.log(it);
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
    // console.log(nms);

    const focus = (nms).slice(0, argv.rows)
    console.log('names: ')
    console.log(focus);
    
    const names: Set<string> = new Set(focus);

    console.log('old size')
    console.log(train[0].size);

    train = train.map(t => t.filterNames(names));
    console.log('new size');
    console.log(train[0].size);
    // throw new Error('size is ' + train[0].size);
    
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
        trainAmount: argv["train-size"],
        useSBP: true
    }

    console.log('opts:');
    console.log(opts);

    // throw new Error('foo');

    if (argv.timeout) {
        setSynthTimeout(argv.timeout);
    }
    
    return await runBench(opts, train, test);

    
}

async function runBenchFromFile(opts: BenchOptions) : Promise <EvalOutput> {
    const {fp} = opts;
    let benchRes = await loadBench(fp);
    let {train, test} = benchRes;
    // console.log('size:')
    // console.log(train[0].size);
    // throw new Error('foo');
    return await runBench(opts, train, test);
}

export function computeSummaryStats(constraints: ConstraintParser.IConstraintJSON[], test: Tree[]) {
    return { elems: test[0].size, constraints: constraints.length}
}

export async function computeBenchStats(synthTime: number, constraints: ConstraintParser.IConstraintJSON[], test: Tree[], opts: BenchOptions) : Promise<EvalOutput> {
    // reset();

    // setSynthTime(synthTime);

    let summaryStats = computeSummaryStats(constraints, test);

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
            // console.log(`RMS of ${nextErr} for ${opts}-${exidx}`);
            const name = opts.fp.split( '/' ).pop();
            writeFileSync(`debug/actual-${exidx}-${name}.html`, formatHTML(predictedTrees[exidx]) + '\n' +  formatConstraints(new Set(constraints)));
        }
    }

    const {prep, resize} = getSolverTimes();
    
    const output = {
        error: totalError / test.length,
        prep: prep,
        resize: resize,
        synth: synthTime,
        accuracy: totalCorrect/totalElems
    }

    return {...summaryStats, ...output};
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

    let constraints = await calcConstraints(train, type, {"height": height, "width": width}, unambig, localOpt, opts.useSBP, noise);
    const synth = getSynthTime();
    
    const output = computeBenchStats(synth, constraints, test, opts);

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
        'use-sbp': {
            describe: "use the SB prior in noise-tolerant learning",
            type: 'boolean',
            default: true
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
    const useSBP = argv["use-sbp"];
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
        trainAmount: argv["train-size"],
        useSBP: useSBP
    }
    return await runBenchFromFile(opts);
}