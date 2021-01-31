import { accessSync, renameSync, realpathSync, constants as fsConstants, promises as fsPromises } from 'fs';
import { basename, join } from 'path';

import { AddressWritable } from './address-writeable';
//const { access } = fsPromises;
//import { defer } from './defer';
import { hrHrTimestamp, defer, rangeMap, errorObject, randomError, randomThrow, promiseAllJson } from './utils';
import { DIR_MODE } from './constants';


import { HashConfig, defaultHashConfig, StoragePayload } from './types';


const { access, mkdir, chmod, rename, unlink } = fsPromises;

const rethrow = (errorContext: { error: any; payload: StoragePayload; catchTag: string|void; }): never => {
  const { error, payload, catchTag } = errorContext;

  if (error.timestamp === payload.timestamp) throw error;

  throw {
    ...payload,
    catchTag,
    error: true,
    errors: [ errorObject(error) ],
    contentAddress: undefined,
  };
}


const mkdirs = directory => mkdir(directory, { recursive: true, mode: DIR_MODE })
      .catch(error => {
	  console.log('mkdir error json:', JSON.stringify(error));
	  console.log('mkdir error message:', error.message);
	  console.log('mkdir error template:', `${error}`);
	  throw errorObject(error);
          //throw new Error(`unable to create directory '${directory}' : ${error.message}`);
      });


export class Storage {
  private incomingDirname: string;
  private casRootDirname: string;

  private hashConfig = defaultHashConfig();

  constructor(private options:{[key:string]: any;}) {
    // async and constructors don't mix easily, so we use sync for these (infrequent) checks
    accessSync(this.options.incomingDirname, fsConstants.R_OK | fsConstants.W_OK);
    accessSync(this.options.casRootDirname, fsConstants.R_OK | fsConstants.W_OK);

    this.incomingDirname = realpathSync(this.options.incomingDirname);
    this.casRootDirname = realpathSync(this.options.casRootDirname);

    console.log('this:', JSON.stringify(this));

    randomThrow && randomThrow(0.05, 'Storage.constructor');
  }


  //private async incomingStream(readable:NodeJS.ReadableStream, uploadTag:string|void) {
  private async incomingStream(payload: StoragePayload): Promise<StoragePayload> {
    const { inStream, timestamp, uploadTag } = payload;

    // Errors at this very high-level are not managed
    if (!inStream || !timestamp)
      throw new Error('Storage.incomingStream: mising property payload.inStream or payload.timestamp');

    try {
      const tempName = timestamp + (uploadTag ? ('__' + uploadTag) : '');
      //    const addressWritable = new AddressWritable(inStream, join(this.incomingDirname, tempName), uploadTag);
      const errName = randomError(0.05) ? 'no-such-dir' : undefined;
      const filename = errName ? join(this.incomingDirname, errName, tempName) : join(this.incomingDirname, tempName);
      //const addressWritable = new AddressWritable(inStream, join(this.incomingDirname, tempName));
      //delete payload.inStream;

      const addressWritable = new AddressWritable();

      //    const res1 = await addressWritable.runPipeline({uploadTag});
      //const res1 = await addressWritable.runPipeline({
      payload = await addressWritable.runPipeline({ ...payload, filename });
      delete payload.inStream;
      console.log('Storage.incomingStream runPipeline', JSON.stringify(payload));
      //console.log('Storage.incomingStream res1', JSON.stringify(res1));

      //const res2 = await addressWritable.validate();
      //return res2;

//      payload = await addressWritable.validate2(payload);
//      delete payload.inStream;

      //payload = await addressWritable.validate3(payload);
      payload = await AddressWritable.validate3(payload);
      //delete payload.inStream;
      //return await

      randomThrow && randomThrow(0.1, 'randomThrow: Storage.incomingStream');

      return payload;
    }
    catch (error) {
      rethrow({ error, payload, catchTag: 'Storage.incomingStream catch' });
    }
/*
    catch (error) {
      rethrow({ error, payload, catchTag: 'Storage.incomingStream catch', });
      if (error.timestamp === timestamp) throw error;

      throw {
        ...payload,
        catch: 'Storage.incomingStream catch',
        error: true,
        errors: [ errorObject(error) ],
        contentAddress: undefined,
      };
    }
*/

  }


/*
  private incomingStreamX(readable:NodeJS.ReadableStream, tag) {
    //readable.on('error', error => console.log('incomingStream readable error:', error));

    const { promise, resolve, reject } = defer();
    try {
      //const nowMsec = Date.now();
      //const nowNsec = (process.hrtime()[1] + '').padStart(9, '0');
      //const tempName = `${nowMsec}_${nowNsec}_${tag}`;
      // TODO: randomness? probably not necessary because hrHrTimestamp() takes over 3000 nanoseconds to run
      const tempName = hrHrTimestamp() + (tag ? ('_' + tag) : '');

      const addressWritable = new AddressWritable(readable, join(this.incomingDirname, tempName));

      //addressWritable.on('error', reject);
      addressWritable.on('error', console.error);
      addressWritable.on('close', () => {
        const state = addressWritable.state;
        // TODO: move the error logic into AddressWritable
        (state.errors ? reject : resolve)(state);
      });

      addressWritable.go();
      //console.log('readable.pipe(addressWritable)');
      //readable.pipe(addressWritable);
    }
    catch (error) {
      reject(`Storage incomingStream error: ${error}`);
      //reject(error);
    }
    finally {
      return promise;
    }
  }
*/

