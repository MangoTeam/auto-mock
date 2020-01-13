import * as Tree from './Tree';

import {main} from './NodeBench'


// function main() {

//     // start the tree-building algorithm from the document's body
//     let root = document.body;
//     let out = Tree.flatten(Tree.mockify(root));
//     Tree.visualize(out);

//     let result = JSON.stringify(out);
//     window.localStorage.clear();
//     window.localStorage.setItem('output', result);
// }

export default main;

main().then(console.log).catch(console.log);