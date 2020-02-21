import * as Tree from './Tree';

function main() {
    // start the tree-building algorithm from the document's body
    let root = document.body;
    // root = document.getElementById('editor-container') || document.body;
    let out = Tree.flatten(Tree.mockify(root));
    Tree.nameTree(out);
    Tree.visualize(out);

    let result = JSON.stringify(out);
    (window as any).result = result;
    window.localStorage.clear();
    window.localStorage.setItem('output', result);
}

console.log("running");
main();
