// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable, Constraint, Operator, Strength } from "flightlessbird.js";

type MockRect = ILayoutViewTree.POJO;


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
export async function calcConstraints(train: Tree[], type: MockdownClient.SynthType, bounds: [number, number]) : Promise<ConstraintParser.IConstraintJSON[]> {
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

// given a set of constraints and testing trees, evaluate the layouts
export function evalExamples(cjsons: ConstraintParser.IConstraintJSON[], test: Tree[]): Tree[] {
    
    // const [lowerW, upperW] = widthBounds
    
    let solver: LayoutSolver;
    let cparser: ConstraintParser;

    const output = [];
    const testMocks = test.map(tree2Mock);

    for (let tri in testMocks) {
        const testRoot = testMocks[tri];
        const testWidth = testRoot.rect[2] - testRoot.rect[0];
        solver = new LayoutSolver(LayoutViewTree.fromPOJO(testRoot));
        cparser = new ConstraintParser(solver.variableMap);

        console.log(`adding constraints for test ${tri}`);
        // console.log(JSON.stringify(cjsons));

        for (const c of cjsons) {
            // console.log(`parsing ${JSON.stringify(c)}`)
            // const strength = (lowerW <= testWidth && testWidth <= upperW) ? kiwi.Strength.required : kiwi.Strength.strong;
            const strength = kiwi.Strength.required;
            const cn = cparser.parse(c, {strength: strength});
            // console.log(`parsed, adding ${cn.toString()}`);
            solver.addConstraint(cn);
            // console.log(`added`);
        }

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

        solver.addConstraint(new Constraint(rootLeft, Operator.Eq, left, kiwi.Strength.strong));
        solver.addConstraint(new Constraint(rootTop, Operator.Eq, top, kiwi.Strength.strong));
        solver.addConstraint(new Constraint(rootWidth, Operator.Eq, right - left, kiwi.Strength.strong));
        solver.addConstraint(new Constraint(rootHeight, Operator.Eq, bottom - top, kiwi.Strength.strong));
        
        solver.updateVariables();
        solver.updateView();
        output.push(mock2Tree(solver.root.pojo));
    }

    return output;
}
