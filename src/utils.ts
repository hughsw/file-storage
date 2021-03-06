// defer() -- Create a new promise and return the promise itself and its resolve and reject
// functions.  This dissection of a promise is useful for situations where the logic for the
// result to be resolved is lexcially separate from the logic that returns the promise.  It
// also supports simple try/catch/finally patterns with promises, logic, and callbacks.
//
// Based on the functionality of defer() from the promise-callbacks package.
type Voider<T> = (value:T) => void;
export const defer = <T>(): { promise: Promise<T>; resolve:Voider<T>; reject:Voider<any>; } => {

  // These two assignments don't do anything except prevent the strictNullChecks error,
  // e.g.: "Variable 'reject' is used before being assigned."  We know (empirically) that
  // the Promise constructor calls the function it's handed and so assigns to the
  // variables, but the compiler doesn't know that.

  let resolve:Voider<T> = (_:T) => undefined;
  let reject:Voider<any> = (_:any) => undefined;
  // console.log('defer 0:', resolve, reject);
  const promise = new Promise<T>((...args) => [resolve, reject] = args);
  // console.log('defer 1:', resolve, reject, promise);

  return { promise, resolve, reject };
};



// hrHrTimestamp():string -- High-resolution human-readable timestamp with date, time, and
// nanos, as YYYY-MM-DD_HHMM-SS_Milli-Micro-Nano e.g. "2021-01-26_1250-50_542-383-044"
//
// As of 2021-01, MacBook-Pro, 2.7 GHz, Early 2015 model, Node JS 10.23.0, the hrHrTimestamp()
// function takes roughly 3.2 microseconds to run
export const hrHrTimestamp = ():string => {
  const date = new Date;
  const nano = (process.hrtime()[1] + '').padStart(9, '0');

  const pad2 = value => (value + '').padStart(2, '0');
  const now = {
    year: pad2(date.getUTCFullYear()),
    month: pad2(date.getUTCMonth()+1),
    day: pad2(date.getUTCDate()),

    hour: pad2(date.getUTCHours()),
    minute: pad2(date.getUTCMinutes()),
    second: pad2(date.getUTCSeconds()),

    milli: nano.slice(0,3),
    micro: nano.slice(3,6),
    nano: nano.slice(6),
  };

  const value = `${now.year}-${now.month}-${now.day}_${now.hour}${now.minute}-${now.second}_${now.milli}-${now.micro}-${now.nano}`;

  return value;
};

// crude benchmark: $(npm bin)/ts-node ./utils.ts
if (require.main === module) {

  const count = 2000000;

  const ary = (new Array(count)).fill(0);

  const start = Date.now();
  const stamps = ary.map(() => hrHrTimestamp());
  const durationMsec = Date.now() - start;

  console.log('first:', stamps[0]);
  console.log('final:', stamps[stamps.length-1]);
  console.log('hrHrTimestamp:', count, 'calls,', (durationMsec/1000).toFixed(2), 'seconds, average calltime', Math.floor(durationMsec*1000000/count), 'nanoseconds');
}


/*
// for (i of range(n)) { }
export function* range1(start:number, stop=number|undefined) {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  if (start === stop) return;
  yield start;
  yield* range(start + 1, stop);
}

// for (i of range(n)) { }
export const range2 = (start:number, stop:number|undefined=undefined) => {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }
  function* _range(current:number) {
    if (current === stop) {
      console.trace();
      return;
    }
    yield current;
    yield* _range(current+1);
  }
  return _range(start);
}
//HSW*/

// for (i of range(n)) { }
// for (i of range(m,n)) { }
export function* range(start:number, stop:number|undefined=undefined) {
  if (stop === undefined) {
    stop = start;
    start = 0;
  }

  while (start < stop) yield start++;
}

//console.log(Array.from(range(20)));
//console.log(Array.from(range(15,20)));
//export rangeMap = (start:number, stop:number|void=undefined) => Array.from(range(start.stop)).map
export const rangeMap = (stop:number, func) => Array.from(range(0, stop)).map(func);


// Normalize error-like things to plain Object to be thrown
//
// This is needed based on empirical evidence that Error objects do
// not play well with promises that have involved system calls that
// create errors.  Our guess being that the call stacks may not
// survive the promise/catch handling...
export const errorObject = error => {
    const json = JSON.stringify(error);
    if (json !== '{}') {
	const obj = JSON.parse(json);
	obj.message = error.message;
	return obj;
    }
    else {
	return {
	    message: `${error}`,
	};
    }
};

export const randomError = (chance: number, tag: string = null) => {
    if (Math.random() < chance) return new Error(tag || `randomError at ${chance}`);
};

export const randomThrow = (chance: number, tag: string = null) => {
    const error = randomError(chance, tag);
    if (error) throw error;
};
    
    
// unopinionated version of Promise.allSettled() that includes the rejections in the list
// see: https://dev.to/vitalets/what-s-wrong-with-promise-allsettled-and-promise-any-5e6o
export const promiseAll = (args: Array<Promise<any>>): Promise<Array<any>> => Promise.all(args.map(arg => arg.catch(rejection => rejection)));
