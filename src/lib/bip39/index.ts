import { english } from './wordlists/english';

const RADIX = 2048; // 2^11

function bytesToBinary(bytes: Uint8Array): string {
    return bytes.reduce((acc, b) => acc + b.toString(2).padStart(8, '0'), '');
}

function binaryToBytes(bin: string): Uint8Array {
    const chunks = bin.match(/.{1,8}/g) || [];
    return new Uint8Array(chunks.map((b) => parseInt(b.padEnd(8, '0'), 2)));
}

async function sha256(data: Uint8Array): Promise<Uint8Array> {
    const h = await crypto.subtle.digest('SHA-256', data as unknown as BufferSource);
    return new Uint8Array(h);
}

async function deriveChecksumBits(entropy: Uint8Array): Promise<string> {
    const cs = entropy.length * 8 / 32; // checksum length in bits
    const hash = await sha256(entropy);
    return bytesToBinary(hash).slice(0, cs);
}

export async function generateMnemonic(strength: 128 | 160 | 192 | 224 | 256 = 256): Promise<string> {
    if (![128, 160, 192, 224, 256].includes(strength)) throw new Error('Invalid strength');
    const entropy = crypto.getRandomValues(new Uint8Array(strength / 8));
    const entropyBits = bytesToBinary(entropy);
    const checksumBits = await deriveChecksumBits(entropy);
    const bits = entropyBits + checksumBits;
    const chunks = bits.match(/.{1,11}/g) || [];
    const words = chunks.map((bin) => english[parseInt(bin, 2)]);
    return words.join(' ');
}

export async function validateMnemonic(mnemonic: string): Promise<boolean> {
    const words = mnemonic.trim().toLowerCase().split(/\s+/).filter(Boolean);
    if (![12, 15, 18, 21, 24].includes(words.length)) return false;
    const bits = words.map((w) => {
        const i = english.indexOf(w);
        if (i === -1) return null;
        return i.toString(2).padStart(11, '0');
    });
    if (bits.some((b) => b === null)) return false;
    const bin = (bits as string[]).join('');
    const csLen = words.length / 3; // checksum bits
    const entropyBits = bin.slice(0, bin.length - csLen);
    const checksumBits = bin.slice(-csLen);
    const entropy = binaryToBytes(entropyBits);
    const newChecksum = await deriveChecksumBits(entropy);
    return newChecksum.slice(0, csLen) === checksumBits;
}
