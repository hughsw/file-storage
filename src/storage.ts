import { accessSync, renameSync, realpathSync, constants as fsConstants, promises as fsPromises } from 'fs';
import { basename, join } from 'path';

import { AddressWritable } from './address-writeable';
//const { access } = fsPromises;
//import { defer } from './defer';
import { hrHrTimestamp, defer, rangeMap } from './utils';
import { DIR_MODE } from './constants';

const { access, mkdir, chmod, rename, unlink } = fsPromises;


const mkdirs = directory => mkdir(directory, { recursive: true, mode: DIR_MODE })
      .catch(error => {
        throw new Error(`unable to create directory '${directory}' : ${error.message}`);
      });


export class Storage {
  private incomingDirname: string;
  private casRootDirname: string;

  constructor(private options:{[key:string]: any;}) {
    // async and constructors don't mix easily, so we use sync for these (infrequent) checks
    accessSync(this.options.incomingDirname, fsConstants.R_OK | fsConstants.W_OK);
    accessSync(this.options.casRootDirname, fsConstants.R_OK | fsConstants.W_OK);

    this.incomingDirname = realpathSync(this.options.incomingDirname);
    this.casRootDirname = realpathSync(this.options.casRootDirname);

    console.log('this:', JSON.stringify(this));
  }


  private incomingStream(readable:NodeJS.ReadableStream, tag:string|void) {
    const tempName = hrHrTimestamp() + (tag ? ('__' + tag) : '');
    const addressWritable = new AddressWritable(readable, join(this.incomingDirname, tempName), tag);

    return addressWritable.runPipeline();
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
    return 2;
  }
  private get casDepth():number {
    return 2;
  }

  private contentCasDir(contentAddress:string):string {
    // as of ts-node v9.1.1, we need Array<string> cast to prevent compiler error on the subsequent join
    //const casDirs1:any = rangeMap(this.casDepth, (i:number) => contentAddress.slice(i*this.casWidth, (i+1)*this.casWidth));
    const casDirs = rangeMap(this.casDepth, (i:number) => contentAddress.slice(i*this.casWidth, (i+1)*this.casWidth)) as Array<string>;
    //console.log('casDirs:', JSON.stringify(casDirs));
    const contentCasDir = join(...casDirs);
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

  private async move(incame) {
    try {
      const { filename, contentAddress, sizeBytes, tag } = incame;

      // early sanity check
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
            renameSync(filename, targetFilename);
          }
        }
        //await rename(filename, targetFilename);
        //await chmod(targetFilename, FILE_MODE);
      }

      if (isDuplicate) {
        // leave 5% of duplicates lying around
        if (Date.now() % 100 + 1 >= 5) {
          await unlink(filename);
        }
      }

      return { isDuplicate, contentAddress, sizeBytes, tag, contentCasPath };
    }
    catch (error) {
      throw new Error(`Storage move error: ${error}`);
    }
  }

  async storeStream(readable:NodeJS.ReadableStream, tag:string|void = undefined) {
    const incame = await this.incomingStream(readable, tag);

    return this.move(incame);
  }

}

import { createReadStream } from 'fs';

if (require.main === module) {

  const main = (args) => {
    console.log('main(): args:', args);

    const options = {
      incomingDirname: '/Volumes/NoSpaceLeftOnDevice/incoming',
      casRootDirname: '/Volumes/NoSpaceLeftOnDevice/cas',
      //incomingDirname: '/tmp/storage/incoming',
      //casRootDirname: '/tmp/storage/cas',
    };

    const storage = new Storage(options);

    //const work = Promise.all(args.map(filename => {
/*
    const work = Promise.allSettled(args.map(async filename => {
      const inputStream = createReadStream(join(filename));
      return storage.storeStream(inputStream, basename(filename));
    }));
*/


    const work = Promise.allSettled(args.map(async filename => {
      const inputStream = createReadStream(join(filename));
      try {
        const res = await storage.storeStream(inputStream, basename(filename));
        return res;
      }
      catch (error) {
        console.log(`main work catch 1: ${filename}`);
        console.log(`main work catch 2: ${filename} : ${error}`);
        console.log(`main work catch 3: ${filename} :`, JSON.stringify(error));
        //return { mainError: new Error(`main work catch: ${filename}`) };
        //throw new Error(`main work catch: ${filename}: ${error}`);
        throw new Error('fooner error');
        //throw new Error(`main work catch: ${filename}`);
        //throw new Error(`main catch: ${error}`);;
      }
    }));
    return work;
  };

  const mainX = (args) => {
    console.log('main(): args:', args);

    const { promise, resolve, reject } = defer();

    const options = {
      incomingDirname: '/Volumes/NoSpaceLeftOnDevice/incoming',
      casRootDirname: '/Volumes/NoSpaceLeftOnDevice/cas',
      //incomingDirname: '/tmp/storage/incoming',
      //casRootDirname: '/tmp/storage/cas',
    };


    try {
      const storage = new Storage(options);

      //const work = Promise.all(args.map(filename => {
      const work = Promise.allSettled(args.map(async filename => {
        const inputStream = createReadStream(join(filename));
        try {
          const res = await storage.storeStream(inputStream, basename(filename));
          return res;
        }
        catch (error) {
          throw new Error(`main catch: ${filename}`);
          //throw new Error(`main catch: ${error}`);;
        }

/*
        const res = await storage.storeStream(inputStream, basename(filename)).catch(error => `fooner: ${error}`);
        return {
          filename,
          res,
        };
*/
      }));

      resolve(work);
/*
      const inputFile = createReadStream(join(__dirname, 'index.ts'));
      //const inputFile = createReadStream(join('/Users/hugh/Downloads', 'FAA-H-8083-16B_Chapter_4.pdf'));
      const x = storage.storeStream(inputFile, 'test');

      const y = (new Array(5)).fill(0).map(_ => {
        const inputFile = createReadStream(join(__dirname, 'index.ts'));
        //const inputFile = createReadStream(join('/Users/hugh/Downloads', 'FAA-H-8083-16B_Chapter_4.pdf'));
        const x = storage.storeStream(inputFile, 'test');
        return x;
      });
      y.push(x);

      resolve(Promise.all(y));
*/

    }
    catch (error) {
      reject(`main error: ${error}`);
      //reject(error);
    }
    finally {
      return promise;
    }
  };

  main(process.argv.slice(2))
    .then(result => console.log('result:\n', JSON.stringify(result)))
    .then(() => setTimeout(() => console.log('setTimeout'), 700))
    .catch(error => {
      console.log(error);
      console.log('*** fail ***');
      process.nextTick(() => process.exit(1));
    })
  ;
}
