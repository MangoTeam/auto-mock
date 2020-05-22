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

export async function runner(url: string, height: number, width: number, timeout: number, rootid? : string, opaqueClasses?: string[]): Promise<Tree> {

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
            
            let out = flatten(mockify(root, opaqueClasses || []));
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

async function runBounds(name: string, url: string, height: number, minw: number, maxw: number, timeout: number, rootid? : string, opaqueClasses? : string[]): Promise<[Tree, Tree]> {
    const lo = await runner(url, height, minw, timeout, rootid, opaqueClasses);
    const hi = await runner(url, height, maxw, timeout, rootid, opaqueClasses);
    return [lo, hi];
}


async function runBenches(name: string, url: string, height: number, minw: number, maxw: number, seed: number, amount: number, timeout: number, rootid? : string, opaqueClasses? : string[]): Promise<Tree[]> {
    const output = [];

    const rand = new PcgRandom(seed);
    const upper = maxw - minw;

    // output.push(await runner(url, height, minw));
    // output.push(await runner(url, height, maxw));


    for (let i = 0; i < amount; ++i) {
        output.push(await runner(url, height, minw + rand.integer(upper), timeout, rootid, opaqueClasses));
    }    
    return output;
}

export class BenchResult {
    constructor(public name: string, public height: number, public bench: Bench, public train: Tree[], public test: Tree[], public low: Tree, public high: Tree) {
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

        if ('low' in json && 'high' in json) {
            const [lowT, highT] = [json.low, json.high].map(Tree.fromJSON)
            return new BenchResult(json.name, json.height, await bench, await Promise.all(trains), await Promise.all(tests), await(lowT), await(highT));
        } else {
            // throw new Error(`Missing low, high in benchmark json: ${JSON.stringify(Object.keys(json))}`)
            const trainTs: any = await Promise.all(trains);
            return new BenchResult(json.name, json.height, await bench, trainTs, await Promise.all(tests), trainTs[0], trainTs[1]);
        }
        
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
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
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
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
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
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function ace() {
    const url = "http://localhost:8888/kitchen-sink.html";
    const name = "ace-editor";
    const height = 960;
    const lo = 600;
    const hi = 1100;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 5000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
    // const root = "editor-container";
    const opaqueClasses = ["ace_scroller", "ace_gutter", "ace_text-input", "toggleButton"];
    const root = undefined;

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root, opaqueClasses);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root, opaqueClasses);
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root, opaqueClasses);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function slack() {
    const url = "https://app.slack.com/client/T0910C7LM/C090ZSPH6";
    const name = "slack";
    const height = 960;
    const lo = 865;
    const hi = 1200;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 10000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
    // const root = "controls";
    const root = undefined;

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root);
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function runSimple() {
    const url = "file:///Users/john/auto-mock/benchmark_html/synthetic/half-child.html";
    const name = "half-child";
    const height = 800;
    const lo = 450;
    const hi = 1000;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 1000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function duckDuckGo() {
    const url = "https://duckduckgo.com/";
    const name = "ddg";
    const height = 600;
    const lo = 710;
    const hi = 900;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 5000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);
    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function hackerNews() {
    const url = "file:///Users/john/auto-mock/benchmark_html/hn.html";
    const name = "hackernews-bottom-links";
    const height = 1300;
    const lo = 800;
    const hi = 1200;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 1000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
    // const root = 'yclinks';
    // const opaqueClasses = ['itemlist'];
    const opaqueClasses = undefined;
    const root = undefined;

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root, opaqueClasses);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root, opaqueClasses);

    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root, opaqueClasses);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
}

export async function personal() {
    const url = "http://goto.ucsd.edu/~john/";
    const name = "john-website";
    const height = 1300;
    const lo = 825;
    const hi = 925;
    const testSeed = 17250987;
    const trainSeed = 235775;
    const examples = 10;
    const timeout = 1000;
    const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
    // const root = 'yclinks';
    // const opaqueClasses = ['itemlist'];
    const opaqueClasses = undefined;
    const root = undefined;

    const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root, opaqueClasses);
    const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root, opaqueClasses);

    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root, opaqueClasses);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
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

    const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

    return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
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
    // browserBench(slack);
    // browserBench(ace);
    // browserBench(runSimple);
}
