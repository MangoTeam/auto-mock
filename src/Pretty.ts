import {Tree} from './Tree';
import {TreePainter} from './Color'

import {ConstraintParser} from 'mockdown-client'

export function formatHTML(t: Tree) : string {
  let painter = new TreePainter(t);
  const pref = `<html> <head></head> <body> `
  return pref + makeBody(t, 0, painter) + '</body> </html>';
}

function makeStyle(t: Tree, depth: number, colors: TreePainter) : string {
  const pos = `position:absolute; left:${t.left}px; width:${t.width}px; height:${t.height}px; top:${t.top}px; `;
  const color = ` background-color:${colors.getColor(depth)}; `;
  return pos + color + `z-index:${depth};`;
}

function makeBody(t: Tree, depth: number, colors: TreePainter) : string {
  let pref = `<div id=${t.name} style='${makeStyle(t, depth, colors)}'> </div>`
  let body = ' ';
  for (let child of t.children) {
    body = body + makeBody(child, depth+1, colors) + ' ';
  }
  return pref + body;
}

export function formatConstraints(cs: Set<ConstraintParser.IConstraintJSON>) : string {

  // console.log('printing:', cs);
  let outStr = "{ ";

  for (let c of cs) {

    // console.log(`${c.x}, ${c.x != 'None'}`)

    // I want to write c.a ?? 0 but it turns out node 13.7 does not support the '??' operator
    // (nullish coalescing operator)
    let a = Number.parseFloat(c.a || "0");
    if (c.x && c.x != 'None' && a != 0) {
      if (c.b) {
        let b = Number.parseFloat(c.b);
        if (b > 0) {
          if (a == 1) {
            outStr = outStr + ` ${c.y} ${c.op} ${c.x} + ${Math.abs(b)};`;
          } else {
            outStr = outStr + ` ${c.y} ${c.op} ${a} * ${c.x} + ${b};`;
          }
        } else {
          if (a == 1) {
            outStr = outStr + ` ${c.y} ${c.op} ${c.x} - ${Math.abs(b)};`;
          } else {
            outStr = outStr + ` ${c.y} ${c.op} ${a} * ${c.x} - ${Math.abs(b)};`;
          }
          
        }
      } else {
        if (a == 1) {
          outStr = outStr + ` ${c.y} ${c.op} ${c.x};`;
        } else {
          outStr = outStr + ` ${c.y} ${c.op} ${a} * ${c.x};`;
        }
        
      }
    } else {
      if (c.b) {
        outStr = outStr + ` ${c.y} ${c.op} ${Number.parseFloat(c.b)};`
      } else {
        throw new Error('error: rhs of constraint is empty ' + c.toString());
      }
      
    }
  }

  outStr = outStr + '}';


  
  

  return `<!-- ${outStr} -->`;



}