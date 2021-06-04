// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient, FetchOpts } from 'mockdown-client';
import { Variable, Constraint, Operator, Strength } from "flightlessbird.js";

import * as perf from 'perf_hooks';

import {reset, prepTimes, resizeTimes, setSynthTime, synthTimeout} from './Benchmarking'

type MockRect = ILayoutViewTree.POJO;
type IBound = MockdownClient.IBound

import {exec, spawnSync, execFileSync} from 'child_process'
import { writeFileSync, readFileSync } from 'fs';


function timeit(f: () => void ) : number {

    const now = process.hrtime.bigint();
    f();
    const after = process.hrtime.bigint();

    // hrtime is in nanoseconds, so divide by 1000000000 to get seconds
    return Number(after-now)/1000000000;

}


// assumes nameTree has been called already
export function tree2Mock(t: Tree): MockRect {
    assert(t.width >= 0 && t.height >= 0, "tree dimensions should be positive");
    return {
        name: t.name ? t.name.toString() : "untitled",
        rect: [t.left, t.top, t.left + t.width, t.top + t.height],
        children: t.children.map(tree2Mock)
    }
}

export function mock2Tree(mr: MockRect): Tree {
    let [left, top, right, bottom] = mr.rect;
    let children = (mr.children || []).map(mock2Tree);
    let root = new Tree(mr.name, top, left, bottom - top, right - left, children);
    return root;
}

export function cliMock(examples: ILayoutViewTree.POJO[], config: FetchOpts, globalType: MockdownClient.SynthType, timeout: number, noise: number, useSBP: boolean) {
    
    const mockPiploc = "../mockdown/Pipfile";
    const env = {
        "PIPENV_PIPFILE" : mockPiploc
    }

    const input = 'tmp.json';
    const output = 'response.json';
    writeFileSync(input, JSON.stringify({"examples" : examples}));

    // console.log('height:');
    // console.log(config.height);
    // throw new Error('bar');

    const [hlo, hhi] = [JSON.stringify(config.height.lower), JSON.stringify(config.height.upper)]
    const [wlo, whi] = [JSON.stringify(config.width.lower), JSON.stringify(config.width.upper)]

    const loglevel = 'LOGLEVEL=INFO '
    const pipcmd = 'timeout ' + timeout.toString() + ' pipenv run -- ';
    const mockcmd = 'mockdown run ';
    // console.log("learning method: " + config.learningMethod);
    const opts = ['-pb', wlo, hlo, whi, hhi, '-pm', globalType, '--learning-method', config.learningMethod, '-dn', noise.toString()];
    if (useSBP) {
        // opts.push('--use-sbp');
    } else {
        opts.push('--no-sbp');
    }
    const cmd = loglevel + pipcmd + mockcmd + opts.join(' ') + ` ${input} ${output}`;

    const shebang = '#!/bin/sh'
    const exprt = `export PIPENV_PIPFILE=${mockPiploc}`

    const benchContents = [shebang, '', exprt, cmd].join('\n')

    writeFileSync('./bench_bench.sh', benchContents);

    const execOut = execFileSync('./bench_bench.sh');

    // console.log(execOut.toString());
    const result = JSON.parse(readFileSync(output).toString());
    return [...result.constraints, ...result.axioms];
    // console.log(execOut.stderr.toString());


    // exec(cmd, execOpts, (err, stdo, stde) => {
    //     if (err) {
    //         console.log('encountered error in mockdown cli');
    //         console.log(err);
    //         throw new Error();
    //     } else {
    //         console.log('cli response');
    //         console.log(stdo);
    //         console.log('error')
    //         console.log(stde);
    //         throw new Error('ok');
    //     }
    // });
}

