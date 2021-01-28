import {union} from './Set'
import { main } from './NodeBench';

export class Tree {
    top: number;
    left: number;
    height: number;
    width: number;

    get right() { return this.left + this.width; }
    get bottom() { return this.top + this.height; }

    get size(): number {return 1 + this.children.map((x: Tree) => x.size).reduce((x, y) => x + y, 0.0)}

    children: Tree[];

    name: string | undefined;

    constructor(name: string | undefined, t: number, l: number, h: number, w: number, cs?: Tree[]) {
        this.name = name;
        this.top = t;
        this.left = l;
        this.height = h;
        this.width = w;
        this.children = cs || [];
    }

    // assumes json has been parsed already
    public static async fromJSON(json: any): Promise<Tree> {
        const fields = ['top', 'left', 'height', 'width'];
 
        for (let fld of fields) {
            if (!(fld in json) || !(typeof json[fld])) {
                console.log(json);
                return Promise.reject("json for tree missing field: " + fld + " json: " + json.toString());
            }
            // TODO: check parseint of fields
        }
        // TODO: check children
        let childP: Promise<Tree>[] = json.children.map((c: any) => Tree.fromJSON(c));
        let cs = await Promise.all(childP);

        return Promise.resolve(new Tree(json.name, json.top, json.left, json.height, json.width, cs));
    }

    public names(): Set<string> {
        let out = new Set<string>();
        if (this.name) out.add(this.name);

        for (let child of this.children) {
            out = union(out, child.names());
        }
        return out;
    }

    public copy(): Tree {
        let children = this.children.map(t => t.copy())
        let ret = new Tree(undefined, this.top, this.left, this.height, this.width, children);
        ret.name = this.name;
        return ret;
    }

    public shallow() : Tree {
        return new Tree(this.name, this.top, this.left, this.height, this.width, []);
    }

    public count(): number {
        return this.map((_) => 4).reduce((x, y) => x + y, 0);
    }

    public map<T>(f: (x: Tree) => T) : T[] {
        const loc = f(this);
        let ret = [loc];
        for (const child of this.children) {
            ret = ret.concat(child.map(f))
        }   
        return ret
    }

    // count up all elements that are at the same position in this and rhs
    public identicalPlaced(other: Tree) : number {
        let loc = 0;
        const eq = (x: number, y: number) => Math.abs(x - y) < 1
        if (eq(this.top, other.top) && eq(this.bottom, other.bottom) && eq(this.right, other.right) && eq(this.left, other.left)) {
            loc = 1;
        }
        for (const cidx in this.children) {
            loc += this.children[cidx].identicalPlaced(other.children[cidx]);
        }
        return loc
    }

    public accuracy(other: Tree) : number {
        return this.identicalPlaced(other) / this.size
    }

    public toString(): string {
        return `LT: ${this.left}, ${this.top},  WH: ${this.width}, ${this.height}`
    }

    public totalSquareDiff(that: Tree): number {
        // const str = `
        //     name: ${this.name} (${that.name})
        //         this.L: ${this.left}
        //         that.L: ${that.left}
        //         this.T: ${this.top}
        //         that.T: ${that.top}
        //         this.R: ${this.right}
        //         that.R: ${that.right}
        //         this.B: ${this.bottom}
        //         that.B: ${that.bottom}
        //         this.W: ${this.width}
        //         that.W: ${that.width}
        //         this.H: ${this.height}
        //         that.H: ${that.height}
        // `;
        // console.log(str);

        return (this.left - that.left) ** 2
            + (this.top - that.top) ** 2
            + (this.width - that.width) ** 2
            + (this.height - that.height) ** 2;
    }

    public absdiff(that: Tree) : number {
        return Math.abs(this.left - that.left)
            + Math.abs(this.top - that.top)
            + Math.abs(this.width - that.width)
            + Math.abs(this.height - that.height);
    }

    // use a Promise to catch errors when other tree is of the wrong shape
    public async squaredErr(other: Tree): Promise<number> {
        
        if (other.children.length != this.children.length) {
            return Promise.reject("bad shape of lhs, rhs in RMS calculation: " + this.toString() + " === " + other.toString());
        }
        let childResiduals = 0;
        for (let chld in other.children) {
            childResiduals += await this.children[chld].squaredErr(other.children[chld]);
        }
        
        return this.totalSquareDiff(other) + childResiduals;
    }

    public async rms(other: Tree): Promise<number> {
        let err = await this.squaredErr(other);
        let [myMin, myMax] = this.rangeVals();
        let [oMin, oMax] = other.rangeVals();
        let [tMin, tMax] = [Math.min(myMin, oMin), Math.max(myMax, oMax)];

        let range = 1;
        if (tMin != tMax) {
            range = tMax - tMin;
        }
        // console.log(`err^2: ${err}, count: ${this.count()}, RMS: ${Math.sqrt(err / this.count())}`);
        // return 100*Math.sqrt(err / this.count()) / range;
        return Math.sqrt(err/this.count());
    }

