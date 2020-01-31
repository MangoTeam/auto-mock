// import {ILayoutViewTree} from 'mockdown-client');
import { strict as assert } from 'assert';
import { nameTree, Tree } from './Tree';
import * as kiwi from 'flightlessbird.js';
import { ConstraintParser, ILayoutViewTree, LayoutSolver, LayoutViewTree, MockdownClient } from 'mockdown-client';
import { Variable } from "flightlessbird.js";
import { Layout } from 'vega';

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

// given a set of training trees and other options, infer constraints
export async function calcConstraints(train: Tree[], type: MockdownClient.SynthType, bounds: [number, number]) : Promise<ConstraintParser.IConstraintJSON[]> {
    train.forEach(t => nameTree(t));

    const mockExs = train.map(tree2Mock);

    const client = new MockdownClient({});

    const cjsons = await client.fetch(mockExs, bounds, type);
    
    return cjsons;
}

// given a set of constraints and testing trees, evaluate the layouts
export function evalExamples(cjsons: ConstraintParser.IConstraintJSON[], test: Tree[]): Tree[] {
    
    test.forEach(t => nameTree(t));

    let solver: LayoutSolver;
    let cparser: ConstraintParser;

    const output = [];

    for (let testRoot of test.map(tree2Mock)) {
        solver = new LayoutSolver(LayoutViewTree.fromJSON(testRoot));
        cparser = new ConstraintParser(solver.variableMap);

        // console.log('adding constraints')

        for (const c of cjsons) {
            const cn = cparser.parse(c, {strength: kiwi.Strength.medium});
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
    }

    return output;
}