// given a set of training trees and other options, infer constraints
export async function calcConstraints(train: Tree[], type: MockdownClient.SynthType, bounds: {"height": IBound, "width": IBound}, unambig: boolean, learningMethod: "simple" | "ntnone" | "noisetolerant", useSBP: boolean, noise: number = 0.0) : Promise<ConstraintParser.IConstraintJSON[]> {
    // console.log('before names: ')
    // console.log(train.map(t => t.names()));
    reset();

    train.forEach(t => nameTree(t));

    // console.log('after names: ')
    // console.log(train.map(t => t.names()));

    const mockExs = train.map(tree2Mock);

    const client = new MockdownClient({});

    const performance = perf.performance;

    const startTime = performance.now();

    let newLearning : "heuristic" | "noisetolerant" | "simple";
    if (learningMethod == "ntnone")
        newLearning = "heuristic";
    else
        newLearning = learningMethod;

    const config: FetchOpts = {
        height: bounds.height,
        width: bounds.width,
        learningMethod: newLearning
    }

    const useCLI = true;
    // console.log(`starting with start time ${startTime}`);
    if (useCLI) {
        let result = cliMock(mockExs, config, type, synthTimeout, noise, useSBP) as any;
        const doneTime = performance.now();
        setSynthTime(doneTime - startTime); 
        return result;
    } else {
        return client.fetch(mockExs, config, unambig, type, synthTimeout)
        .then((o) => { 
            const doneTime = performance.now();
            setSynthTime(doneTime - startTime); 
            // console.log(`done with done time ${doneTime}`);
            return [...o.constraints, ...o.axioms];
        });
    }
    
}

// given a set of constraints and testing trees, evaluate the layouts
export function evalExamples(cjsons: ConstraintParser.IConstraintJSON[], test: Tree[]): Tree[] {

    reset();
    
    let solver: LayoutSolver;
    let cparser: ConstraintParser;

    const output = [];
    const testMocks = test.map(tree2Mock);

    const performance = perf.performance;

    const prepObs = new perf.PerformanceObserver((list, me) => {
        console.log('adding prep time')
        console.log(list.getEntries()[0].duration);
        prepTimes.push(list.getEntries()[0].duration);
        // me.disconnect();
    });
    const resizeObs = new perf.PerformanceObserver((list, me) => {
        console.log('adding resize time')
        resizeTimes.push(list.getEntries()[0].duration);
        // me.disconnect();
    });

    
    for (let tri in testMocks) {
        const testRoot = testMocks[tri];
        solver = new LayoutSolver(LayoutViewTree.fromPOJO(testRoot));
        cparser = new ConstraintParser(solver.variableMap);

        const addWork = () => {
            for (const c of cjsons) {
                const strength = eval(c.strength as any);
                const cn = cparser.parse(c, {strength: strength});
                solver.addConstraint(cn);
            }
        }

        // const foo = performance.timerify(addWork);
        // prepObs.observe( { 
        //     entryTypes: ['function'], 
        //     buffered : true
        // });

        // performance.mark('prep-start');
        // foo();
        // performance.mark('prep-end');
        // performance.measure('prep-time', 'prep-start', 'prep-end');

        // prepObs.disconnect();

        const prepTime = timeit(addWork);
        prepTimes.push(prepTime);

        

        const rootName = solver.root.name;

        const [
            rootLeft,
            rootTop,
            rootWidth,
            rootHeight
        ] = solver.getVariables( 
            `${rootName}.left`,
            `${rootName}.top`,
            `${rootName}.width`,
            `${rootName}.height`
        ) as Array<Variable>;

        const [left, top, right, bottom] = testRoot.rect.map(Math.round);

        
        const resizeWork = () => {
            solver.addConstraint(new Constraint(rootLeft, Operator.Eq, left, kiwi.Strength.required));
            solver.addConstraint(new Constraint(rootTop, Operator.Eq, top, kiwi.Strength.required));
            solver.addConstraint(new Constraint(rootWidth, Operator.Eq, right - left, kiwi.Strength.required));
            solver.addConstraint(new Constraint(rootHeight, Operator.Eq, bottom - top, kiwi.Strength.required));
            solver.updateVariables();
        }

        // const bar = performance.timerify(resizeWork);
        // resizeObs.observe({ entryTypes: ['function'] });
        // bar();
        // resizeObs.disconnect();
        const resizeTime = timeit(resizeWork);
        resizeTimes.push(resizeTime);

        solver.updateView();
        output.push(mock2Tree(solver.root.pojo));

    }
    
    return output;
}
