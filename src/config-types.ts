// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

// Debugging features
export type DebugFeatures =
      'Run API Tests'
    | 'Run Unsafe API Tests'
    | 'Log Endpoint Debug'
    | 'Log API Headers'
    | 'Log API Bodies'
    | 'Log Appliance IDs'
    | 'Log Debug as Info';

// The user plugin configuration
export interface Config {
    // Matterbridge additions
    name:                   string;
    type:                   string;
    version:                string;
    whiteList:              string[];
    blackList:              string[];
    // Plugin configuration
    apiKey:                 string;
    accessToken:            string;
    accessTokenURL?:        string;
    refreshToken:           string;
    pollIntervalSeconds:    number;
    enableServerRvc:        boolean;
    debug:                  boolean;
    debugFeatures:          DebugFeatures[];
    unregisterOnShutdown:   boolean;
}