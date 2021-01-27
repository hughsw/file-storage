import { Transform } from 'stream';
import { createHash } from 'crypto';

// Gather size and content-addressable store key from a stream, and also a measure of throughput
// Result is in getter state
export class AddressTransform extends Transform {
  private contentAddress: string;
  protected sizeBytes = 0;
  private bytesPerSecond: number;

  private hash = createHash('sha256');
  private start = Date.now();

  // The state can be accessed any time to get sizeBytes and bytesPerSecond.  contentAddress
  // only appears after the stream is flushed (AddressTransform.end(), _flush()), at which
  // point the state will never change.
  get state() {
    const state:{[key:string]: any;} = {
      contentAddress: this.contentAddress,
      sizeBytes: this.sizeBytes,
      bytesPerSecond: this.bytesPerSecond,
    };
    return state;
  }

  private updateThroughput() {
    //  avoid possible divide-by-zero
    const msec = (Date.now() - this.start) || 1;
    const recipDurationSec = 1000 / msec;
    this.bytesPerSecond = Math.floor(this.sizeBytes * recipDurationSec);
    //const durationSec = (Date.now() - this.start + 1) / 1000;
    //this.bytesPerSecond = Math.floor(this.sizeBytes / durationSec);
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
    console.log('AddressTransform _flush');
    let error;
    try {
      this.contentAddress = this.hash.digest('hex');
      this.updateThroughput();
    }
    catch (err) {
      error = err;
    }
    finally {
      callback(error);
    }
  };

}
