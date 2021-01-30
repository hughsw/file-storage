import { Transform } from 'stream';
import { createHash } from 'crypto';

import { HashConfig, defaultHashConfig } from './types';
import { randomThrow } from './utils';

// Gather size and content-addressable store key from a stream, and also a measure of throughput
// Result is in getter payload
export class AddressTransform extends Transform {

  private contentAddress: string;
  protected sizeBytes = 0;
  private uploadBytesPerSecond: number;

  //  private hash = createHash(this.hashType);
  private readonly hash;
  private start = Date.now();

  //  private randomError = false;

  private hashConfig = defaultHashConfig();

  constructor(options:{[key:string]: any;}|void = undefined) {
    super();
    if (options) {
      if (options.hashConfig) {
	this.hashConfig = {
	  ...this.hashConfig,
	  ...options.hashConfig,
	};
      }
      //	  this.randomError = options.randomError;
    }

    this.hash = createHash(this.hashConfig.hashType);

    randomThrow && randomThrow(0.05, 'AddressTransform.constructor');

  }

  // The payload can be accessed any time to get sizeBytes and uploadBytesPerSecond.  contentAddress
  // only appears after the stream is flushed (AddressTransform.end(), _flush()), at which
  // point the payload will never change.
  get payload(): { contentAddress: string; sizeBytes: number; uploadBytesPerSecond: number; } {
    return {
      contentAddress: this.contentAddress,
      sizeBytes: this.sizeBytes,
      uploadBytesPerSecond: this.uploadBytesPerSecond,
    };
  }

  private updateThroughput() {
    //  avoid possible divide-by-zero
    const msec = (Date.now() - this.start) || 1;
    const recipDurationSec = 1000 / msec;
    this.uploadBytesPerSecond = Math.floor(this.sizeBytes * recipDurationSec);
    //const durationSec = (Date.now() - this.start + 1) / 1000;
    //this.uploadBytesPerSecond = Math.floor(this.sizeBytes / durationSec);
  }

  _transform(chunk, encoding, callback) {
    //console.log('AddressTransform _transform');
    let error;
    try {
      // Reset start to the first time we get non-empty data
      if (this.sizeBytes === 0) {
        this.start = Date.now();
      }
      this.sizeBytes += chunk.length;
      this.hash.update(chunk);
      //console.log('AddressTransform _transform push');
      this.push(chunk);
      this.updateThroughput();
      randomThrow && randomThrow(0.005, 'AddressTransform._transform');
      //	const err = randomError(0.005, 'AddressTransform._transform');
      //	if (err) throw err;
    }
    catch (err) {
      error = err;
    }
    finally {
      //console.log('AddressTransform _transform callback');
      //error = error || randomError(0.005, 'AddressTransform._transform');
      /*
        let sample;
        if (this.randomError && !error && (sample = Math.random()) < 0.005) {
	error = new Error(`transform error: ${sample}`);
        }
      */
      callback(error);
    }
  };

  _flush (callback) {
    console.log('AddressTransform _flush');
    let error;
    try {
      this.contentAddress = this.hash.digest(this.hashConfig.hashDigest);
      this.updateThroughput();
      randomThrow && randomThrow(0.1, 'AddressTransform._flush');
      //const err = randomError(0.1 'AddressTransform._flush');
      //if (err) throw err;
    }
    catch (err) {
      error = err;
    }
    finally {
      //	error = error || randomError(0.1 'AddressTransform._flush');
      /*
        let sample;
        if (this.randomError && !error && (sample = Math.random()) < 0.1) {
	error = new Error(`flush error: ${sample}`);
        }
      */
      callback(error);
    }
  };

}
