// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

// POST /api/v1/token/refresh
export interface PostTokenRefresh {
    refreshToken:       string;
}
export interface Tokens {
    accessToken:        string;
    expiresIn:          number;
    tokenType:          'Bearer';
    refreshToken:       string;
    scope:              string;
}

// POST /api/v1/token/revoke
export interface PostTokenRevoke {
    refreshToken:       string;
}

// Storage format for a token (with an absolute expiry time)
export interface AbsoluteTokens {
    accessToken:    string;
    refreshToken:   string;
    expiresAt:      number;
}