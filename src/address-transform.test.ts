import { AddressTransform } from './address-transform';

const t2 = new AddressTransform({});
t2.on('error', error => console.log('t2 on error', error));
t2.on('data', data => console.log('t2 on data:', data.length));
t2.on('finish', () => console.log('t2 on finish', JSON.stringify(t2.state)));
t2.on('end', () => console.log('t2 on end', JSON.stringify(t2.state)));

console.log('initial state 2:', JSON.stringify(t2.state));


console.log('write bar');
t2.write('bar');
console.log('state 2:', JSON.stringify(t2.state));

console.log('write baz');
t2.write('baz');
console.log('state 2:', JSON.stringify(t2.state));

console.log('write <lots>');
const ary = new Uint8Array(500000);
ary.fill(23);
t2.write(ary);
console.log('state 2:', JSON.stringify(t2.state));

console.log('write <lotsmore>');
const ary2 = new Uint8Array(1000000);
ary2.fill(42);
t2.write(ary2);
console.log('state 2:', JSON.stringify(t2.state));

console.log('write <lotsmoremore>');
const ary3 = new Uint8Array(10000000);
ary3.fill(127);
t2.write(ary3);
console.log('state 2:', JSON.stringify(t2.state));

console.log('t2.end()');
t2.end();
console.log('state 2 end:', JSON.stringify(t2.state));


import { join } from 'path';
import { promises, createReadStream, createWriteStream } from 'fs';
const { rename, stat } = promises;

//const inputFile = createReadStream(join(__dirname, 'index.ts'));
const inputFile = createReadStream(join('/Users/hugh/Downloads', 'FAA-H-8083-16B_Chapter_4.pdf'));

const t3 = new AddressTransform({});
t3.on('error', error => console.log('t3 on error', error));
//t3.on('data', data => console.log('t3 on data:', data.length));
t3.on('finish', () => console.log('t3 on finish', JSON.stringify(t3.state)));
t3.on('end', () => console.log('t3 on end', JSON.stringify(t3.state)));

console.log('inputFile.pipe(outputFile)');
inputFile.pipe(t3);

const outfilename = join(__dirname, 'index.ts.copy');
const outputFile = createWriteStream(outfilename);
outputFile.on('error', error => console.log('outputFile on error', error));
//outputFile.on('data', data => console.log('outputFile on data:', data.length));
outputFile.on('finish', async () => {
  console.log('outputFile on finish', 't3.state:', JSON.stringify(t3.state));
  const addressFilename = join(__dirname, t3.state.contentAddress);
  await rename(outfilename, addressFilename);
  const { size } = await stat(addressFilename);
  console.log(addressFilename, size, t3.state.sizeBytes);

  //await rename(outfilename, __dirname).catch(console.error);
  console.log('outputFile on finish', 'renamed');
});
//outputFile.on('end', () => console.log('outputFile on end'));

console.log('t3.pipe(outputFile)');
t3.pipe(outputFile);

//setTimeout(() => console.log('done'), 3000);
