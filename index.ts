import jQuery = require('jquery');

class Tree {
  top: number;
  left: number;
  height: number;
  width: number;

  children: Tree[];

  sourceId?: String;

  constructor (t: number, l: number, h: number, w: number, cs: Tree[]) {
    this.top = t; this.left = l; this.height = h; this.width = w; this.children = cs;
  }
}

// recursively clean-up nodes in which there is just a single child, that is completely contained in the parent.
//  A -> [B -> *] 
// with 
//  B -> *
function flatten(me: Tree) : Tree {
  for (let ci in  me.children){
    me.children[ci] = flatten(me.children[ci]);
  }

  if (me.children.length === 1) {
    let [child] = me.children;
    if (me.top <= child.top && me.left <= child.left && me.height <= child.height && me.width <= child.width) {
      return child
    }
  }
  return me;
}


function isVisible(me: Element) : boolean {
  // TODO: some elements do not have this function in firefox?? debug.
  if (!me.getBoundingClientRect) {
    // console.log(me);
    return false;
  }
  let {height, width} = me.getBoundingClientRect();
  return width != 0 && height != 0;
}

function shouldTerminate(me: Element) : boolean {
  // exclude paragraphs, HRs, and headings
  const ts = [HTMLParagraphElement, HTMLHeadingElement, HTMLHRElement];
  for (let ty of ts) {
    if (me instanceof ty) {
      return true;
    }
  }

  return false;
}

function pad2num(s: String) : number {
  return parseInt(s.slice(0,-2))
}

function calculatePadding(me: Element) : {left: number, top: number} {
  let style = window.getComputedStyle(me);
  return {left: pad2num(style.paddingLeft), top: pad2num(style.paddingTop)};
}

function mockify(me: Element) : Tree {
  let {top, left} = me.getBoundingClientRect();
  let padding = calculatePadding(me);

  // adjust x-y coordinates for padding
  top = top + padding.top;
  left = left + padding.left;

  // use jquery to compute height/width independent of padding
  let height = $(me).height();
  let width = $(me).width();

  const kids: Tree[] = [];

  for (let ci in me.children){
    let child = me.children[ci];

    if (isVisible(child)) {
      if (shouldTerminate(child)) {
        continue;
      }
      // recurse on child and add to children
      kids.push(mockify(child));
    }
  }

  let out = new Tree(top, left, height, width, kids);
  // link the original ID to the tree's ID if present
  if (me.id) {
    out.sourceId = me.id;
  }
  return out;
}


// draw a bunch of dotted red boxes onto the screen :)
function visualize (me: Tree) {
  let newd = document.createElement('div');
  document.body.appendChild(newd);
  if (me.sourceId) {
    newd.id = "orig-" + me.sourceId;
  }
  newd.style.border = "thin dotted red";
  newd.style.position = 'absolute';
  newd.style.left = String(me.left) + "px";
  newd.style.top = String(me.top)+ "px";
  newd.style.height = String(me.height)+ "px";
  newd.style.width = String(me.width)+ "px";
  newd.style.zIndex = "1000";

  me.children.map(visualize);
}

// start the tree-building algorithm from the document's body
let root = document.body;
let out = flatten(mockify(root));
visualize(out);