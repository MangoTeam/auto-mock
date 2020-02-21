export function difference<T>(l: Set<T>, r: Set<T>) {
    const ret = new Set(l);
    for (let elem of r) {
        ret.delete(elem);
    }
    return ret;
}

export function union<T>(l: Set<T>, r: Set<T>) {
    const ret = new Set(l);
    for (let t of r) {
        ret.add(t);
    }
    return ret;
}