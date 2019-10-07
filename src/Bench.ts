import { flatten, mockify, Tree } from './Tree';

export class Bench {
    lo: number;
    hi: number;
    step: number;

    constructor(l: number, h: number, s: number) {
        this.lo = l;
        this.hi = h;
        this.step = s;
    }

    static async fromJSON(json: any): Promise<Bench> {
        return new Promise((ret, err) => {
            ret(new Bench(json.lo, json.hi, json.step));
        });
    }
}

export async function runner(url: string, height: number, width: number): Promise<Tree> {

    return new Promise((resolve) => {
        let doc = window.open(url, "bench", `height=${height},width=${width}`)!;
        // doc.document.onload = () => {
        // let root = doc.document.body;
        // let out = flatten(mockify(root));
        // doc.close();
        // resolve(out)
        // };
        // if (doc.document.readyState === "complete") {
        //   let root = doc.document.body;
        //   let out = flatten(mockify(root));
        //   doc.close();
        //   resolve(out);
        // }
        // TODO: get real onload working for the benchmark
        setTimeout(() => {
            let root = doc.document.body;
            let out = flatten(mockify(root));
            // console.log(out);
            doc.close();
            resolve(out);
        }, 1500);
    });
}


async function runBenches(name: string, url: string, height: number, b: Bench): Promise<Tree[]> {
    const output = [];
    for (let width = b.lo; width < b.hi; width += b.step) {
        output.push(await runner(url, height, width));
    }
    return output;
}

export class BenchResult {
    constructor(public name: string, public height: number, public bench: Bench, public output: Tree[]) {
    }

    static async fromJSON(json: any): Promise<BenchResult> {
        const bench = Bench.fromJSON(json.bench);
        const jtrees = json.output.map(Tree.fromJSON);
        const trees: Promise<Tree[]> = Promise.all(jtrees);
        return new BenchResult(json.name, json.height, await bench, await trees);
    }
}

export async function runYoga() {
    const url = "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html";
    const name = "yoga";
    const height = 600;
    const lo = 348;
    const hi = 915;
    const step = (hi - lo) / 10;
    const bench = new Bench(lo, hi, step);

    return runBenches(name, url, height, bench)
        .then((ts) => new BenchResult(name, height, bench, ts))
}

export async function runSanity() {
    const url = "file:///Users/john/auto-mock/example.html";
    const name = "sanity";
    const height = 600;
    const lo = 320;
    const hi = 1125;
    const step = (hi - lo) / 10;
    const bench = new Bench(lo, hi, step);

    return runBenches(name, url, height, bench)
        .then((ts) => new BenchResult(name, height, bench, ts))
}

function browserBench(thing: () => Promise<BenchResult>) {
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
    browserBench(runSanity);
}
