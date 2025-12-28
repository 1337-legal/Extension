import Fortress from '@blindflare/fortress';

import SessionService from './SessionService';

// ---------------- Types & Guards ----------------
/**
 * A generic request body map.
 */
export type Body = Record<string, unknown>;

/**
 * Alias record returned by the backend.
 */
export interface AliasType {
    id?: string;
    alias?: string;
    address?: string;
    status?: 'active' | 'disabled';
    createdAt?: string;
    [k: string]: unknown;
}

/**
 * Auth response payload after successful authentication.
 */
export interface AuthType {
    user: {
        address: string;
        role: string;
    };
    token: string;
}

/**
 * The authenticated user's profile.
 */
export interface UserProfile {
    publicKey: string;
    address: string;
    pgpPublicKey: string | null;
    role?: string;
}

interface ServerHello {
    serverPub?: string;
    sessionKeyEnc?: {
        data: string;
        iv: string;
        tag: string;
        ephemeralPublicKey: string;
    };
    [k: string]: unknown;
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const hasToken = (v: unknown): v is { token: string } => isObject(v) && typeof (v as { token?: unknown }).token === 'string' && !!(v as { token: string }).token;

// Add a local meta type to satisfy Fortress encryptTransaction parameter shape
type BFMeta = { type: 'TX'; version: string; publicKey?: string; signature?: string;[k: string]: unknown };

/**
 * BackendService handles the Blindflare handshake, auth, encryption and all API calls.
 * It negotiates a session key with the server, signs requests, and transparently
 * encrypts/decrypts payloads when supported.
 */
class BackendService {
    /** Base URL of the backend (no trailing slash). */
    readonly domain = import.meta.env.VITE_BACKEND_URL;

    private session: {
        /** Ephemeral keypair used for the HELLO handshake. */
        privateKey: string | null;
        publicKey: string | null;
        /** Server's public key as advertised in HELLO. */
        serverPublicKey: string | null;
        /** Negotiated symmetric session key. */
        key: string | null;
    } = { privateKey: null, publicKey: null, serverPublicKey: null, key: null };

    private account: {
        token: string | null; // reserved for future use
        publicKey: string | null;
        privateKey: string | null;
    } = { token: null, publicKey: null, privateKey: null };

    private token: string | null = null;
    private helloDone = false;
    private initializing: Promise<void> | null = null;
    private readonly handshakeVersion = '1';

    constructor() {
        // Restore cached state
        const token = SessionService.getToken();
        if (token) this.token = token;

        const sessKey = SessionService.getSessionKey();
        if (sessKey) this.session.key = sessKey;

        const handshake = SessionService.getHandshakeKeys();
        if (handshake?.privateKey && handshake?.publicKey) {
            this.session.privateKey = handshake.privateKey;
            this.session.publicKey = handshake.publicKey;
        }

        const account = SessionService.getAccountKeys();
        if (account?.privateKey && account?.publicKey) {
            this.account.privateKey = account.privateKey;
            this.account.publicKey = account.publicKey;
        }

        // Pre-negotiate session in background
        this.ensureHello();
    }

    /** Returns the current bearer token, if any. */
    getToken() { return this.token; }

    /**
     * Authenticate using a mnemonic-derived account key.
     * - Ensures handshake and account keypair
     * - Signs and sends AUTH via sendRequest (signature inside sealed meta)
     * - Stores received JWT
     */
    async auth(mnemonic: string, address?: string) {
        this.resetAuth();
        await this.ensureHello();
        await this.ensureAccountKeyPair(mnemonic);

        if (!this.account.publicKey || !this.account.privateKey) throw new Error('Account keypair missing');
        if (!this.session.key) throw new Error('Session key missing');

        const signature = await this.signWith(this.account.privateKey, 'AUTH');
        const meta: BFMeta = { type: 'TX', version: Fortress.version };
        const body: Body = { publicKey: this.account.publicKey, signature };
        if (address) body.address = address;
        const { status, data } = await this.sendRequest('POST', '/api/v1/auth', body, meta);

        if (status >= 400) throw new Error('Auth failed');
        if (!hasToken(data)) throw new Error('Auth failed: no token');

        const token = data.token;
        this.token = token;
        SessionService.setToken(token);
    }

