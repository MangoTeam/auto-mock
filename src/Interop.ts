// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable, Constraint } from "flightlessbird.js";
import { Layout, Operator } from 'vega';

type MockRect = ILayoutViewTree.JSON;


// assumes nameTree has been called already
function tree2Mock(t: Tree): MockRect {
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

async function getByName(name: string, view: ILayoutViewTree.JSON): Promise<ILayoutViewTree.JSON> {
    if (view.name == name) {
        return Promise.resolve(view);
    }
    return Promise.race((view.children || []).map(c => getByName(name, c)));
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
    
    // console.log('before names: ')
    // console.log(test.map(t => t.names()));
    // test.forEach(t => nameTree(t));
    // console.log('after names: ')
    // console.log(test.map(t => t.names()));

    let solver: LayoutSolver;
    let cparser: ConstraintParser;

    const output = [];

    for (let testRoot of test.map(tree2Mock)) {
        solver = new LayoutSolver(LayoutViewTree.fromJSON(testRoot));
        cparser = new ConstraintParser(solver.variableMap);

        console.log('adding constraints');
        // console.log(JSON.stringify(cjsons));

        for (const c of cjsons) {
            // console.log(`parsing ${JSON.stringify(c)}`)
            const cn = cparser.parse(c, {strength: kiwi.Strength.medium});
            // console.log(`parsed, adding ${cn.toString()}`);
            solver.addConstraint(cn);
            // console.log(`added`);
        }

        console.log('added, suggesting values');

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

        // console.log(`suggesting test values: ${testRoot.rect}`);

        solver.addEditVariable(rootLeft, kiwi.Strength.strong);
        solver.addEditVariable(rootTop, kiwi.Strength.strong);
        solver.addEditVariable(rootWidth, kiwi.Strength.strong);
        solver.addEditVariable(rootHeight, kiwi.Strength.strong);

        solver.suggestValue(rootLeft, testRoot.rect[0]);
        solver.suggestValue(rootTop, testRoot.rect[1]);
        solver.suggestValue(rootWidth, testRoot.rect[2]-testRoot.rect[0]);
        solver.suggestValue(rootHeight, testRoot.rect[3]-testRoot.rect[1]);
        
        solver.updateVariables();
        solver.updateView();
        output.push(mock2Tree(solver.root.json));
    }

    return output;
}
