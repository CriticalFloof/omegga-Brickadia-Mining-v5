import * as og from "omegga";
import { MAX_INT } from "./brs-js_constants";
import { uuidParse } from './brs-js_uuid';

export function concat(...arrays: Uint8Array[]): Uint8Array {
    const buffLen = arrays.reduce((sum, value) => sum + value.length, 0);
    const buff = new Uint8Array(buffLen);
  
    // for each array - copy it over buff
    // next array is copied right after the previous one
    let length = 0;
    for (const array of arrays) {
      buff.set(array, length);
      length += array.length;
    }
  
    return buff;
  }

export function isEqual<T>(arrA: Array<T>, arrB: Array<T>): boolean {
  return arrA.length === arrB.length && arrA.every((a: T, i) => arrB[i] === a);
}

function write_u16(num: number, littleEndian = true): Uint8Array {
    const data = [num & 255, (num >> 8) & 255];
    return new Uint8Array(!littleEndian ? data.reverse() : data);
}

function write_i32(num: number, littleEndian = true): Uint8Array {
    const data = new Uint8Array([
      num & 255,
      (num >> 8) & 255,
      (num >> 16) & 255,
      (num >> 24) & 255,
    ]);
  
    return !littleEndian ? data.reverse() : data;
}

function write_uncompressed(...args: Uint8Array[]): Uint8Array {
    // Concat the args to one massive array
    const data = concat(...args);
  
    // Build the output
    return concat(write_i32(data.length), write_i32(0), data);
  }

function isASCII(text: string): boolean {
    return /^[\x00-\x7F]*$/.test(text);
}

function write_string(str: string): Uint8Array {
    if (isASCII(str)) {
      return concat(
        write_i32(str.length + 1), // Write string length (+ null term)
        new Uint8Array(str.split('').map(s => s.charCodeAt(0))), // Write string as bytes
        new Uint8Array([0]) // Null terminator
      );
    } else {
      // ucs2 strings denoted by negative length
      const len = -str.length;
      return concat(
        write_i32(len), // write length
        // convert string to little endian ucs2
        new Uint8Array(
          str
            .split('')
            .flatMap(s => [s.charCodeAt(0) & 0xff, s.charCodeAt(0) >> 8])
        )
        // new Uint8Array([0]) // Null terminator
      );
    }
}

function isBRSBytes(data: og.Bytes): data is og.BRSBytes {
    return (data as og.BRSBytes).brsOffset !== undefined;
  }

export function chunk(arr: og.Bytes, size: number): og.BRSBytes[] {
    // relative length based on the offset of the array's data view
    const length = arr.length - (isBRSBytes(arr) ? arr.brsOffset : 0);
  
    // out array of chunks pre-allocated
    const out = Array(Math.floor(length / size));
  
    for (let i = 0; i < length / size; i++) {
      out[i] = subarray(arr, size, true);
    }
  
    return out;
}

export function subarray(data: og.Bytes, len: number, isCopy = false): Uint8Array {
    if (!(data instanceof Uint8Array)) {
      throw new Error(`Invalid data type in bytes reader (${typeof data})`);
    }
  
    let bytes: og.BRSBytes;
    if (!isBRSBytes(data)) {
      bytes = data as og.BRSBytes;
      bytes.brsOffset = 0;
    } else {
      bytes = data;
    }
  
    const chunk = bytes[isCopy ? 'slice' : 'subarray'](
      bytes.brsOffset,
      bytes.brsOffset + len
    );
    bytes.brsOffset += len;
    return chunk;
  }
  

function write_uuid(uuid: og.Uuid) {
    return concat(
      ...chunk(uuidParse(uuid), 4).map(
        ([a, b, c, d]) => new Uint8Array([d, c, b, a])
      )
    );
}

function write_array<T>(arr: T[], fn: (_: T) => Uint8Array) {
    return concat(write_i32(arr.length), ...arr.map(o => fn(o)));
}

export const bgra = ([b, g, r, a]: number[]): [
    number,
    number,
    number,
    number
  ] => [r, g, b, a];

export class BitWriter {
    buffer: number[] = [];
    cur: number = 0;
    bitNum: number = 0;
  
    // Write a boolean as a bit
    bit(val: boolean) {
      this.cur |= (val ? 1 : 0) << this.bitNum;
      this.bitNum++;
      if (this.bitNum >= 8) {
        this.align();
      }
    }
  
    // Write `len` bits from `src` bytes
    bits(src: number[] | Uint8Array, len: number) {
      for (let bit = 0; bit < len; bit++) {
        this.bit((src[bit >> 3] & (1 << (bit & 7))) !== 0);
      }
    }
  
