// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { Config } from './config-types.js';

// Read the package.json file
interface PackageJson {
    engines:        Record<string, string>;
    name:           string;
    displayName:    string;
    version:        string;
    homepage:       string;
}
const PACKAGE_JSON = join(dirname(fileURLToPath(import.meta.url)), '..', 'package.json');
const PACKAGE = JSON.parse(readFileSync(PACKAGE_JSON, 'utf-8')) as PackageJson;

// Platform identifiers
export const ENGINES        = PACKAGE.engines;
export const PLUGIN_NAME    = PACKAGE.name;
export const PLATFORM_NAME  = PACKAGE.displayName;
export const PLUGIN_VERSION = PACKAGE.version;
export const PLUGIN_URL     = PACKAGE.homepage;

// Daily API rate limit, and lower value to use for polling
export const API_DAILY_LIMIT = 5000;
export const API_DAILY_POLL_LIMIT = API_DAILY_LIMIT * 0.9;

// Default configuration options
export const DEFAULT_CONFIG: Partial<Config> = {
    whiteList:              [],
    blackList:              [],
    pollIntervalSeconds:    30, // 2880 calls/day per robot vacuum cleaner
    enableServerRvc:        true,
    logMapStyle:            'Matterbridge',
    debug:                  false,
    debugFeatures:          [],
    unregisterOnShutdown:   false
};

// Allow API and authorization credentials to be set via environment variables
if (process.env.ELECTROLUX_API_KEY) {
    DEFAULT_CONFIG.apiKey = process.env.ELECTROLUX_API_KEY;
}
if (process.env.ELECTROLUX_ACCESS_TOKEN_URL) {
    Object.assign(DEFAULT_CONFIG, {
        accessTokenURL: process.env.ELECTROLUX_ACCESS_TOKEN_URL,
        accessToken:    '',
        refreshToken:   ''
    });
}

// No certified AEG/Electrolux Matter products
export const VENDOR_ID = 0xFFF1; // Test Vendor #1