    public rangeVals() : [number, number] {
        let dims = [this.left, this.top, this.width, this.height];
        let [myMin, myMax] = [Math.min(...dims), Math.max(...dims)];

        for (let child of this.children) {
            let [cMin, cMax] = child.rangeVals();
            [myMin, myMax] = [Math.min(cMin, myMin), Math.max(cMax, myMax)];
        }

        return [myMin, myMax];
    }

    public async pixDiff(other: Tree) : Promise<number> {
        if (other.children.length != this.children.length) {
            return Promise.reject("bad shape of lhs, rhs in pixel difference calculation: " + this.toString() + " === " + other.toString());
        }
        let childDiffs = 0;
        for (let cidx in other.children) {
            childDiffs += await this.children[cidx].pixDiff(other.children[cidx])
        }

        return childDiffs + this.absdiff(other)
    }

    public sameStructure(other: Tree, prefix: string = "") : [string, string] | undefined {
        if (other.name != this.name || other.children.length != this.children.length) {
            return [this.name!, prefix];
        } else {
            for (let idx in this.children) {
                const rec = this.children[idx].sameStructure(other.children[idx], prefix + idx)
                if (!rec) {
                    return rec;
                }
            }
            return undefined;
        }
    }

    public find(name: string) : Tree | undefined {
        if (name == this.name) {
            return this;
        }

        for (let child of this.children) {
            let cf = child.find(name);
            if (cf) return cf;
        }

        return undefined;
    }

    // recursively filter out those children whose names are in names. 
    public filterNames(names: Set<string>) : Tree {
        let ret = this.shallow();
        const kids = []
        for (const child of this.children) {
            if (child.name && names.has(child.name)) {
                continue;
            } else {
                kids.push(child.filterNames(names));
            }
        }
        ret.children = kids;
        return ret;
    }
}

