import { constants as fsConstants } from 'fs';

export const DIR_MODE = fsConstants.S_IRUSR | fsConstants.S_IWUSR | fsConstants.S_IXUSR | fsConstants.S_IRGRP | fsConstants.S_IXGRP;
export const FILE_MODE = fsConstants.S_IRUSR | fsConstants.S_IRGRP;
