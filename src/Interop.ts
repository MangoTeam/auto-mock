// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'kiwi.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable } from "kiwi.js";

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


const examples: MockRect[] = [
    {
        "name": "p",
        "rect": [
            0, 0, 100, 100
        ],
        "children": [
            {
                "name": "a1",
                "rect": [10, 10, 45, 90],
                "children": [
                    {
                        "name": "b11",
                        "rect": [20, 20, 35, 45],
                        "children": []
                    },
                    {
                        "name": "b12",
                        "rect": [20, 55, 35, 80],
                        "children": []
                    }
                ]
            },
            {
                "name": "a2",
                "rect": [55, 10, 90, 90],
                "children": [
                    {
                        "name": "b21",
                        "rect": [65, 20, 80, 45],
                        "children": []
                    },
                    {
                        "name": "b22",
                        "rect": [65, 55, 80, 80],
                        "children": []
                    }
                ]
            }
        ]
    },
    {
        "name": "p",
        "rect": [0, 0, 200, 100],
        "children": [
            {
                "name": "a1",
                "rect": [10, 10, 45, 90],
                "children": [
                    {
                        "name": "b11",
                        "rect": [20, 20, 35, 45],
                        "children": []
                    },
                    {
                        "name": "b12",
                        "rect": [20, 55, 35, 80],
                        "children": []
                    }
                ]
            },
            {
                "name": "a2",
                "rect": [55, 10, 190, 90],
                "children": [
                    {
                        "name": "b21",
                        "rect": [65, 20, 180, 45],
                        "children": []
                    },
                    {
                        "name": "b22",
                        "rect": [65, 55, 180, 80],
                        "children": []
                    }
                ]
            }
        ]
    }
];

async function getByName(name: string, view: ILayoutViewTree.JSON): Promise<ILayoutViewTree.JSON> {
    if (view.name == name) {
        return Promise.resolve(view);
    }
    return Promise.race((view.children || []).map(c => getByName(name, c)));
}


// Given a set of training trees, and a set of testing trees, infer constraints
// from the training trees and use the constraints to evaluate the layout of the test trees.
// Return the calculated layouts.
export async function evalExamples(train: Tree[], test: Tree[], type?: MockdownClient.SynthType): Promise<Tree[]> {
    train.forEach(t => nameTree(t));
    test.forEach(t => nameTree(t));

    for (let tidx in test){
        if (!test[tidx].sameStructure(train[0])) {
            console.log('malformed train and test:')
            console.log(JSON.stringify(train))
            console.log(JSON.stringify(test))
        }
    }

    const mockExs = train.map(tree2Mock);

    const client = new MockdownClient({});

    const cjsons = await client.fetch(mockExs, type);
    // console.log(cjsons);

    const output = [];
    let iter = 0;
    for (let testRoot of test.map(tree2Mock)) {
        let solver = new LayoutSolver(LayoutViewTree.fromJSON(testRoot));
        let cparser = new ConstraintParser(solver.variableMap);

        for (const c of cjsons) {
            console.log(JSON.stringify(c));
            
            const cn = cparser.parse(c);
            // console.log(cn.toString());
            solver.addConstraint(cn);
        }

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

        solver.addEditVariable(rootLeft, kiwi.Strength.strong);
        solver.addEditVariable(rootTop, kiwi.Strength.strong);
        solver.addEditVariable(rootWidth, kiwi.Strength.strong);
        solver.addEditVariable(rootHeight, kiwi.Strength.strong);

        solver.suggestValue(rootLeft, testRoot.rect[0]);
        solver.suggestValue(rootTop, testRoot.rect[1]);
        solver.suggestValue(rootWidth, testRoot.rect[2] - testRoot.rect[0]);
        solver.suggestValue(rootHeight, testRoot.rect[3] - testRoot.rect[1]);

        solver.updateVariables();
        solver.updateView();
        output.push(mock2Tree(solver.root.json));
        iter++;
    }

    return output;
}
