import { smooth, flatten, mockify, Tree, nameTree } from './Tree';

import {PcgRandom} from 'pcg-random';

export class Bench {

    constructor(
        public lo: number, 
        public hi: number, 
        public trainSeed: number, 
        public trainSize: number,
        public testSeed: number,
        public testSize: number
    ) {
    }

    static async fromJSON(json: any): Promise<Bench> {
        return new Promise((ret, err) => {
            ret(new Bench(json.lo, json.hi, json.trainSeed, json.trainSize, json.testSeed, json.testSize));
        });
    }
}

export async function runner(url: string, height: number, width: number, timeout: number, rootid? : string): Promise<Tree> {

    return new Promise((resolve) => {
        // const foo = (e: any) => {resolve(new Tree('hello, world!', 0, 0, 0, 0));};
        let doc = window.open(url, "bench", `height=${height},width=${width}`)!;
        
        doc.onload = () => {
            doc.opener.postMessage('it', '*');
        }

        // @TODO: onload still doesn't work..... the output remains malformed
        // window.addEventListener('message', () => {
        setTimeout(() => {
            let root = doc.document.body;;
            if (rootid) {
                root = doc.document.getElementById(rootid) || doc.document.body;
            }
            
            let out = flatten(mockify(root));
            // console.log('names:');
            // console.log(out.names());
            // nameTree(out);
            // console.log(out.names());
            // console.log(out);
            doc.close();
            resolve(out);
        }
        , timeout);
        // , false);
    });
}


async function runBenches(name: string, url: string, height: number, minw: number, maxw: number, seed: number, amount: number, timeout: number, rootid? : string): Promise<Tree[]> {
    const output = [];

    const rand = new PcgRandom(seed);
    const upper = maxw - minw;

    // output.push(await runner(url, height, minw));
    // output.push(await runner(url, height, maxw));


    for (let i = 0; i < amount; ++i) {
        output.push(await runner(url, height, minw + rand.integer(upper), timeout, rootid));
    }    
    return output;
}

export class BenchResult {
    constructor(public name: string, public height: number, public bench: Bench, public train: Tree[], public test: Tree[]) {
    }

    /**
     * validate
     */
    public validate() : boolean {
        if (this.train.length < 1) {
            return false;
        }
        [...this.train, ...this.test].forEach(t => nameTree(t))
        for (let tidx in this.test){
            let different = this.test[tidx].sameStructure(this.train[0]);
            if (different) {
                const [diffName, path] = different;
                console.log(`Validation error: malformed train and test at ${diffName}, ${path}, test ${tidx}`);
                // console.log(JSON.stringify(this.train))
                // console.log(JSON.stringify(this.test))
                return false
            }
        }
        return true;
    }

    static async fromJSON(json: any): Promise<BenchResult> {
        const bench = Bench.fromJSON(json.bench);
        const trains = json.train.map(Tree.fromJSON);
        const tests = json.test.map(Tree.fromJSON);
        return new BenchResult(json.name, json.height, await bench, await Promise.all(trains), await Promise.all(tests));
    }
}

export async function runYoga() {
    const url = "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html";
    const name = "yoga";
    const height = 600;
    const lo = 348;
    const hi = 900;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 3000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export async function yogaPost() {
    const url = "file:///Users/john/auto-mock/test/yoga/img.html";
    const name = "yoga-img";
    const height = 600;
    const lo = 348;
    const hi = 900;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 3000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export async function runCNN() {
    const url = "https://www.cnn.com/";
    const name = "cnn";
    const height = 960;
    const lo = 1350;
    const hi = 1800;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 7000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export async function ace() {
    const url = "http://localhost:8888/kitchen-sink.html";
    const name = "ace-editor-compressed";
    const height = 960;
    const lo = 600;
    const hi = 1100;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 5000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
    // const root = "controls";
    const root = undefined;

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export async function runSimple() {
    const url = "file:///Users/john/auto-mock/example.html";
    const name = "example";
    const height = 600;
    const lo = 400;
    const hi = 900;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 1000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export async function adjacent() {
    const url = "file:///Users/john/auto-mock/adjacent.html";
    const name = "adjacent";
    const height = 600;
    const lo = 400;
    const hi = 900;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 1000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet);
}

export function browserBench(thing: () => Promise<BenchResult>) {
    thing()
        .then((res) => {
            window.localStorage.clear();
            window.localStorage.setItem(`bench`, JSON.stringify(res));
            console.log(JSON.stringify(res));
            res.validate();
        })
        .catch(e => {
            console.log(e);
        })
}

if (typeof(window) !== 'undefined') {
    // browserBench(yogaPost);
    // browserBench(runSimple);
    // browserBench(runCNN);
    browserBench(ace);
}