    // Write multiple bytes
    bytes(src: number[] | Uint8Array) {
      this.bits(src, 8 * src.length);
    }
  
    // Push the current bit into the buffer
    align() {
      if (this.bitNum > 0) {
        this.buffer.push(this.cur);
        this.cur = 0;
        this.bitNum = 0;
      }
    }
  
    // Write an int up to the potential max size
    int(value: number, max: number) {
      if (max < 2) {
        throw new Error(
          `Invalid input (BitWriter) -- max (${max}) must be at least 2`
        );
      }
  
      if (value >= max) {
        throw new Error(
          `Invalid input (BitWriter) -- value (${value}) is larger than max (${max})`
        );
      }
  
      let new_val = 0;
      let mask = 1;
  
      while (new_val + mask < max && mask !== 0) {
        this.bit((value & mask) !== 0);
        if ((value & mask) !== 0) {
          new_val |= mask;
        }
  
        mask <<= 1;
      }
    }
  
    // Write a packed unsigned int
    uint_packed(value: number) {
      do {
        const src = value & 0b1111111;
        value >>= 7;
        this.bit(value !== 0);
        this.bits([src], 7);
      } while (value !== 0);
    }
  
    // Write a packed integer
    int_packed(value: number) {
      this.uint_packed((Math.abs(value) << 1) | (value >= 0 ? 1 : 0));
    }
  
    // Return built buffer
    finish(): Uint8Array {
      this.align();
      return new Uint8Array(this.buffer);
    }
  
    // Return built buffer (and include length)
    finishSection() {
      this.align();
      return concat(write_i32(this.buffer.length), new Uint8Array(this.buffer));
    }
  
    // write a string
    string(str: string) {
      this.bytes(write_string(str));
    }
  
    float(num: og.UnrealFloat) {
      // create a float array
      const floatArr = new Float32Array(1);
      // assign the number
      floatArr[0] = num;
      // convert it into a byte array
      const bytes = new Int8Array(floatArr.buffer);
      this.bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
    }
  
    // run a function with `this` as a BitReader
    self(fn: (this: BitWriter) => void) {
      fn.bind(this)();
      return this;
    }
  
    // write an array
    array<T>(arr: T[], fn: (this: BitWriter, item: T, index: number) => void) {
      this.bytes(write_i32(arr.length));
      arr.forEach(fn.bind(this));
      return this;
    }
  
    // write things from an array
    each<T>(arr: T[], fn: (this: BitWriter, item: T, index: number) => void) {
      arr.forEach(fn.bind(this));
      return this;
    }

    // write unreal types
    unreal(type: string, value: og.UnrealType) {
      switch (type) {
        case 'Class':
          if (typeof value !== 'string') {
            throw new Error(
              `writing unreal type Class, did not receive string (${value})`
            );
          }
          this.string(value);
          return;
        case 'String':
          if (typeof value !== 'string') {
            throw new Error(
              `writing unreal type String, did not receive string (${value})`
            );
          }
          this.string(value);
          return;
        case 'Object':
          if (typeof value !== 'string') {
            throw new Error(
              `writing unreal type Object, did not receive string (${value})`
            );
          }
          this.string(value);
          return;
        case 'Boolean':
          if (typeof value !== 'boolean') {
            throw new Error(
              `writing unreal type Boolean, did not receive boolean (${value})`
            );
          }
          this.bytes(write_i32(value ? 1 : 0));
          return;
        case 'Float':
          if (typeof value !== 'number') {
            throw new Error(
              `writing unreal type Float, did not receive float (${value})`
            );
          }
          this.float(value);
          return;
        case 'Byte':
          if (typeof value !== 'number') {
            throw new Error(
              `writing unreal type Byte, did not receive Byte (${value})`
            );
          }
          this.bytes([value & 255]);
          return;
        case 'Color':
          if (!Array.isArray(value) || value.length !== 4) {
            throw new Error(
              `writing unreal type Array, did not receive Array (${value})`
            );
          }
          this.bytes(bgra(value));
          return;
        case 'Rotator':
          if (!Array.isArray(value) || value.length !== 3) {
            throw new Error(
              `writing unreal type Array, did not receive Array (${value})`
            );
          }
  
          this.float(value[0]);
          this.float(value[1]);
          this.float(value[2]);
          return;
      }
      throw new Error('Unknown unreal type ' + type);
    }
  }

export const write = {
    u16: write_u16,
    i32: write_i32,
    uncompressed: write_uncompressed,
    string: write_string,
    uuid: write_uuid,
    array: write_array,
    bits: () => new BitWriter(),
};

