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

  private readonly hash;
  private start = Date.now();

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
      this.push(chunk);
      this.updateThroughput();

      randomThrow && randomThrow(0.005, 'AddressTransform._transform');
    }
    catch (err) {
      error = err;
    }
    finally {
      //console.log('AddressTransform _transform callback');
      callback(error);
    }
  };

  _flush (callback) {
    //console.log('AddressTransform _flush');
    let error;
    try {
      this.contentAddress = this.hash.digest(this.hashConfig.hashDigest);
      this.updateThroughput();
      randomThrow && randomThrow(0.1, 'AddressTransform._flush');
    }
    catch (err) {
      error = err;
    }
    finally {
      callback(error);
    }
  };

}