  private get casWidth():number {
    return this.hashConfig.casWidth;
  }
  private get casDepth():number {
    return this.hashConfig.casDepth;
  }

  private contentCasDir(contentAddress:string):string {
    // as of ts-node v9.1.1, we need Array<string> cast to prevent compiler error on the subsequent join
    //const casDirs1:any = rangeMap(this.casDepth, (i:number) => contentAddress.slice(i*this.casWidth, (i+1)*this.casWidth));
    const casDirs = rangeMap(this.casDepth, (i:number) => contentAddress.slice(i*this.casWidth, (i+1)*this.casWidth)) as Array<string>;
    //console.log('casDirs:', JSON.stringify(casDirs));
    const contentCasDir = join(...casDirs);

      randomThrow && randomThrow(0.05, 'Storage.contentCasDir');

    return contentCasDir;
  }

/*
    // TODO: abstract casRootname, casRootDirname, etc
    const casWidth = 2;
    const casDepth = 2;

    for (let foo of range(casDepth)) {
      console.log('foo:', foo);
    }
    //console.log('bar:', JSON.stringify(range(casDepth).map(i => i)));
    //console.log('baz:', JSON.stringify(Array(range(casDepth))));
    console.log('bat:', JSON.stringify(Array.from(range(casDepth))));

    //const dirs = Array.from(range(casDepth)).map((i:number) => contentAddress.slice(i, i+2));
    const dirs:any = rangeMap(casDepth, (i:number) => contentAddress.slice(i*casWidth, (i+1)*casWidth));
    console.log('dirs:', JSON.stringify(dirs));
    const contentCasDir = join(...dirs);
*/

