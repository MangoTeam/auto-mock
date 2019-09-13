import {Tree, flatten, mockify} from './Tree';

export class Bench {
  lo: number;
  hi: number;
  step: number;

  constructor (l: number, h: number, s: number) {
    this.lo = l; this.hi = h; this.step = s;
  }
}

export async function runner(url: string, height: number, width: number) : Promise<Tree> {
  
  return new Promise((resolve) => {
    let doc = window.open(url, "bench", `height=${height},width=${width}`);
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
    setTimeout( () => {
      let root = doc.document.body;
      let out = flatten(mockify(root));
      // console.log(out);
      doc.close();
      resolve(out);
    }, 1500);
  });
}

async function runBenches(name: string, url: string, height: number, b: Bench): Promise <Tree[]> {
  const output = [];
  for (let width = b.lo; width < b.hi; width += b.step) {
    output.push(await runner(url, height, width));
  }
  return output;
}

class BenchResult {
  constructor(public name: string, public height: number, public bench: Bench, public output: Tree[]) {}
}

async function runYoga() {
  const url = "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html";
  const name = "yoga";
  const height = 600;
  const lo = 348; const hi = 915; const step = (hi - lo)/10;
  const bench = new Bench(lo, hi, step);

  return runBenches(name, url, height, bench)
    .then((ts) => new BenchResult(name, height, bench, ts))
}

// (async () => {
//   let yogaResult = await runYoga();
//   window.localStorage.clear();
//   window.localStorage.setItem(`bench`, JSON.stringify(yogaResult));
// })();

async function test() {
  const url = "https://freewebsitetemplates.com/preview/rehabilitation-yoga/blog.html";
  let prom = new Promise((res, rej) => {
    let win = window.open(url);
    win.document.addEventListener('load', () => {res()});
  });

}

runYoga()
  .then((yogaResult) => {
    window.localStorage.clear();
    window.localStorage.setItem(`bench`, JSON.stringify(yogaResult));
  })
  .catch(e => {
    console.log(e);
  })
