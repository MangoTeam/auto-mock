import { smooth, flatten, mockify, Tree, nameTree, isVisible } from './Tree';

import pkg from 'pcg-random';
const { PcgRandom } = pkg;

export class Bounds {
    constructor(public low: number, public high: number){}

    static async fromJSON(json: any): Promise<Bounds> {
        if ('low' in json && 'high' in json && typeof json.low == 'number' && typeof json.high == 'number') {
            return Promise.resolve(new Bounds(json.low, json.high))
        } else {
            return Promise.reject(`can't parse JSON to bounds: ${JSON.stringify(json)}`)
        }
    }
}

export class Bench {

    constructor(
        public height: Bounds, 
        public width: Bounds, 
        public trainSeed: number, 
        public trainSize: number,
        public testSeed: number,
        public testSize: number
    ) {
    }

    static async fromJSON(json: any): Promise<Bench> {
        if ('width' in json && 'height' in json) {
            const [h, w] = [await Bounds.fromJSON(json.height), await Bounds.fromJSON(json.width)];
            return Promise.resolve(new Bench(h, w, json.trainSeed, json.trainSize, json.testSeed, json.testSize));
        }
        return Promise.reject('bad bench');
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
            
            // let out = smooth(flatten(mockify(root, root, opaqueClasses || [])));
            let out = flatten(mockify(root, root, opaqueClasses || []));
            // let out = mockify(root, root, opaqueClasses || []);
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

type BenchOpts = {
    "name": string,
    "url": string,
    "height": {
        "low": number,
        "high": number, 
    },
    "width": {
        "low": number,
        "high": number
    },
    "seed": number,
    "amount": number,
    "timeout": number,
    "rootid": string | undefined,
    "opaqueClasses": string[] | undefined
}


async function runBenches(opts: BenchOpts): Promise<Tree[]> {

    const {seed, amount, url, timeout, rootid, opaqueClasses} = opts;
    const [minw, maxw] = [opts.width.low, opts.width.high];
    const [minh, maxh] = [opts.height.low, opts.height.high];
    const output = [];

    const rand = new PcgRandom(seed);
    const upperw = maxw - minw;
    const upperh = maxh - minh;

    // output.push(await runner(url, height, minw));
    // output.push(await runner(url, height, maxw));


    for (let i = 0; i < amount; ++i) {
        const nexth = minh + rand.integer(upperh);
        const nextw = minw + rand.integer(upperw);

        if (nexth > maxh || nexth < minh) {
            console.log('bad height?!');
        }
        if (nextw > maxw || nextw < minw) {
            console.log('bad width?!');
        }
        output.push(await runner(url, nexth, nextw, timeout, rootid, opaqueClasses));
    }    
    return output;
}

export class BenchResult {
    constructor(public name: string, public bench: Bench, public train: Tree[], public test: Tree[]) {
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

        for (let tidx in this.train){
            let different = this.train[tidx].sameStructure(this.test[0]);
            if (different) {
                const [diffName, path] = different;
                console.log(`Validation error: malformed train and test at ${diffName}, ${path}, train ${tidx}`);
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
        const ret = new BenchResult(json.name, await bench, await Promise.all(trains), await Promise.all(tests));
        if (!ret.validate()) {
            return Promise.reject('malformed train/test');
        }
        return ret;
    }
}

// export async function runYoga() {

//     const opts: BenchOpts = {
//         "url" : "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html",
//         "name" : "yoga",
//         "height" : 
//     };
//     const height = 600;
//     const lo = 348;
//     const hi = 900;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 3000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);
//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

// export async function yogaPost() {
//     const url = "file:///Users/john/auto-mock/test/yoga/img.html";
//     const name = "yoga-img";
//     const height = 600;
//     const lo = 348;
//     const hi = 900;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 3000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);
//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

// export async function runCNN() {
//     const url = "https://www.cnn.com/";
//     const name = "cnn";
//     const height = 960;
//     const lo = 1350;
//     const hi = 1800;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 7000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);
//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

// export async function slack() {
//     const url = "https://app.slack.com/client/T0910C7LM/C090ZSPH6";
//     const name = "slack";
//     const height = 960;
//     const lo = 865;
//     const hi = 1200;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 10000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
//     // const root = "controls";
//     const root = undefined;

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root);
//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

// export async function personal() {
//     const url = "http://goto.ucsd.edu/~john/";
//     const name = "john-website";
//     const height = 1300;
//     const lo = 825;
//     const hi = 925;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 1000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);
//     // const root = 'yclinks';
//     // const opaqueClasses = ['itemlist'];
//     const opaqueClasses = undefined;
//     const root = undefined;

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout, root, opaqueClasses);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout, root, opaqueClasses);

//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout, root, opaqueClasses);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

// export async function adjacent() {
//     const url = "file:///Users/john/auto-mock/adjacent.html";
//     const name = "adjacent";
//     const height = 600;
//     const lo = 400;
//     const hi = 900;
//     const testSeed = 17250987;
//     const trainSeed = 235775;
//     const examples = 10;
//     const timeout = 1000;
//     const bench = new Bench(lo, hi, trainSeed, examples, testSeed, examples);

//     const testSet = await runBenches(name, url, height, lo, hi, testSeed, examples, timeout);
//     const trainSet = await runBenches(name, url, height, lo, hi, trainSeed, examples, timeout);

//     const [loT, hiT] = await runBounds(name, url, height, lo, hi, timeout);

//     return new BenchResult(name, height, bench, trainSet, testSet, loT, hiT);
// }

const simple: BenchOpts =  {
    "url" : "file:///Users/john/auto-mock/benchmark_html/synthetic/3-boxes.html",
    "name" : "3-boxes",
    "height" : {
        "low": 400,
        "high": 1200,
    },
    "width" : {
        "low" : 500,
        "high" : 1500,
    },
    "timeout" : 1000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined
};

const ace: BenchOpts =  {
    "url" : "http://192.168.0.139:8888/kitchen-sink.html",
    "name" : "ace",
    "height" : {
        "low": 200,
        "high": 2000,
    },
    "width" : {
        "low" : 600,
        "high" : 1200,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": 'controls',
    "opaqueClasses": ["ace_scroller", "ace_gutter", "ace_text-input", "toggleButton"]
};

const icse: BenchOpts =  {
    "url" : "file:///Users/john/auto-mock/benchmark_html/icse.html",
    "name" : "icse",
    "height" : {
        "low": 3000,
        "high": 3000,
    },
    "width" : {
        "low" : 800,
        "high" : 950,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": 'main',
    "opaqueClasses": undefined
};

const yoga: BenchOpts =  {
    "url" : "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html",
    "name" : "fwt-yoga",
    "height" : {
        "low": 500,
        "high": 1500,
    },
    "width" : {
        "low" : 450,
        "high" : 850,
    },
    "timeout" : 3000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined
};

const space: BenchOpts =  {
    "url" : "https://freewebsitetemplates.com/preview/space-science/index.html",
    "name" : "fwt-space",
    "height" : {
        "low": 500,
        "high": 1500,
    },
    "width" : {
        "low" : 975,
        "high" : 1280,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": ["navigation"]
};

const running: BenchOpts =  {
    "url" : "https://freewebsitetemplates.com/preview/running/about.html",
    "name" : "fwt-running",
    "height" : {
        "low": 2000,
        "high": 2000,
    },
    "width" : {
        "low" : 975,
        "high" : 1280,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined //["navigation"]
};

const personal: BenchOpts =  {
    "url" : "file:///Users/john/auto-mock/benchmark_html/john.html",
    "name" : "john",
    "height" : {
        "low": 2550,
        "high": 2600,
    },
    "width" : {
        "low" : 880,
        "high" : 985,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined
};

const freewebsitetemplates: BenchOpts =  {
    "url" : "file:///Users/john/auto-mock/benchmark_html/fwt.html",
    "name" : "fwt-4-3",
    "height" : {
        "low": 500,
        "high": 1500,
    },
    "width" : {
        "low" : 1020,
        "high" : 1280,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": "fwtTemplatesList",
    "opaqueClasses": undefined
};

const duckduckgo: BenchOpts =  {
    "url" : "https://duckduckgo.com/",
    "name" : "ddg",
    "height" : {
        "low": 2600,
        "high": 2601,
    },
    "width" : {
        "low" : 710,
        "high" : 870,
    },
    "timeout" : 5000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": ["nav-menu--slideout", 'logo-wrap--home'],
    // "skipIDs": ['footer_homepage']
};

const hackernews: BenchOpts = {
    "url" : "file:///Users/john/auto-mock/benchmark_html/hn-posts.html",
    "name" : "hackernews",
    "height" : {
        "low": 300,
        "high": 1500,
    },
    "width" : {
        "low" : 800,
        "high" : 1200,
    },
    "timeout" : 2000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined
}

const ieeexplore: BenchOpts = {
    "url" : "https://ieeexplore.ieee.org/Xplore/home.jsp",
    "name" : "ieee",
    "height" : {
        "low": 1000,
        "high": 1500,
    },
    "width" : {
        "low" : 1280,
        "high" : 1680,
    },
    "timeout" : 8000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": undefined
}

const overview: BenchOpts = {
    "url" : "/Users/john/auto-mock/benchmark_html/overview/index.html",
    "name" : "overview",
    "height" : {
        "low": 1500,
        "high": 1500,
    },
    "width" : {
        "low" : 1300,
        "high" : 1680,
    },
    "timeout" : 2000,
    "seed" : 0,
    "amount": 10,
    "rootid": undefined,
    "opaqueClasses": ["author-blurb"]
}

export async function browserBench(opts: BenchOpts, testSeed: number, trainSeed: number) {

    const bench = new Bench(opts.height, opts.width, trainSeed, opts.amount, testSeed, opts.amount);

    opts.seed = testSeed;
    const testSet = await runBenches(opts);
    opts.seed = trainSeed
    const trainSet = await runBenches(opts);

    return new BenchResult(opts.name, bench, trainSet, testSet);
}

if (typeof(window) !== 'undefined') {

    const testSeed  = 17250987;
    const trainSeed =  15;

    browserBench(overview, testSeed, trainSeed)
        .then((res: BenchResult) => {
            window.localStorage.clear();
            window.localStorage.setItem(`bench`, JSON.stringify(res));
            console.log(JSON.stringify(res));
            console.log(res.validate());
        })
        .catch((e: any) => {
            console.log(e);
        })
}
