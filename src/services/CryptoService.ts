export async function encryptMnemonic(passcode: string, mnemonic: string): Promise<string> {
    const enc = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passcode),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );

    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv as unknown as BufferSource },
        key,
        enc.encode(mnemonic)
    );

    const payload = {
        v: 1,
        algo: 'AES-GCM',
        kdf: 'PBKDF2',
        iter: 100000,
        salt: bufferToBase64(salt),
        iv: bufferToBase64(iv),
        data: bufferToBase64(new Uint8Array(ciphertext))
    } as const;

    return JSON.stringify(payload);
}

export async function decryptMnemonic(passcode: string, payload: string): Promise<string> {
    const enc = new TextEncoder();
    const dec = new TextDecoder();

    const obj = JSON.parse(payload) as { v: number; algo: string; kdf: string; iter: number; salt: string; iv: string; data: string };
    const salt = base64ToBuffer(obj.salt);
    const iv = base64ToBuffer(obj.iv);
    const data = base64ToBuffer(obj.data);

    const keyMaterial = await crypto.subtle.importKey(
        'raw',
        enc.encode(passcode),
        'PBKDF2',
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: salt as unknown as BufferSource,
            iterations: obj.iter || 100000,
            hash: 'SHA-256'
        },
        keyMaterial,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const plaintext = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: iv as unknown as BufferSource }, key, data as unknown as BufferSource);
    return dec.decode(plaintext);
}

function bufferToBase64(buf: Uint8Array): string {
    let binary = '';
    for (let i = 0; i < buf.length; i++) binary += String.fromCharCode(buf[i]);
    return btoa(binary);
}

function base64ToBuffer(b64: string): Uint8Array {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}
