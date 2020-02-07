import { smooth, flatten, mockify, Tree } from './Tree';

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

export async function runner(url: string, height: number, width: number, timeout: number): Promise<Tree> {

    return new Promise((resolve) => {
        // const foo = (e: any) => {resolve(new Tree('hello, world!', 0, 0, 0, 0));};
        let doc = window.open(url, "bench", `height=${height},width=${width}`)!;
        
        doc.onload = () => {
            doc.opener.postMessage('it', '*');
        }

        // doc.onload = foo;
        // doc.document.onload = foo;

        // console.log(doc.document.readyState);

        // if (doc.document.readyState === "complete") {
        //     let root = doc.document.body;
        //     let out = flatten(mockify(root));
        //     console.log('page is fully loaded');
        //     doc.close();
        //     resolve(out);
        //   }

        // doc.window.addEventListener('load', (event) => {
        //     console.log('page is fully loaded');
            
        //   });
        // doc.document.body.onload = () => {
        //     let root = doc.document.body;
        //     let out = flatten(mockify(root));
        //     doc.close();
        //     resolve(out)
        // };
        // if (doc.document.readyState === "complete") {
        //   let root = doc.document.body;
        //   let out = flatten(mockify(root));
        //   doc.close();
        //   resolve(out);
        // } else {
        //     console.log(doc.document.readyState);
        // }
        // TODO: get real onload working for the benchmark

        window.addEventListener('message', () => {
            let root = doc.document.body;
            let out = smooth(flatten(mockify(root)));
            // console.log(out);
            doc.close();
            resolve(out);
        }
        , false);
    });
}


async function runBenches(name: string, url: string, height: number, minw: number, maxw: number, seed: number, amount: number, timeout: number): Promise<Tree[]> {
    const output = [];

    const rand = new PcgRandom(seed);
    const upper = maxw - minw;

    // output.push(await runner(url, height, minw));
    // output.push(await runner(url, height, maxw));


    for (let i = 0; i < amount; ++i) {
        output.push(await runner(url, height, minw + rand.integer(upper), timeout));
    }    
    return output;
}

export class BenchResult {
    constructor(public name: string, public height: number, public bench: Bench, public train: Tree[], public test: Tree[]) {
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

export function browserBench(thing: () => Promise<BenchResult>) {
    thing()
        .then((res) => {
            window.localStorage.clear();
            window.localStorage.setItem(`bench`, JSON.stringify(res));
            console.log(JSON.stringify(res));
        })
        .catch(e => {
            console.log(e);
        })
}

if (typeof(window) !== 'undefined') {
    browserBench(yogaPost);
    // browserBench(runSimple);
    // browserBench(runCNN);
}
