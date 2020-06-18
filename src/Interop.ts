// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable, Constraint, Operator, Strength } from "flightlessbird.js";

import * as perf from 'perf_hooks';
import { array } from 'vega';
import { Bench } from './Bench';

type MockRect = ILayoutViewTree.POJO;
type IBound = MockdownClient.IBound


// assumes nameTree has been called already
export function tree2Mock(t: Tree): MockRect {
    assert(t.width >= 0 && t.height >= 0, "tree dimensions should be positive");
    return {
        name: t.name ? t.name.toString() : "untitled",
        rect: [t.left, t.top, t.left + t.width, t.top + t.height],
        children: t.children.map(tree2Mock)
    }
}

function mock2Tree(mr: MockRect): Tree {
    let [left, top, right, bottom] = mr.rect;
    let children = (mr.children || []).map(mock2Tree);
    let root = new Tree(mr.name, top, left, bottom - top, right - left, children);
    return root;
}

// given a set of training trees and other options, infer constraints
export async function calcConstraints(train: Tree[], type: MockdownClient.SynthType, bounds: {"height": IBound, "width": IBound}) : Promise<ConstraintParser.IConstraintJSON[]> {
    // console.log('before names: ')
    // console.log(train.map(t => t.names()));
    train.forEach(t => nameTree(t));

    // console.log('after names: ')
    // console.log(train.map(t => t.names()));

    const mockExs = train.map(tree2Mock);

    const client = new MockdownClient({});

    const cjsons = await client.fetch(mockExs, bounds, type);
    
    return cjsons;
}

export namespace Benchmarking {
    export let prepTimes: number[] = [];
    export let resizeTimes: number[] = [];
    export function reset() {
        Benchmarking.prepTimes = [];
        Benchmarking.resizeTimes = [];
    }
}

// given a set of constraints and testing trees, evaluate the layouts
export function evalExamples(cjsons: ConstraintParser.IConstraintJSON[], test: Tree[]): Tree[] {
    
    // const [lowerW, upperW] = widthBounds
    
    let solver: LayoutSolver;
    let cparser: ConstraintParser;

    const output = [];
    const testMocks = test.map(tree2Mock);

    const performance = perf.performance;

    const prepObs = new perf.PerformanceObserver((list, me) => {
        // console.log(list.getEntries()[0]);
        Benchmarking.prepTimes.push(list.getEntries()[0].duration);
        me.disconnect();
        // console.log('measuring');
        // console.log(list.getEntries());
    });
    const resizeObs = new perf.PerformanceObserver((list, me) => {
        Benchmarking.resizeTimes.push(list.getEntries()[0].duration);
        me.disconnect();
        // console.log('measuring');
        // console.log(list.getEntries());
    });

    

    for (let tri in testMocks) {
        const testRoot = testMocks[tri];
        const testWidth = testRoot.rect[2] - testRoot.rect[0];
        solver = new LayoutSolver(LayoutViewTree.fromPOJO(testRoot));
        cparser = new ConstraintParser(solver.variableMap);

        console.log(`adding constraints for test ${tri}`);
        // console.log(JSON.stringify(cjsons));
        // performance.mark('prepStart-' + tri);

        const addWork = () => {
            for (const c of cjsons) {
                // console.log(`parsing ${JSON.stringify(c)}`)
                const strength = eval(c.strength as any);
                // console.log(`adding strength: ${strength}`);
                const cn = cparser.parse(c, {strength: strength});
                // console.log(`parsed, adding ${cn.toString()}`);
                solver.addConstraint(cn);
                // console.log(`added`);
            }
        }

        

        // console.log('before prep');
        const foo = performance.timerify(addWork);
        prepObs.observe({ entryTypes: ['function'] });
        foo();
        // console.log('after prep');
        

        // console.log('added, suggesting values');

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

        
        
        

        // performance.mark('resize-end-' + tri);

        // performance.measure('resize-time-' + tri, 'resize-end-' + tri, 'resize-start-' + tri);

        // Benchmarking.arr = Benchmarking.prepTimes;

        // obs.observe({ entryTypes: ['measure'], buffered: true });

        // console.log('before resize');
        const bar = performance.timerify(resizeWork);
        resizeObs.observe({ entryTypes: ['function'] });
        bar();
        // console.log('after resize');

        solver.updateView();
        output.push(mock2Tree(solver.root.pojo));
    }

    const avg = (x: number[]) => {
        return x.reduce((a, b) => a + b) / (x.length * 1000.0)
    }

    console.log('times:')
    console.log(Benchmarking.prepTimes);
    console.log(Benchmarking.resizeTimes);
    console.log(`average prep, resize (in seconds): ${avg(Benchmarking.prepTimes)}, ${avg(Benchmarking.resizeTimes)}`);
    Benchmarking.reset();

    return output;
}
