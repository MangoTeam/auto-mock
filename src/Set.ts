export function difference<T>(l: Set<T>, r: Set<T>) {
    const ret = new Set(l);
    for (let elem of r) {
        ret.delete(elem);
    }
    return ret;
}