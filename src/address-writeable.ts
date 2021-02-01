import { createWriteStream, promises as fsPromises } from 'fs';
import { createHash } from 'crypto';

import { AddressTransform } from './address-transform';
import { defer, errorObject, randomError, randomThrow } from './utils';
import { FILE_MODE } from './constants';

import { HashConfig, defaultHashConfig, StoragePayload } from './types';

console.log(defaultHashConfig());

export class AddressWritable  {
  private hashConfig = defaultHashConfig();

  // Run the upload, returning a promise that resolves to a payload with a bunch of state about the storage
  runPipeline(inPayload: StoragePayload): Promise<StoragePayload> {
    const { uploadTag, inStream, filename } = inPayload;

    const addressTransform = new AddressTransform({
      hashConfig: this.hashConfig,
    });

    const writeStream = createWriteStream(filename, { mode: FILE_MODE });

    const payload = (error=undefined): StoragePayload => {
      const state: StoragePayload = {
        ...inPayload,
        ...addressTransform.payload,
        filename,
      };
      if (error) {
        console.log('AddressWritable runPipeline payload error:', error);
        //console.log('AddressWritable runPipeline state, before error-based deletes:', JSON.stringify(state));
        // TOOO: high-level cleanup of properties
        delete state.contentAddress;
        state.error = true;
        state.errors = [ errorObject(error) ];
      }
      return state;
    };

    const { promise, resolve, reject } = defer<StoragePayload>();

    const rejectError = error => reject(payload(error));

    // Through a lengthy bitter experience we have learned that the async Stream APIs are not
    // reliable following an error.  Using them after an error is risky.  In particular, Node
    // JS sometimes crashes after a 'No space left on device' error if you continue to work
    // with the stream.  So, we resolve immediately with an error condition.

    try {
      console.log(`runPipeline: '${filename}' add inStream.on('error', rejectError)`);
      inStream.on('error', rejectError);
      //error => {
      //  reject(payload(error));
      //});
      inStream.on('close', () => console.log('AddressWritable.inStream close', uploadTag));

      addressTransform.on('error', rejectError);
      //error => {
      //  reject(payload(error));
      //});
      addressTransform.on('close', () => console.log('AddressWritable close', uploadTag));

      writeStream.on('error', rejectError);
      //error => {
      //  reject(payload(error));
      //});

      //writeStream.on('close', () => console.log('AddressWritable.writeStream close', uploadTag));

      //*
      writeStream.on('close', async () => {
        console.log('AddressWritable.writeStream close', uploadTag);
        let error;
        try {
	  // quick consistency check
	  const { size } = await fsPromises.stat(filename);
          const errOffset = randomError && randomError(0.05) ? 1 : 0;
          const sizeBytes = addressTransform.payload.sizeBytes - errOffset;
          if (size !== sizeBytes)
	    throw new Error(`expected written file '${filename}' to be ${sizeBytes} bytes, stat gives ${size}`);
        }
        catch (err) {
          error = err;
        }
        finally {
          console.log('AddressWritable on close finally', uploadTag);
          error ? reject(payload(error)) : resolve(payload());
        }
      });
      //HSW*/

      // We handle use of the Readable interface

      console.log('AddressWriteable.addressTransform.pipe(AddressWritable.writeStream)');
      addressTransform.pipe(writeStream);

      randomThrow && randomThrow(0.05, 'AddressWritable.runPipeline middle');

      console.log('AddressWriteable.inStream.pipe(AddressWritable.addressTransform)');
      inStream.pipe(addressTransform);

      randomThrow && randomThrow(0.05, 'AddressWritable.runPipeline end');
    }
    catch (error) {
      rejectError(error);
//      reject(payload(error));
    }
    finally {
      return promise;;
    }

  }

  // resolve to state on success, reject with error on failure
  static validate3(inPayload: StoragePayload): Promise<StoragePayload> {
    const { promise, resolve, reject } = defer<StoragePayload>();

    const payload = (error=undefined): StoragePayload => {
      const state: StoragePayload = { ...inPayload };
      if (error) {
        console.log('AddressWritable validate3, before error-based deletes:', JSON.stringify(state));
        // TOOO: high-level cleanup of properties
        delete state.contentAddress;
        state.error = true;
        state.errors = [ errorObject(error) ];
      }
      return state;
    };

    const { filename, contentAddress, sizeBytes } = inPayload;

    const inStream = createReadStream(filename + (randomError && randomError(0.1) ? '_validate3_' : ''));
    inStream.on('error', error => reject(payload(error)));

    let size = 0 + (randomError && randomError(0.05) ? 1 : 0);
    const hashConfig = defaultHashConfig();
    const hash = createHash(hashConfig.hashType);
    inStream.on('data', chunk => {
      size += chunk.length;
      hash.update(chunk);
    });
    inStream.on('close', () => {
      const address = (randomError && randomError(0.05) ? 'XXX_validate3_' : '') + hash.digest(hashConfig.hashDigest);
      if (size !== sizeBytes) {
        reject(payload(new Error(`TODO-remove-me-v3  expected file '${filename}' to have size ${sizeBytes}, but validator calculated ${size}`)));
      }
      else if (address !== contentAddress) {
        reject(payload(new Error(`TODO-remove-me-v3  expected file '${filename}' to have address ${contentAddress}, but validator calculated ${address}`)));
      }
      else {
        resolve(payload());
      }
    });

    return promise;
  }

}


import { createReadStream } from 'fs';
import { join } from 'path';

if (require.main === module) {

  const main = () => {
    const { promise, resolve, reject } = defer();

    try {
      const inputFile = createReadStream(join('/Users/hugh/Downloads', 'FAA-H-8083-16B_Chapter_4.pdf'));

      const aw = new AddressWritable();
    }
    catch (error) {
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