  private async move(payload) {
    const { timestamp, filename, contentAddress, sizeBytes, uploadBytesPerSecond, upoadTag } = payload;

    try {

      // early sanity check
	randomThrow && randomThrow(0.05, 'access(filename)');
      await access(filename, fsConstants.R_OK);

      const contentCasDir = this.contentCasDir(contentAddress);
      const contentCasPath = join(contentCasDir, contentAddress);
      const targetFilename = join(this.casRootDirname, contentCasPath);
      console.log('move:', JSON.stringify({filename, contentAddress, contentCasPath, targetFilename}));

      // we go to some lengths to make sure that we return an accurate value of isDuplicate
      let isDuplicate = await access(targetFilename, fsConstants.R_OK)
          .then(() => true)
          .catch(() => false);
      //const created = await access(targetFilename, fsConstants.R_OK).then(() => false).catch(() => true);
      //console.log('created:', created);
      if (!isDuplicate) {
        // create
	  randomThrow && randomThrow(0.05, 'mkdirs');
        await mkdirs(join(this.casRootDirname, contentCasDir));
        //const path = await mkdirs(contentCasPath);
        //console.log('path:', JSON.stringify(path));
        //if (path) {
        //  await chmod(contentCasPath, DIR_MODE);
        //}
        // No error if we rename on top of a guy that got put there while we were awaiting, but
        // it means we return an incorrect value of isDuplicate
        //
        // Seems like a final synchronous access check and rename might be in order, really don't
        // want file-locking hell.  Also, DB access logic can probably be made to cope with this
        // inconsistency of false isDuplicate being incorrect

        isDuplicate = await access(targetFilename, fsConstants.R_OK)
          .then(() => true)
          .catch(() => false);

        if (!isDuplicate) {
          // one more time with synchronous feeling

          // If this single-threaded NodeJS process is the only process/thread that modifies
          // the storage file tree, then these two system calls are (expected to be) atomic
          // vis-a-vis isDuplicate
          try {
            accessSync(targetFilename, fsConstants.R_OK);
            isDuplicate = true;
          }
          catch {
	      randomThrow && randomThrow(0.05, 'renameSync');
            renameSync(filename, targetFilename);
          }
        }
        //await rename(filename, targetFilename);
        //await chmod(targetFilename, FILE_MODE);
      }

      if (isDuplicate) {
	  randomThrow && randomThrow(0.05, 'unlink');
        // leave 5% of duplicates lying around
        if (Date.now() % 100 + 1 >= 5) {
          await unlink(filename);
        }
      }

      return {
        ...payload,
	contentCasPath,
	isDuplicate,
      };
/*
	return {
	    tag,
	    sizeBytes,
	    contentAddress,
	    contentCasPath,
	    isDuplicate,
	    uploadBytesPerSecond,
	};
*/
    }
    catch (error) {
      rethrow({ error, payload, catchTag: 'Storage.move catch' });
    }
/*
    catch (error) {
      if (error.timestamp === timestamp) throw error;

      throw {
        ...payload,
        catch: 'Storage.move catch',
        error: true,
        errors: [ errorObject(error) ],
        // TODO: move to some top-level sanitizer...
        contentAddress: undefined,
      };
    }
*/

/*
    catch (error) {
	console.log(`move caught error: ${upoadTag} : ${error}`);
	throw errorObject(error);
	//throw new Error(`Storage move error: ${error}`);
    }
*/

  }

  async storeStream(config: { inStream: NodeJS.ReadableStream; uploadTag: string|void; }) {
    const timestamp = hrHrTimestamp();

    let payload: StoragePayload = { ...config, timestamp };
    //const inStream:NodeJS.ReadableStream, uploadTag:string|void = undefined
    //const incame = await this.incomingStream({ uploadTag, timestamp, inStream });
    //const incame = await this.incomingStream({ ...payload, timestamp });
    payload = await this.incomingStream(payload);
    //const moveResult = await this.move(incame);
    payload = await this.move(payload);

    return payload;
    //return moveResult;
    //const result = this.validate(moveResult);
    //return result;
    /*
      try {
      const incame = await this.incomingStream(readable, uploadTag);
      const result = await this.move(incame);

      return result;
      }
      catch (error) {
      console.log(`storeStream caught error: ${uploadTag} : ${error} : ${JSON.stringify(error)}`);
      throw error;
      }
    */

  }

}

import { createReadStream } from 'fs';

if (require.main === module) {

  const main = (args) => {
    console.log('main(): args:', '\n' + args.join('\n'));

    const options = {
      //incomingDirname: '/Volumes/NoSpaceLeftOnDevice/incoming',
      //casRootDirname: '/Volumes/NoSpaceLeftOnDevice/cas',
      //incomingDirname: '/tmp/storage/incoming',
      //casRootDirname: '/tmp/storage/cas',
      incomingDirname: '/home/hugh/work/file-storage/no-space-left-on-device/incoming',
      casRootDirname: '/home/hugh/work/file-storage/no-space-left-on-device/cas',
    };

    const storage = new Storage(options);

    const storeStream = filename => storage.storeStream({
      inStream: createReadStream(filename),
      uploadTag: basename(filename),
    });

    return promiseAllJson(args.map(storeStream));

//    const work = promiseAllJson(args.map(filename => storage.storeStream(createReadStream(filename), basename(filename))));

//    return work;
  };

  main(process.argv.slice(2))
    .then(result => console.log('result:\n', JSON.stringify(result)))
    .then(() => setTimeout(() => console.log('setTimeout'), 700))
    .catch(error => {
      console.log('fail:', error, '\n*** fail ***');
      process.nextTick(() => process.exit(1));
    })
  ;
}
