import typescript from "@rollup/plugin-typescript";
import nodeResolve from "@rollup/plugin-node-resolve";
import commonjs from "@rollup/plugin-commonjs";
import json from "@rollup/plugin-json";

export default {
    input: './src/jeff.ts',
    output: [
        {
            format: 'iife',
        }
    ],
    plugins: [
        typescript(),
        nodeResolve(),
        commonjs(),
        json()
    ]
}
