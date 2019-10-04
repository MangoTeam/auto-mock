import VL = require('vega-lite');
import VE = require('vega-embed');

export class GraphFormat {
    constructor(public title: string, public errors: number[]) {
    }
}

export function genFromGF(gf: GraphFormat): Promise<VE.Result> {
    const visID = '#vis';
    const xTitle = "Examples";
    const yTitle = "RMS error"
    const spec: VL.TopLevelSpec = {
        "$schema": "https://vega.github.io/schema/vega-lite/v4.0.0-beta.2.json",
        "data": {
            "values": gf.errors.map((val, idx) => {
                return {[xTitle]: idx + 1, [yTitle]: val}
            })
        },
        "mark": "bar",
        "encoding": {
            "x": {"field": xTitle, "type": "ordinal"},
            "y": {"field": yTitle, "type": "quantitative"}
        }
    }

    return VE.default(visID, spec);
}

// main();

// genFromGF(new GraphFormat("foo", [100, 70, 70, 40]));