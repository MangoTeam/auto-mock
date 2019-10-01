import request = require('request-promise-native');
import {strict as assert} from 'assert';
import {Tree, nameTree} from './Tree';
import * as kiwi from 'kiwi.js';

import mock = require('mockdown-client');
import { fetchConstraints, LayoutSolver, LayoutView, ConstraintParser, ILayoutView } from 'mockdown-client';

type MockRect = mock.ILayoutView.JSON;


// assumes nameTree has been called already
function tree2Mock(t: Tree) : MockRect {
  assert (t.width >= 0 && t.height >= 0, "tree dimensions should be positive");
  return {
    name: t.name.toString(),
    rect: [t.left, t.top, t.left + t.width, t.top + t.height],
    children: t.children.map(tree2Mock)
  }
}

function mock2Tree(mr: MockRect) : Tree {
  let [left, top, right, bottom] = mr.rect;
  let children = mr.children.map(mock2Tree);
  let root = new Tree(top, left, bottom - top, right - left, children);
  root.name = mr.name;
  return root;
}


const examples : MockRect[] = [
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
            "rect": [65, 55,80,80],
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

async function getByName(name: string, view: ILayoutView.JSON) : Promise<ILayoutView.JSON> {
  if (view.name == name) {
    return Promise.resolve(view);
  }
  return Promise.race(view.children.map(c => getByName(name, c)));
}

const DEBUG=true;

export async function evalExamples(ex: Tree[]) : Promise <Tree[]> {
  ex.forEach(t => nameTree(t));
  const mockExs = ex.map(tree2Mock);
  // console.log(JSON.stringify(mockExs[0].children));

  // console.log(JSON.stringify(mockExs[0].children[5]));

  let focus : (t: MockRect) => MockRect;
  if (DEBUG) {
    focus = (mr) => {
      return mr.children[2];
    }
  } else {
    focus = 
      x => x;
  }

  // console.log(JSON.stringify(mockExs.map(focus)));

  const cjsons = await fetchConstraints(mockExs.map(focus));
  console.log(cjsons);
  // console.log(cjsons);

  const output = [];
  let iter = 0;
  for (let exRoot of mockExs) {
    // console.log(iter);
    let solver = new LayoutSolver(new LayoutView(exRoot));
    let cparser = new ConstraintParser(solver.variableMap);
    // debugger;

    const rootName = solver.root.name;

    const rootWidth = solver.getVariable(`${rootName}.width`)!;
    solver.addEditVariable(rootWidth, kiwi.Strength.strong);

    const rootHeight = solver.getVariable(`${rootName}.height`)!;
    solver.addEditVariable(rootHeight, kiwi.Strength.strong);

    for (const c of cjsons) {
      const cn = cparser.parse(c);
      console.log(cn.toString());
      solver.addConstraint(cparser.parse(c));
    }

    solver.suggestValue(rootWidth, exRoot.rect[2] - exRoot.rect[0]);
    solver.suggestValue(rootHeight, exRoot.rect[3] - exRoot.rect[1]);

    solver.updateVariables();
    solver.updateView();
    // solver.addConstraint(cparser.parse())
    output.push(mock2Tree(solver.root.json));
    iter++;
  }

  return output;
}
