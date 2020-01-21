import {Tree} from './Tree'

export class TreePainter {

  public getColor(d: number) : string {
    if (!(d in this.hues)) {
      console.log(`error: index ${d} not found in hues`);
      console.log(this.hues);
      return "rgb(255,255,255)";
    }
    return `hsl(${this.hues[d]}, 100%, 50%)`;
  }

  public hues : number[];

  constructor(t: Tree) {
    const amount = Math.round(depth(t)/2);
    const positions = [...new Array(amount).keys()].map(n => n * 180/amount)
    this.hues = [];
    for (let pos of positions) {
      this.hues.push(pos, pos + 180);
    }
  }

  
}

function depth(t: Tree) : number {
  return 1+Math.max(0, ...t.children.map(depth));
}