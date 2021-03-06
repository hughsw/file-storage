import { BinaryToTextEncoding } from 'crypto';

export interface HashConfig {
    hashType: string;
    hashDigest: 'hex' & BinaryToTextEncoding;
    casWidth: number;
    casDepth: number;
}

export const defaultHashConfig = ():HashConfig => ({
    //hashType: 'md5',
    //hashType: 'sha1',
    hashType: 'sha224',
    //hashType: 'sha256',
    //hashType: 'sha512',
    //hashType: 'whirlpool',
    hashDigest: 'hex',

    casWidth: 2,
    casDepth: 2,
});
