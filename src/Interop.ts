// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable, Constraint, Operator, Strength } from "flightlessbird.js";

import * as perf from 'perf_hooks';

import {reset, prepTimes, resizeTimes, setSynthTime, synthTimeout} from './Benchmarking'

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
export async function calcConstraints(train: Tree[], type: MockdownClient.SynthType, bounds: {"height": IBound, "width": IBound}, unambig: boolean) : Promise<ConstraintParser.IConstraintJSON[]> {
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
    // console.log(`starting with start time ${startTime}`);
    return client.fetch(mockExs, bounds, unambig, type, synthTimeout)
        .then((o) => { 
            const doneTime = performance.now();
            setSynthTime(doneTime - startTime); 
            // console.log(`done with done time ${doneTime}`);
            return [...o.constraints, ...o.constraints];
        });
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
        prepTimes.push(list.getEntries()[0].duration);
        me.disconnect();
    });
    const resizeObs = new perf.PerformanceObserver((list, me) => {
        resizeTimes.push(list.getEntries()[0].duration);
        me.disconnect();
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

        const foo = performance.timerify(addWork);
        prepObs.observe({ entryTypes: ['function'] });
        foo();

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

        const bar = performance.timerify(resizeWork);
        resizeObs.observe({ entryTypes: ['function'] });
        bar();

        solver.updateView();
        output.push(mock2Tree(solver.root.pojo));
    }
    
    return output;
}