    /**
     * Send a request to the backend.
     * - Encrypts outbound payloads when a session key is available
     * - Decrypts inbound payloads when possible
     */
    public async sendRequest(
        method: string,
        endpoint: string,
        body?: Body,
        metaOverride?: BFMeta
    ): Promise<{ response: Response; status: number; data: unknown }> {
        if (!this.helloDone || !this.session.key) await this.ensureHello();

        const headers: Record<string, string> = {'Content-Type': 'application/json'};
        const token = this.token || SessionService.getToken();
        if (token) headers['Authorization'] = `Bearer ${token}`;
        if (this.session.key) headers['BF-Session-Key'] = await this.resealSessionKeyForServer();

        let outbound: string | undefined;
        if (method !== 'GET') {
            const meta: BFMeta = metaOverride || {type: 'TX', version: Fortress.version};
            const envelope = await Fortress.encryptTransaction({payload: body}, this.session.key!, meta) || {
                blindflare: meta,
                payload: body
            };
            outbound = JSON.stringify(envelope);
        }

        const response = await fetch(this.domain + endpoint, {method, headers, body: outbound});
        if (response.status === 401) {
            this.resetAuth();
            window.location.href = '/auth';
        }

        let data: unknown;
        try {
            const raw = await response.json();
            data = await Fortress.decryptTransaction(raw, this.session.key!);
        } catch {
            // Fallback to raw body on parse/decrypt errors
            try {
                data = await response.json();
            } catch {
                data = null;
            }
        }

        return {response, status: response.status, data};
    }

    /** Retrieve all aliases for the current user. */
    async listAliases(): Promise<AliasType[]> {
        const {data} = await this.sendRequest('GET', '/api/v1/alias');
        return Array.isArray(data) ? (data as AliasType[]) : [];
    }

    /** Create a new alias for the current user. */
    async createAlias(): Promise<AliasType> {
        const {data, status} = await this.sendRequest('PUT', '/api/v1/alias', {});
        if (status >= 400) throw new Error('Alias create failed');
        return data as AliasType;
    }

    /** Delete an alias by id or alias/address value. */
    async deleteAlias(record: AliasType): Promise<void> {
        if (record.id) {
            await this.sendRequest('DELETE', `/api/v1/alias/${record.id}`);
            return;
        }
        const alias = record.alias || record.address;
        if (alias) await this.sendRequest('DELETE', '/api/v1/alias', {alias});
    }

    /** Toggle alias status (active/disabled). */
    async toggleAliasStatus(record: AliasType): Promise<AliasType> {
        const address = record.alias || record.address;
        if (!address) throw new Error('Alias address required');
        const {data, status} = await this.sendRequest('PATCH', `/api/v1/alias/${encodeURIComponent(address)}`, {});
        if (status >= 400) throw new Error('Failed to toggle alias status');
        return data as AliasType;
    }

    /** Fetch the current user's profile. */
    async getUser(): Promise<UserProfile> {
        const {data, status} = await this.sendRequest('GET', '/api/v1/user');
        if (status >= 400) throw new Error('Failed to fetch user');
        return data as UserProfile;
    }

    /** Update the current user's profile. */
    async updateUser(update: { address?: string; pgpPublicKey?: string | null }): Promise<UserProfile> {
        const {data, status} = await this.sendRequest('PATCH', '/api/v1/user', update);
        if (status >= 400) throw new Error('Failed to update user');
        return data as UserProfile;
    }

    /**
     * Derive a 32-byte hex private key from a mnemonic using SHA-256.
     */
    private async derivePrivateKeyFromMnemonic(m: string): Promise<string> {
        const enc = new TextEncoder().encode(m.normalize('NFKD'));
        const hash = await crypto.subtle.digest('SHA-256', enc);
        return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 64);
    }

    /** Ensure the handshake keypair exists; create and cache if missing. */
    private async ensureHandshakeKeyPair() {
        if (this.session.privateKey && this.session.publicKey) return;

        const stored = SessionService.getHandshakeKeys();
        if (stored?.privateKey && stored?.publicKey) {
            this.session.privateKey = stored.privateKey;
            this.session.publicKey = stored.publicKey;
            return;
        }

        const bytes = new Uint8Array(32);
        crypto.getRandomValues(bytes);
        const priv = Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
        const { ec } = await import('elliptic');
        const curve = new ec('secp256k1');
        const key = curve.keyFromPrivate(priv, 'hex');
        const pub = key.getPublic('hex');
        this.session.privateKey = priv;
        this.session.publicKey = pub;
        SessionService.setHandshakeKeys({ privateKey: priv, publicKey: pub });
    }

