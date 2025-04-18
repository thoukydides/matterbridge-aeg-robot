// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { Matterbridge, PlatformConfig } from 'matterbridge';
import { AnsiLogger } from 'matterbridge/logger';
import { PlatformRX9 } from './platform.js';

// Register the platform with Matterbridge
export default function initializePlugin(
    matterbridge:   Matterbridge,
    log:            AnsiLogger,
    config:         PlatformConfig
): PlatformRX9 {
    return new PlatformRX9(matterbridge, log, config);
}
