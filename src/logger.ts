// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { assertIsDefined, formatList, MS } from './utils.js';
import { checkers } from './ti/token-types.js';

// Mapping of applianceId values to their names
const applianceIds = new Map<string, string>();
const LENGTH = { pnc: 9, sn: 8, ai: 24 } as const;

// Regular expressions for different types of sensitive data
const filters: [(value: string) => string, RegExp][] = [
    [maskAPIKey,        /\w_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/],
    [maskAccessToken,   /\b[\w-]+\.[\w-]+\.[\w-]+\b/g],
    [maskRefreshToken,  /(?<="refreshToken":\s*")[^"]+(?=")/gi] // (within JSON)
];

// A logger with filtering and support for an additional prefix
export class PrefixLogger extends AnsiLogger {

    // Log level to be used for debug messages
    debugLevel: LogLevel = LogLevel.DEBUG;

    // Create a new logger
    constructor(readonly delegate: AnsiLogger, readonly prefix?: string) {
        super({
            extLog:                     delegate,
            logTimestampFormat:         delegate.logTimestampFormat,
            logCustomTimestampFormat:   delegate.logCustomTimestampFormat
        });
    }

    // Get and set the log level (in the delegate logger)
    get logLevel(): LogLevel         { return this.delegate.logLevel; }
    set logLevel(logLevel: LogLevel) { this.delegate.logLevel = logLevel; }

    // Get and set the log name (in the delegate logger)
    get logName(): string            { return this.delegate.logName; }
    set logName(logName: string)     { this.delegate.logName = logName; }

    // Log a message with sensitive data filtered
    override log(level: LogLevel, message: string, ...parameters: unknown[]): void {
        // Allow debug messages to be logged as a different level
        if (level === LogLevel.DEBUG) level = this.debugLevel;

        // Filter the log message and parameters
        const filteredMessage    = PrefixLogger.filterSensitive(message);
        const filteredParameters = parameters.map(p => PrefixLogger.filterSensitive(p));

        // Call the delegate directly (not super.log) to avoid double-logging
        const savedLogName = this.delegate.logName;
        try {
            if (this.prefix) this.delegate.logName = `${savedLogName} - ${this.prefix}`;
            this.delegate.log(level, filteredMessage, ...filteredParameters);
        } finally {
            this.delegate.logName = savedLogName;
        }
    }

    // Log all DEBUG messages as INFO to avoid being dropped by Homebridge
    logDebugAsInfo(): void {
        this.debugLevel = LogLevel.INFO;
    }

    // Attempt to filter sensitive data within the log message
    static filterSensitive<T>(value: T): string | T {
        const { filtered, redacted } = filterString(String(value));
        let jsonRedacted = true;
        try { jsonRedacted = filterString(JSON.stringify(value)).redacted; } catch { /* empty */ }
        return redacted || jsonRedacted ? filtered : value;
    }

    // Add an applianceId to filter
    static addApplianceId(applianceId: string, name?: string): void {
        if (applianceIds.has(applianceId)) return;
        name ??= `SN${applianceIds.size + 1}`;
        const serialNumber = applianceId.slice(LENGTH.pnc, LENGTH.pnc + LENGTH.sn);
        applianceIds.set(applianceId, name);
        filters.push(
            [maskSerialNumber.bind(null, name), new RegExp(`\\b${serialNumber}\\b`, 'g')],
            [maskApplianceId .bind(null, name), new RegExp(`\\b${applianceId}\\b`, 'g')]
        );
    }
}

// Filter sensitive data within a string
function filterString(value: string): { filtered: string, redacted: boolean } {
    const filtered = filters.reduce((value, [mask, regex]) => value.replace(regex, mask), value);
    return { filtered, redacted: filtered !== value };
}

// Mask an Electrolux Group API Key
function maskAPIKey(apiKey: string): string {
    return maskToken('API_KEY', apiKey);
}

// Mask an Electrolux Group API refresh token
function maskRefreshToken(token: string): string {
    return maskToken('REFRESH_TOKEN', token);
}

// Mask a Home Connect access token
function maskAccessToken(token: string): string {
    try {
        const parts = token.split('.').map(part => decodeBase64URL(part));
        assertIsDefined(parts[0]);
        assertIsDefined(parts[1]);
        const header:  unknown = JSON.parse(parts[0]);
        const payload: unknown = JSON.parse(parts[1]);
        if (checkers.AccessTokenHeader.test(header)
         && checkers.AccessTokenPayload.test(payload)) {
            return maskToken('ACCESS_TOKEN', token, {
                issued:     new Date(payload.iat * MS).toISOString(),
                expires:    new Date(payload.exp * MS).toISOString(),
                scope:      payload.scope
            });
        }
        return maskToken('JSON_WEB_TOKEN', token);
    } catch {
        return token;
    }
}

// Mask a serial number
function maskSerialNumber(name: string, _serialNumber: string): string {
    return `<SERIAL_NUMBER: "${name}">`;
}

// Mask an applianceId
function maskApplianceId(name: string, applianceId: string): string {
    const pnc = applianceId.slice(0, LENGTH.pnc);
    return `<PRODUCT_ID: ${pnc}... "${name}">`;
}

// Mask a token, leaving just the first and final few characters
function maskToken(type: string, token: string, details: Record<string, string> = {}): string {
    let masked = `${token.slice(0, 4)}...${token.slice(-8)}`;
    const parts = Object.entries(details).map(([key, value]) => `${key}=${value}`);
    if (parts.length) masked += ` (${formatList(parts)})`;
    return `<${type}: ${masked}>`;
}

// Decode a Base64URL encoded string
function decodeBase64URL(base64url: string): string {
    const paddedLength = base64url.length + (4 - base64url.length % 4) % 4;
    const base64 = base64url.replace(/-/g, '+').replace(/_/g, '/').padEnd(paddedLength, '=');
    return Buffer.from(base64, 'base64').toString();
}