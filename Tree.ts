
import jQuery = require('jquery');

export class Tree {
  top: number;
  left: number;
  height: number;
  width: number;

  children: Tree[];

  name?: String;

  constructor (t: number, l: number, h: number, w: number, cs: Tree[]) {
    this.top = t; this.left = l; this.height = h; this.width = w; this.children = cs;
  }

  // assumes json has been parsed already
  public static async fromJSON(json: any) : Promise<Tree> {
    const fields = ['top', 'left', 'height', 'width'];
    return new Promise((ret, err) => {
      for (let fld of fields) {
        if (! (fld in json) || ! (typeof json[fld])) {
          err("json for tree missing field: " + fld + " json: " + json);
        }
        // TODO: check parseint of fields
      }
      // TODO: check children
      let childP: Promise<Tree>[] = json.children.map((c: any) => Tree.fromJSON(c));
      Promise.all(childP).then((cs: Tree[]) => {
        ret(new Tree(json.top, json.left, json.height, json.width, cs));
      });
    });
  }

  public copy() : Tree {
    let children = this.children.map(t => t.copy())
    let ret = new Tree(this.top, this.left, this.height, this.width, children);
    ret.name = this.name;
    return ret;
  }

  // assumes mapper is pure
  public fmap(mapper: (t: Tree) => Tree) : Tree {
    let ret = new Tree(this.top, this.left, this.height, this.width, []);
    ret = mapper(ret);
    ret.children = this.children.map(t => t.fmap(mapper));
    return ret;
  }

  public count() : number {
    let ret = 4;
    for (let child of this.children) {
      ret += child.count();
    }
    return ret;
  }

  public toString() : string {
    return `LT: ${this.left}, ${this.top},  WH: ${this.width}, ${this.height}`
  }

  public totalSquareDiff(other: Tree) : number {
    const str = `
      this: ${this.toString()}
      that: ${other.toString()}
    `;
    console.log(str);

    return (this.left - other.left) ** 2 
         + (this.top - other.top) ** 2 
         + (this.width - other.width) ** 2 
         + (this.height - other.height) ** 2;
  }

  // use a Promise to catch errors when other tree is of the wrong shape
  public async squaredErr(other: Tree) : Promise<number> {
    return new Promise( (ret, err) => {
      if (other.children.length != this.children.length) {
        err("bad shape of lhs, rhs in RMS calculation: " + this.toString() + " === " + other.toString());
      }
      let childResiduals = 0;
      for (let chld in other.children) {
        childResiduals += (this.children[chld].totalSquareDiff(other.children[chld]));
      }
      ret(this.totalSquareDiff(other) + childResiduals);
    });
  }

  public async rms(other: Tree) : Promise<number> {
    let err = await this.squaredErr(other);
    console.log(`err^2: ${err}, count: ${this.count()}, RMS: ${Math.sqrt(err/this.count())}`);
    return Math.sqrt(err/this.count());
  }
 }

// recursively clean-up nodes in which there is just a single child, that is completely contained in the parent.
//  A -> [B -> *] 
// with 
//  B -> *
export function flatten(me: Tree) : Tree {
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

export function nameTree(t: Tree, prefix: String = "box") {
  if (! t.name) {
    t.name = prefix;
  }

  for (let ci in t.children) {
    nameTree(t.children[ci], t.name + ci);
  }
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

export function mockify(me: Element) : Tree {
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
    out.name = me.id;
  }
  return out;
}


// draw a bunch of dotted red boxes onto the screen :)
export function visualize (me: Tree) {
  let newd = document.createElement('div');
  document.body.appendChild(newd);
  if (me.name) {
    newd.id = "orig-" + me.name;
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

function test() {
  let lhs = new Tree(0,0,0,0,[new Tree(0,0,0,0,[])]);
  // let rhs = new Tree(0,0,0,0,[]);
  let rhs = lhs.copy();
  rhs.left = 1;
  rhs.top = 1;

  lhs.rms(rhs)
    .then(rms => console.log("rms error: " + rms.toString()))
    .catch( e => console.log(e));
}
