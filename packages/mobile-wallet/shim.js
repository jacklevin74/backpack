import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;

// Crypto shims
import crypto from 'crypto-browserify';
global.crypto = crypto;

// Stream shim
import { Readable } from 'stream-browserify';
global.Readable = Readable;
