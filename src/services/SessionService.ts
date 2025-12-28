class SessionService {
    private STORAGE_KEYS = {
        token: 'token',
        user: 'user',
        handshake: 'bf_handshake_keys',
        account: 'bf_account_keys',
        sessionKey: 'bf_session_key',
        mnemonic: 'bf_mnemonic',
        mnemonicEnc: 'bf_mnemonic_enc',
    } as const;

    // ------- Token -------
    public setToken(data: string) {
        localStorage.setItem(this.STORAGE_KEYS.token, data);
    }
    public getToken(): string | null {
        return localStorage.getItem(this.STORAGE_KEYS.token);
    }
    public clearToken() {
        localStorage.removeItem(this.STORAGE_KEYS.token);
    }

    // ------- User -------
    public setUser(data: { displayName: string; role: string }) {
        localStorage.setItem(this.STORAGE_KEYS.user, JSON.stringify(data));
    }
    public getUser(): { displayName: string; role: string } | null {
        const raw = localStorage.getItem(this.STORAGE_KEYS.user);
        if (!raw) return null;
        try { return JSON.parse(raw) as { displayName: string; role: string }; } catch { return null; }
    }
    public clearUser() {
        localStorage.removeItem(this.STORAGE_KEYS.user);
    }

    // ------- Handshake (ephemeral) keypair -------
    public setHandshakeKeys(data: { privateKey: string; publicKey: string }) {
        localStorage.setItem(this.STORAGE_KEYS.handshake, JSON.stringify(data));
    }
    public getHandshakeKeys(): { privateKey: string; publicKey: string } | null {
        const raw = localStorage.getItem(this.STORAGE_KEYS.handshake);
        if (!raw) return null;
        try { return JSON.parse(raw) as { privateKey: string; publicKey: string }; } catch { return null; }
    }
    public clearHandshakeKeys() {
        localStorage.removeItem(this.STORAGE_KEYS.handshake);
    }

    // ------- Account (user) keypair -------
    public setAccountKeys(data: { privateKey: string; publicKey: string }) {
        localStorage.setItem(this.STORAGE_KEYS.account, JSON.stringify(data));
    }
    public getAccountKeys(): { privateKey: string; publicKey: string } | null {
        const raw = localStorage.getItem(this.STORAGE_KEYS.account);
        if (!raw) return null;
        try { return JSON.parse(raw) as { privateKey: string; publicKey: string }; } catch { return null; }
    }
    public clearAccountKeys() {
        localStorage.removeItem(this.STORAGE_KEYS.account);
    }

    // ------- Session key -------
    public setSessionKey(key: string) {
        localStorage.setItem(this.STORAGE_KEYS.sessionKey, key);
    }
    public getSessionKey(): string | null {
        return localStorage.getItem(this.STORAGE_KEYS.sessionKey);
    }
    public clearSessionKey() {
        localStorage.removeItem(this.STORAGE_KEYS.sessionKey);
    }

    // ------- Mnemonic (plaintext) DEPRECATED -------
    public setMnemonic(_m: string) {
        // Deprecated: do not persist plaintext; ensure legacy key is removed
        void _m; // mark as used
        try { localStorage.removeItem(this.STORAGE_KEYS.mnemonic); } catch (e) { console.warn('clear mnemonic failed', e); }
    }
    public getMnemonic(): string | null {
        // Deprecated: stop returning plaintext mnemonic
        return null;
    }
    public clearMnemonic() {
        localStorage.removeItem(this.STORAGE_KEYS.mnemonic);
    }

    // ------- Encrypted Mnemonic -------
    public setEncryptedMnemonic(blob: string) {
        localStorage.setItem(this.STORAGE_KEYS.mnemonicEnc, blob);
    }
    public getEncryptedMnemonic(): string | null {
        return localStorage.getItem(this.STORAGE_KEYS.mnemonicEnc);
    }
    public clearEncryptedMnemonic() {
        localStorage.removeItem(this.STORAGE_KEYS.mnemonicEnc);
    }
}

export default new SessionService();