// recursively clean-up nodes in which there is just a single child, that is completely contained in the parent.
//  A -> [B -> *] 
// with 
//  B -> *
export function flatten(me: Tree): Tree {
    for (let ci in me.children) {
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

export function smooth(me: Tree) : Tree {

    for (const ci in me.children) {
        me.children[ci] = smooth(me.children[ci]);
    }
    for (const ci in me.children) {
        const child = me.children[ci];
        if (me.left > child.left + 1) {
            console.log('too big left: ' + child.name + ' ' + me.name)
            console.log(child.left)
            console.log(me.left)
            throw new Error("can't smooth this one!")
        }
        if (me.right + 1 < child.right) {
            console.log('too big right: ' + child.name + ' ' + me.name)
            console.log(child.right)
            console.log(me.right)
            throw new Error("can't smooth this one!")
        }

        if (me.top > child.top + 1) {
            console.log('too big top: ' + child.name + ' ' + me.name)
            console.log(child.top)
            console.log(me.top)
            throw new Error("can't smooth this one!")
        }

        if (me.bottom + 1 < child.bottom) {
            console.log('too big bottom: ' + child.name + ' ' + me.name)
            console.log(child.bottom)
            console.log(me.bottom)
            throw new Error("can't smooth this one!")
        }

        me.children[ci].width = Math.min(child.width, me.width);
        me.children[ci].height = Math.min(child.height, me.height);

        me.children[ci].left = Math.max(child.left, me.left);
        me.children[ci].top = Math.max(child.top, me.top);   
    }

    return me;
}

export function allocName(names: Set<string>, prefix: string, suff: number = 0): string {
    if (!names.has(prefix)) {
        names.add(prefix);
        return prefix;
    }

    while (names.has(prefix + suff.toString())) {
        ++suff;
    }
    names.add(prefix + suff.toString());
    return prefix + suff.toString();
}

export function nameTree(t: Tree, names = new Set<string>(), prefix: string = "box") {

    if (!t.name) {
        t.name = allocName(names, prefix);
    }

    for (let ci in t.children) {
        let newname = allocName(names, prefix, parseInt(ci));
        nameTree(t.children[ci], names, t.name + "_");
    }
}


export function isVisible(me: HTMLElement, root: HTMLElement): boolean {
    // TODO: some elements do not have this function in firefox?? debug.
    if (!me.getBoundingClientRect) {
        // console.log(me);
        return false;
    }
    let {height, width, x, y} = me.getBoundingClientRect();
    const [rootR, rootB] = [root.getBoundingClientRect().right, root.getBoundingClientRect().bottom];
    return width != 0 && height != 0 && x <= rootR && y <= rootB;
}

export function isContained(child: HTMLElement, parent: HTMLElement) : boolean {
    if (!child.getBoundingClientRect || !parent.getBoundingClientRect) {
        return false;
    }
    const [childRect, parentRect] = [child.getBoundingClientRect(), parent.getBoundingClientRect()]
    const [ct, cb, cl, cr] = [childRect.top, childRect.bottom, childRect.left, childRect.right];
    const [pt, pb, pl, pr] = [parentRect.top, parentRect.bottom, parentRect.left, parentRect.right];

    return ct >= pt && cb <= pb && cl >= pl && cr <= pr;
}

function shouldTerminate(me: HTMLElement, opaqueClasses: string[]): boolean {
    // exclude paragraphs, HRs, and headings
    const ts = [HTMLParagraphElement, HTMLHeadingElement, HTMLHRElement, HTMLSelectElement];
    for (let ty of ts) {
        if (me instanceof ty) {
            return true;
        }
    }

    // const opaqueClasses = ["ace_scroller", "ace_gutter", "ace_text-input", "toggleButton"]; ace;
    const cs = me.className.split(' ');

    if (opaqueClasses.includes(me.id)) {
        return true;
    }

    for (let c of cs) {
        if (opaqueClasses.includes(c)) {
            return true;
        }
    }

    const specialIDs: string[] = []; //["optionsWrapper"]

    return specialIDs.includes(me.id);
}

function calculatePadding(me: HTMLElement): { left: number, top: number } {
    let style = window.getComputedStyle(me);

    if (style.paddingLeft === null) throw new Error("left padding is null");
    if (style.paddingTop === null) throw new Error("top padding is null");

    return {
        left: parseFloat(style.paddingLeft),
        top: parseFloat(style.paddingTop)
    };
}

function calculateSize(me: HTMLElement) : { width: number, height: number } {
    let style = window.getComputedStyle(me);
    
    if (style.width === null) throw new Error("width is null");
    if (style.height === null) throw new Error("height is null");

    const dims = me.getBoundingClientRect();

    const [h, w] = [
        parseFloat(style.height) || me.offsetHeight, 
        parseFloat(style.width) || me.offsetWidth
    ];
    if (!h || !w) {
        console.log('bad height/width: ' + style.height + " , " + style.width + "; " + me.clientWidth + " , " + me.clientHeight);
        console.log(me.getBoundingClientRect());
        throw new Error("dimensions are bad");
    }

    let [widthAdjustment, heightAdjustment] = [0, 0];
    if (style.boxSizing == 'border-box') {
        heightAdjustment += parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + parseFloat(style.borderTopWidth) + parseFloat(style.borderBottomWidth);
        widthAdjustment += parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth)
    }

    return {
        width: w - widthAdjustment,
        height: h - heightAdjustment
    };
}

export function mockify(me: HTMLElement, root: HTMLElement, opaqueClasses: string[], names = new Set<string>()): Tree {
    let {top, left} = me.getBoundingClientRect();
    let padding = calculatePadding(me);
    const style = window.getComputedStyle(me);


    // adjust x-y coordinates for padding
    if (style.boxSizing != "border-box") {
        top = top + padding.top;
        left = left + padding.left;
    }
    

    // compute height/width independent of padding
    let {width, height} = calculateSize(me);

    // if (Array.from(me.classList).includes('onboarding-ed__content')) {
    //     console.log('weird size: ');
    //     console.log(`w: ${width}, h: ${height}`);
    // }

    const kids: Tree[] = [];
    const newName = allocName(names, me.id || "box");
    me.id = newName;
    let out = new Tree(newName, top, left, height, width, kids);

    if (shouldTerminate(me, opaqueClasses)) {
        return out;
    }

    for (const child of Array.from(me.children)) {
        if (!(child instanceof HTMLElement)) {
            // console.log("There's non-HTML in my HTML!");
            console.log(child);
            continue;
            // throw new Error("There's non-HTML in my HTML!");
        }

        // let foos = document.getElementsByClassName("nav-menu--slideout");
            // console.log(foos);
            // console.log(Array.from(foos).map(x => isVisible(x as HTMLElement)))

        if (isVisible(child, root)) {
            // recurse on child and add to children
            // if ((new Set(Array.from(child.classList))).has("nav-menu--slideout")) {
            //     console.log('adding a foo')
            //     console.log(child.getBoundingClientRect().x);
            //     console.log(document.body.getBoundingClientRect().width);
            // }
            if (child.id == 'footer_homepage') {
                continue;
            }
            if (! isContained(child, me)) {
                console.log('warning: child not contained, skipping:');
                console.log(child);
                console.log(child.getBoundingClientRect());
                console.log(me.getBoundingClientRect());
                // continue;
            }
            kids.push(mockify(child, root, opaqueClasses, names));
        } else {
            if (child.id && child.id == 'content') {
                console.log('warning! skipping content due to invisible');
            }
        }
    }

    
    return out;
}


// draw a bunch of dotted red boxes onto the screen :)
export function visualize(me: Tree) {
    let newd = document.createElement('div');
    document.body.appendChild(newd);
    if (me.name) {
        newd.id = "orig-" + me.name;
    }
    newd.style.border = "thin dotted red";
    newd.style.position = 'absolute';
    newd.style.left = String(me.left) + "px";
    newd.style.top = String(me.top) + "px";
    newd.style.height = String(me.height) + "px";
    newd.style.width = String(me.width) + "px";
    newd.style.zIndex = "1000";

    me.children.map(visualize);
}

function test() {
    let lhs = new Tree("foo", 0, 0, 0, 0, [new Tree("bar", 0, 0, 0, 0, [])]);
    // let rhs = new Tree(0,0,0,0,[]);
    let rhs = lhs.copy();
    rhs.left = 1;
    rhs.top = 1;

    lhs.rms(rhs)
        .then(rms => console.log("rms error: " + rms.toString()))
        .catch(e => console.log(e));
}