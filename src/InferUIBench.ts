import { writeFileSync, readFileSync } from 'fs';
import { calcConstraints, evalExamples, mock2Tree } from './Interop';
import { MockdownClient, ConstraintParser } from 'mockdown-client';

import {computeBenchStats, computeSummaryStats, fmtCSVTimeout, fmtCSVOutput} from './NodeBench'

import { formatHTML, formatConstraints} from './Pretty';

import { Tree } from './Tree'

import * as yargs from 'yargs';

class IUIBench {
  constructor(public timeout: boolean, public id: number, public synthTime: number, public example: Tree, public constraints: ConstraintParser.IConstraintJSON[]) {
  }

  public static async fromJSON(o: any) : Promise<IUIBench> {
    // console.log('parsing:');
    // console.log(o);

    if ('example' in o && 'synthTime' in o && 'timeout' in o && 'id' in o) {
      const tree = mock2Tree(o.example);

      let constraints;
      if (o.timeout) {
        constraints = [];
      } else {
        if ('constraints' in o) { 
          constraints = o.constraints;
        } else {
          console.log(o);
          Promise.reject("constraints missing from nontimeout IUIBench");
        }
      }
      
      return Promise.resolve(new IUIBench(o.timeout, o.id, o.synthTime, tree, constraints))
    } else {
      console.log(o);
      return Promise.reject("couldn't parse json to IUIBench");
    }
  }

  public async runBench() {
    return await computeBenchStats(this.synthTime, this.constraints, [this.example]);
  }
}


export async function runIUI(benchPath: string, logPath: string) {

  const bjson = JSON.parse(readFileSync(benchPath).toString());
  const bench = await IUIBench.fromJSON(bjson);

  // console.log(bench)

  let csvRow  = "\n";
  if (bench.timeout) {
    
    csvRow += fmtCSVTimeout(computeSummaryStats(bench.constraints,[bench.example]), bench.id.toString() + ',');

  } else {
    const data = await bench.runBench();
    csvRow += fmtCSVOutput(data, bench.id.toString() + ',');
  }


  writeFileSync(logPath, csvRow, {flag: "a"});

}

export async function main() {
  const argv = yargs.default.options({
    'path': {
        describe: "InferUI bench result path",
        demandOption: true,
        type: 'string'
    }
  })
    .help()
    .argv

  const {path} = argv;

  return await runIUI(path, '/Users/john/auto-mock/tmp/results.csv');
}