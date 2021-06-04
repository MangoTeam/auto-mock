
export let prepTimes: number[] = [];
export let resizeTimes: number[] = [];
export let synthTime: number = 0.0;
export let synthTimeout: number = 0; // actually no timeout.
// export let synthTimeout: number = 60*10*10*10; // 1000 minutes aka no timeout.

export function reset() {
    prepTimes = [];
    resizeTimes = [];
    synthTime = 0.0;
}

function avg(x: number[]) {
    return x.reduce((a, b) => a + b) / (x.length * 1000.0)
}

export function getSolverTimes() : {prep: number, resize: number} {
    if (prepTimes.length > 0 && resizeTimes.length > 0) 
      return {prep: avg(prepTimes), resize: avg(resizeTimes)};
    else
      return {prep: -1, resize: -1};
}

export function getSynthTime() {
  return synthTime/1000.0;
}

export function setSynthTime(x: number) {
  synthTime = x;
}

export function setSynthTimeout(x: number) {
  console.log(`overriding synthesis timeout to ${x}`);
  synthTimeout = x;
}
