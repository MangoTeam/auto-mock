import {Tree} from './Tree';
import {TreePainter} from './Color'

import {ConstraintParser, parseFraction} from 'mockdown-client'

export function formatHTML(t: Tree) : string {
  let painter = new TreePainter(t);
  const pref = `<html> <head> <meta http-equiv="Content-Type" content="text/html; charset=utf-8"> </head> <body> `
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

export function formatConstraint(c: ConstraintParser.IConstraintJSON) : string {
  let out: string;
  let [anum, adenom] = parseFraction(c.a || "1");
  if (c.x && c.x != 'None' && anum != 0) {
    if (c.b) {
      let [bnum, bdenom] = parseFraction(c.b || "0");
      if (bnum > 0) {
        if (anum == 1) {
          out =  ` ${c.y} ${c.op} ${c.x} + ${bnum}/${bdenom};`;
        } else {
          out =  ` ${c.y} ${c.op} ${anum}/${bdenom} * ${c.x} + ${bnum}/${bdenom};`;
        }
      } else {
        if (anum == 1) {
          out =  ` ${c.y} ${c.op} ${c.x} - ${Math.abs(bnum)}/${bdenom};`;
        } else {
          out =  ` ${c.y} ${c.op} ${anum}/${adenom} * ${c.x} - ${Math.abs(bnum)}/${bdenom};`;
        }
        
      }
    } else {
      if (anum == 1) {
        out =  ` ${c.y} ${c.op} ${c.x};`;
      } else {
        out =  ` ${c.y} ${c.op} ${anum}/${adenom} * ${c.x};`;
      }
      
    }
  } else {
    if (c.b) {
      let [bnum, bdenom] = parseFraction(c.b || "0");
      out =  ` ${c.y} ${c.op} ${bnum}/${bdenom};`
    } else {
      throw new Error('error: rhs of constraint is empty ' + c.toString());
    }
  }

    return out;
}

export function formatConstraints(cs: Set<ConstraintParser.IConstraintJSON>) : string {

  let outStr = "{ ";

  for (const c of cs) {
    outStr = outStr + '\n' + formatConstraint(c);
  }
  outStr = outStr + '}';
  return `<!-- ${outStr} -->`;
}