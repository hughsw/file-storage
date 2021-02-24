import { accessSync, renameSync, realpathSync, constants as fsConstants, promises as fsPromises } from 'fs';
import { basename, join } from 'path';

import { AddressWritable } from './address-writeable';
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


  private async incomingStream(payload: StoragePayload): Promise<StoragePayload> {
    const { inStream, timestamp, uploadTag } = payload;

    // Errors at this very high-level are not managed
    if (!inStream || !timestamp)
      throw new Error('Storage.incomingStream: mising property payload.inStream or payload.timestamp');

    try {
      const tempName = timestamp + (uploadTag ? ('__' + uploadTag) : '');
      const errName = randomError && randomError(0.05) ? 'no-such-dir' : undefined;
      const filename = errName ? join(this.incomingDirname, errName, tempName) : join(this.incomingDirname, tempName);

      const addressWritable = new AddressWritable();

      payload = await addressWritable.runPipeline({ ...payload, filename });
      delete payload.inStream;
      console.log('Storage.incomingStream runPipeline', JSON.stringify(payload));

      payload = await AddressWritable.validate3(payload);

      randomThrow && randomThrow(0.1, 'randomThrow: Storage.incomingStream');

      return payload;
    }
    catch (error) {
      rethrow({ error, payload, catchTag: 'Storage.incomingStream catch' });
    }

  }

  private get casWidth():number {
    return this.hashConfig.casWidth;
  }
  private get casDepth():number {
    return this.hashConfig.casDepth;
  }

  private contentCasDir(contentAddress:string):string {
    // as of ts-node v9.1.1, we need Array<string> cast to prevent compiler error on the subsequent join
    const casDirs = rangeMap(this.casDepth, (i:number) => contentAddress.slice(i*this.casWidth, (i+1)*this.casWidth)) as Array<string>;
    const contentCasDir = join(...casDirs);

      randomThrow && randomThrow(0.05, 'Storage.contentCasDir');

    return contentCasDir;
  }

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
      if (!isDuplicate) {
        // create
	  randomThrow && randomThrow(0.05, 'mkdirs');
        await mkdirs(join(this.casRootDirname, contentCasDir));

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
    }
    catch (error) {
      rethrow({ error, payload, catchTag: 'Storage.move catch' });
    }

  }

  async storeStream(config: { inStream: NodeJS.ReadableStream; uploadTag: string|void; }) {
    const timestamp = hrHrTimestamp();

    let payload: StoragePayload = { ...config, timestamp };
    payload = await this.incomingStream(payload);
    payload = await this.move(payload);

    // TODO: high-level valiation of moved file?

    return payload;

  }

}

import { createReadStream } from 'fs';

const safeCreateReadStream = (filename: string) => {
  const stream = createReadStream(filename);
  // if filename is a directory and an error handler is not installed, NodeJS will eventually crash with:
  //   Error: EISDIR: illegal operation on a directory, read
  //
  // It's important to install an error handler immediately (even if it doesn't do anything)
  // because if any exception occurs in the code path before the error handler is installed
  // (e.g. in some constructor), then the current tick can end and an error from this read
  // stream can crash Node JS...
  //
  stream.on('error', error => undefined);
  //stream.on('error', error => console.log(`safeCreateReadStream on error: filename '${filename}' : ${error}`));
  return stream;
};

if (require.main === module) {

  const main = (args) => {
    console.log('main(): args:', '\n' + args.join('\n'));

    //const streams = [args[0]].map(filename => createReadStream(filename));
    //const streams = args.map(filename => createReadStream(filename));
    //const streams = args.map(safeCreateReadStream);
    //const streams = args.map(createReadStream);
    //    console.log('streams:', streams);
    //console.log('streams:', JSON.stringify(streams));
    //return setTimeout(() => console.log('streams2:', JSON.stringify(streams)), 700);

    const options = {
      //incomingDirname: '/Volumes/NoSpaceLeftOnDevice/incoming',
      //casRootDirname: '/Volumes/NoSpaceLeftOnDevice/cas',
      //incomingDirname: '/tmp/storage/incoming',
      //casRootDirname: '/tmp/storage/cas',
      incomingDirname: '/home/hugh/work/file-storage/no-space-left-on-device/incoming',
      casRootDirname: '/home/hugh/work/file-storage/no-space-left-on-device/cas',
    };

    const storage = new Storage(options);

    const storeStream = filename => {
      console.log('storeStream: safeCreateReadStream:', filename);
      return storage.storeStream({
        //inStream: createReadStream(filename),
        inStream: safeCreateReadStream(filename),
        uploadTag: basename(filename),
      });
    };

    console.log('promiseAllJson: start');
    const ret = promiseAllJson(args.map(storeStream));
    console.log('promiseAllJson: done');
    return ret;

//    const work = promiseAllJson(args.map(filename => storage.storeStream(createReadStream(filename), basename(filename))));

//    return work;

  };

  Promise.resolve(main(process.argv.slice(2)))
    .then(result => console.log('result:\n', JSON.stringify(result)))
    .then(() => setTimeout(() => console.log('final setTimeout'), 700))
    .catch(error => {
      console.log('fail:', error, '\n*** fail ***');
      process.nextTick(() => process.exit(1));
    })
  ;
}
