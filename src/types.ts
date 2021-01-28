import { BinaryToTextEncoding } from 'crypto';

//import { constants, BinaryToTextEncoding } from 'crypto';
//type  BinaryToTextEncoding  = constants.BinaryToTextEncoding;
//type  BinaryToTextEncoding  = constants.BinaryToTextEncoding;

export interface HashConfig {
    hashType:string;
    //hashDigest:string;
    //hashDigest:NodeJS.BinaryToTextEncoding;
    hashDigest:'hex'&BinaryToTextEncoding;
    casWidth:number;
    casDepth:number;
}

export const defaultHashConfig = ():HashConfig => ({
    //hashType: 'md5',
    //hashType: 'sha1',
    hashType: 'sha224',
    //hashType: 'sha256',
    //hashType: 'sha512',
    //hashType: 'whirlpool',
        hashDigest: 'hex',
    //    hashDigest: 'base64',
    casWidth: 2,
    casDepth: 2,
});