    /** Ensure account keypair exists; derive and cache from mnemonic if needed. */
    private async ensureAccountKeyPair(mnemonic?: string) {
        if (this.account.privateKey && this.account.publicKey) return;

        const stored = SessionService.getAccountKeys();
        if (stored?.privateKey && stored?.publicKey) {
            this.account.privateKey = stored.privateKey;
            this.account.publicKey = stored.publicKey;
            return;
        }

        const m = mnemonic;
        if (!m) throw new Error('Mnemonic required for account auth');

        const privateKey = await this.derivePrivateKeyFromMnemonic(m);
        const { ec } = await import('elliptic');
        const curve = new ec('secp256k1');
        const key = curve.keyFromPrivate(privateKey, 'hex');
        const publicKey = key.getPublic('hex');

        this.account.privateKey = privateKey;
        this.account.publicKey = publicKey;
        // Do not persist plaintext mnemonic; only cache derived keys
        SessionService.setAccountKeys({ privateKey, publicKey });
    }

    /** Sign the given data using the provided private key through Fortress. */
    private async signWith(privateKey: string, data: string): Promise<string> {
        return Fortress.signData(data, privateKey);
    }

    /**
     * Ensure we have completed HELLO and negotiated a session key.
     * Uses an internal promise to coalesce parallel calls.
     */
    private async ensureHello() {
        if (this.helloDone && this.session.key) return;
        if (this.initializing) { await this.initializing; return; }

        this.initializing = (async () => {
            await this.ensureHandshakeKeyPair();
            await this.hello();
        })();

        try { await this.initializing; } finally { this.initializing = null; }
    }

    /** Perform the HELLO handshake with the server. */
    private async hello() {
        if (this.helloDone && this.session.key) return;
        if (!this.session.publicKey || !this.session.privateKey) throw new Error('Public key missing');

        const ver = this.handshakeVersion;
        const ts = Date.now();
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('');
        const payload = `HELLO|${ver}|${ts}|${nonce}|${this.session.publicKey}`;
        const signature = await this.signWith(this.session.privateKey, payload);

        const body = {
            blindflare: {
                type: 'HELLO',
                ver,
                publicKey: this.session.publicKey,
                nonce,
                ts,
                caps: { enc: ['aes-256-gcm'], ecc: ['secp256k1'], ser: ['json'] },
                signature
            }
        };

        const res = await fetch(`${this.domain}/api/v1/blindflare/hello`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('HELLO failed');

        const data = await res.json();
        try {
            const serverHelloRaw = (data as Record<string, unknown>)?.blindflare as unknown;
            if (isObject(serverHelloRaw)) {
                const serverHello = serverHelloRaw as ServerHello;
                if (typeof serverHello.serverPub === 'string') this.session.serverPublicKey = serverHello.serverPub;
                const enc = serverHello.sessionKeyEnc;
                if (enc && typeof enc === 'object') {
                    try {
                        const plaintext = await Fortress.decryptWithECC(enc, this.session.privateKey!);
                        const parsed = JSON.parse(plaintext);
                        if (parsed.key && typeof parsed.key === 'string') {
                            this.session.key = parsed.key;
                            SessionService.setSessionKey(parsed.key);
                        }
                    } catch (e) {
                        console.warn('[Blindflare] Failed to decrypt sessionKeyEnc', e);
                    }
                }
            }
        } catch (e) {
            console.warn('[Blindflare] HELLO parse error', e);
        }

        if (!this.session.key) throw new Error('Session key negotiation failed');
        this.helloDone = true;
    }

    /**
     * Clear auth and negotiated session state. Keeps handshake keys.
     */
    private resetAuth() {
        this.token = null;
        this.account.privateKey = null;
        this.account.publicKey = null;
        this.helloDone = false;

        SessionService.clearToken();
        SessionService.clearAccountKeys();
        SessionService.clearSessionKey();

        this.session.key = null;
        this.session.serverPublicKey = null;
    }

    /**
     * Wrap the negotiated session key for the server using its public key.
     * Returns a sealed value suitable for the BF-Session-Key header.
     */
    private async resealSessionKeyForServer(): Promise<string> {
        if (!this.session.key) {
            const stored = SessionService.getSessionKey();
            if (stored) this.session.key = stored;
        }
        if (!this.session.key) {
            console.warn('[Blindflare] Cannot seal session key: sessionKey missing');
            return '';
        }

        const targetPub = this.session.serverPublicKey;
        if (!targetPub) {
            console.warn('[Blindflare] Cannot seal session key: server public key missing');
            return '';
        }
        try {
            return Fortress.wrapSessionKey ? await Fortress.wrapSessionKey(targetPub, this.session.key) : '';
        } catch (e) {
            console.warn('[Blindflare] wrapSessionKey failed', e);
            return '';
        }
    }
}

export default new BackendService();