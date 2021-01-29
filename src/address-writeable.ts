import { createWriteStream, promises as fsPromises } from 'fs';
import { createHash } from 'crypto';

import { AddressTransform } from './address-transform';
import { defer, errorObject, randomError, randomThrow } from './utils';
import { FILE_MODE } from './constants';

import { HashConfig, defaultHashConfig } from './types';

console.log(defaultHashConfig());

// Clients should only use the Writable interface.
// 'close' and 'error' are the interesting events to monitor
// We only emit the first error that occurs.
// After 'close', the state will have either:
// - valid content-addressable properties and no .errors
// or
// - a .errors array and incomplete content-addressable properties
//export class AddressWritable extends AddressTransform {
export class AddressWritable  {

    //  private addressTransform: NodeJS.ReadableStream & NodeJS.WritableStream;;
    private addressTransform: AddressTransform;
  private writeStream: NodeJS.WritableStream;

  private readonly errors: Array<any> = [];

    private hashConfig = defaultHashConfig();
    //private readonly hashType = 'sha256';
//    private readonly hashType = 'sha1';
//  private readonly hashDigest = 'hex';

  constructor(private readonly inStream:NodeJS.ReadableStream, private readonly filename: string, private readonly clientTag:string|void=undefined) {
      //super();

      this.addressTransform = new AddressTransform({
	  hashConfig: this.hashConfig,
//	  randomError: undefined,
      });
      //this.addressTransform = new AddressTransform({randomError:true});

    //const writeStream = createWriteStream(this.filename, { mode: FILE_MODE });
    this.writeStream = createWriteStream(this.filename, { mode: FILE_MODE });

      randomThrow(0.05, 'AddressWritable.constructor');
  }

  // Run the streams, returning a promise
  runPipeline() {
    const { promise, resolve, reject } = defer();

    let doResolveOrReject = true;
    const myReject = () => {
      if (doResolveOrReject) {
        doResolveOrReject = false;
        reject(this.state);
      }
    };
    const myResolve = () => {
      if (doResolveOrReject) {
        doResolveOrReject = false;
        resolve(this.state);
      }
    };
    // Through a lengthy bitter experience we have learned that the Stream APIs are not
    // reliable following an error.  Using them after an error is risky.  In particular, Node
    // JS sometimes crashes after a 'No space left on device' error if you continue to work
    // with the stream.  So, we resolve immediately with an error condition.

    try {
      //this.inStream.on('error', error => console.log('AddressWritable inStream error:', error));
      this.inStream.on('error', error => {
        //return reject(error);
        this.addError('inStream on error', error);
        myReject();
        //this.end();
      });
      this.inStream.on('close', () => console.log('AddressWritable.inStream close', this.clientTag));


      this.addressTransform.on('error', error => {
        //return reject(error);
        this.addError('AddressWritable on error', error);
        myReject();
      });
      this.addressTransform.on('close', () => console.log('AddressWritable close', this.clientTag));
	/*
      this.on('error', error => {
        //return reject(error);
        this.addError('AddressWritable on error', error);
        myReject();
      });
      this.on('close', () => console.log('AddressWritable close', this.clientTag));
*/

      this.writeStream.on('error', error => {
        this.addError('writeStream on error', error);
        //reject(this.state);
        //this.writeStream.destroy();
        //this.destroy();
        myReject();
      });

      this.writeStream.on('close', () => console.log('AddressWritable.writeStream close', this.clientTag));
      //this.writeStream.on('close', () => (this.errors.length === 0 ? resolve(this.state) : myReject()));
	//this.writeStream.on('close', () => (this.errors.length === 0 ? myResolve() : myReject()));

      //*
        this.writeStream.on('close', async () => {
            try {
		// quick consistency check
		const { size } = await fsPromises.stat(this.filename);
		//console.log('AddressWritable.writeStream close sizes:', size, this.size);
		if (size !== this.size  + (randomError(0.05) ? 1 : 0) )
		    throw new Error(`expected written file '${this.filename}' to be ${this.size} bytes, stat gives ${size}`);
            }
            catch (error) {
		this.addError('writeStream on close', error);
            }
            finally {
		console.log('AddressWritable on close finally', this.clientTag);
		this.errors.length === 0
		    ? myResolve()
		    : myReject();
		//(this.errors.length === 0 ? resolve : reject)(this.state);
            }
        });
	//HSW*/

      // We handle use of the Readable interface
      console.log('AddressWriteable.inStream.pipe(AddressWritable.addressTransform)');
      this.inStream.pipe(this.addressTransform);

      console.log('AddressWriteable.addressTransform.pipe(AddressWritable.writeStream)');
      this.addressTransform.pipe(this.writeStream);
/*

      // We handle use of the Readable interface
      console.log('AddressWriteable.inStream.pipe(this)');
      this.inStream.pipe(this);

      console.log('AddressWriteable.pipe(this.writeStream)');
      this.pipe(this.writeStream);
*/
    }
    catch (error) {
      this.addError('AddressWriteable go catch', error);
      myReject();
      //reject(`AddressWriteable go catch error: ${error}`);
    }
    finally {
      return promise;
    }

      //return promise;
  }

