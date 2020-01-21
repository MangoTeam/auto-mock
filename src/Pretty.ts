import {Tree} from './Tree';
import {TreePainter} from './Color'

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