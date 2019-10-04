import fs = require('fs');
import { BenchResult } from './Bench';
// import {GraphFormat, genFromGF} from './Graph';
import { evalExamples } from './Interop';
import { Tree } from "./Tree";


async function read(fp: string): Promise<Buffer> {
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


async function loadBench(fp: string): Promise<BenchResult> {
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

const DEBUG = false;

function focusIfDebug(examples: Tree[]) {
    if (!DEBUG) {
        return examples;
    } else {
        return examples.map((ex) => {
            return ex.children[2];
        });
    }
}

// Promise<GraphFormat>
async function plotResult(fp: string): Promise<number[]> {
    let benchRes = await loadBench(fp);
    let allExamples = benchRes.output;
    let err: number[] = [];
    for (let bidx in allExamples) {
        let theseExamples = allExamples.slice(0, parseInt(bidx) + 1);
        let focusedExamples = focusIfDebug(theseExamples);
        let predictedTrees = await evalExamples(focusedExamples);
        let currErr = 0;
        for (let exidx in focusedExamples) {
            currErr += await focusedExamples[exidx].rms(predictedTrees[exidx]);
        }
        err.push(currErr / focusedExamples.length);
    }
    return err;
}


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


function test() {
    const whereat = "./bench_cache/yoga-result.json";
    read(whereat)
        .then(data => {
            const json = JSON.parse(data.toString());
            BenchResult.fromJSON(json).then(console.log);
        });
}


async function plotYoga(): Promise<number[]> {
    let output = await plotResult('./bench_cache/yoga-result.json');
    return output;
}


plotYoga().then(console.log).catch(console.log);