  /*
  // Run the streams, returning a promise
  goX() {
  const { promise, resolve, reject } = defer();

  //this.inStream.on('error', error => console.log('AddressWritable inStream error:', error));
  this.inStream.on('error', error => {
  this.addError('inStream on error', error);
  });
  this.inStream.on('close', () => console.log('AddressWritable.inStream close'));


  this.on('error', error => {
  this.addError('AddressWritable on error', error);
  });
  this.on('close', () => console.log('AddressWritable close'));

  this.writeStream.on('error', error => {
  this.addError('writeStream on error', error);
  });

  this.writeStream.on('close', () => console.log('AddressWritable.writeStream close'));
  this.writeStream.on('close', async () => {
  try {
  const { size } = await fsPromises.stat(this.filename);
  if (size !== this.size)
  throw new Error(`expected written file '${this.filename}' to be ${this.size} bytes, stat gives ${size}`);
  }
  catch (error) {
  this.addError('writeStream on close', error);
  }
  finally {
  console.log('AddressWritable emit close');
  this.emit('close');
  }
  });

  console.log('AddressWriteable.pipe(this.writeStream)');
  this.pipe(this.writeStream);

  // We handle use of the Readable interface
  console.log('AddressWriteable.inStream.pipe(this)');
  this.inStream.pipe(this);
  }
  */

  protected get size() {
      //return super.state.sizeBytes;
      return this.addressTransform.state.sizeBytes;
  }

  get state() {
      const state:{[key:string]: any;} = {
	  //	  ...super.state,
	  tag: this.clientTag,
	  ...this.addressTransform.state,
	  filename: this.filename,
      };
      if (this.errors.length > 0) {
	  console.log('AddressWritable get state(), before error-based deletes:', JSON.stringify(state));
	  // these are likely bogus
	  //delete state.sizeBytes;
	  delete state.contentAddress;
	  state.error = true;
	  state.errors = [...this.errors];
      }
      return state;
  }

    // resolve to state on success, reject with error on failure
    validate() {
	const { promise, resolve, reject } = defer();

	const validate = createReadStream(this.filename);
	validate.on('error', reject);

	const hash = createHash(this.hashConfig.hashType);
	validate.on('data', chunk => hash.update(chunk));
	validate.on('close', () => {
	    const state = this.state;
	    //const address = (Math.random() < 0.1 ? 'XXX_' : '') + hash.digest(this.hashConfig.hashDigest);
	    const address = (randomError(0.1) ? 'XXX_' : '') + hash.digest(this.hashConfig.hashDigest);
	    if (address === state.contentAddress) {
		resolve(state);
	    }
	    else {
		this.addError('validate error', new Error(`expected file '${this.filename}' to have address ${this.state.contentAddress}, but validator calculated ${address}`));
		reject(this.state);
	    }
	});

	return promise;
    }

  protected addError(tag, error: Error) {
    console.log('AddressWritable error:', tag, this.errors.length, this.clientTag, ':', error);
    // emit the first error
    if (this.errors.length === 0) {
      //this.emit('error', error);
      //this.writeStream.end();
      //this.writeStream.destroy();
      //this.end();
    }
    // collect all errors for get state()
    // e.g. "no space left on device" error also causes the check in 'close' to fail...
      this.errors.push(errorObject(error));
      //this.errors.push(error);
  }

}


import { createReadStream } from 'fs';
import { join } from 'path';

//import { defer } from './defer';

// console.log('require.main:', require.main);
// console.log('module:', module);
if (require.main === module) {

  const main = () => {
    const { promise, resolve, reject } = defer();

    try {
      //const inputFile = createReadStream(join(__dirname, 'index.ts'));
      const inputFile = createReadStream(join('/Users/hugh/Downloads', 'FAA-H-8083-16B_Chapter_4.pdf'));

      const aw = new AddressWritable(inputFile, '/tmp/foonerxxyy');
      //const aw = new AddressWritable('/Volumes/NoSpaceLeftOnDevice/fooneration');

/*
      aw.on('error', error => console.error('aw on error:', error));
      aw.on('finish', () => console.log('aw on finish'));
      //aw.on('drain', () => console.log('aw on drain'));
      //aw.on('pipe', () => console.log('aw on pipe'));
      //aw.on('unpipe', () => console.log('aw on unpipe'));

      aw.on('close', () => {
        console.log('aw on close:', JSON.stringify(aw.state));
        resolve(aw.state);
      });
*/

      //console.log('inputFile.pipe(aw)')
      //inputFile.pipe(aw);

      //    throw new Error('barf');
    }
    catch (error) {
      //    console.log('catch for reject');
      reject(error);
    }
    finally {
      return promise;
    }
  };

  main()
    .then(result => console.log('result:', JSON.stringify(result)))
    .catch(error => {
      console.log(error);
      console.log('*** fail ***');
      process.nextTick(() => process.exit(1));
    })
  ;
}
