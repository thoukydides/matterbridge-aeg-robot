// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    Matterbridge,
    MatterbridgeDynamicPlatform,
    PlatformConfig
} from 'matterbridge';
import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import NodePersist from 'node-persist';
import Path from 'path';
import { checkDependencyVersions } from './check-versions.js';
import { Config } from './config-types.js';
import { checkConfiguration } from './check-configuration.js';
import { DeviceRX9 } from './device-rx9.js';
import { PrefixLogger } from './logger.js';
import { AEGAccount } from './aeg-account.js';
import { logError, plural } from './utils.js';
import { PLATFORM_NAME, PLUGIN_NAME } from './settings.js';

// A Matterbridge AEG RX 9 / Electrolux Pure i9 platform
export class PlatformRX9 extends MatterbridgeDynamicPlatform {

    // Strongly typed configuration
    declare config: Config & PlatformConfig;

    // Persistent storage
    persist:        NodePersist.LocalStorage;

    // Active devices
    devices:        DeviceRX9[] = [];

    // Constructor
    constructor(matterbridge: Matterbridge, log: AnsiLogger, config: PlatformConfig) {
        log.logName = PLATFORM_NAME;
        const prefixLog = new PrefixLogger(log);
        prefixLog.info(`Initialising platform ${PLUGIN_NAME}`);
        super(matterbridge, prefixLog, config);

        // Check the dependencies and configuration
        checkDependencyVersions(this);
        checkConfiguration(this.log, config);
        if (config.debugFeatures.includes('Log Debug as Info')) prefixLog.logDebugAsInfo();

        // Create storage for this plugin (initialised in onStart)
        const persistDir = Path.join(this.matterbridge.matterbridgePluginDirectory, PLUGIN_NAME, 'persist');
        this.persist = NodePersist.create({ dir: persistDir });
    }

    // Check the configuration after it has been updated
    override async onConfigChanged(config: PlatformConfig): Promise<void> {
        this.log.info(`Changed ${PLUGIN_NAME} configuration`);
        checkConfiguration(this.log, config);
        return Promise.resolve();
    }

    // Set the logger level
    override async onChangeLoggerLevel(logLevel: LogLevel): Promise<void> {
        this.log.info(`Change ${PLUGIN_NAME} log level: ${logLevel} (was ${this.log.logLevel})`);
        this.log.logLevel = logLevel;
        return Promise.resolve();
    }

    // Create the devices and clusters when Matterbridge loads the plugin
    override async onStart(reason?: string): Promise<void> {
        this.log.info(`Starting ${PLUGIN_NAME}: ${reason ?? 'none'}`);

        // Wait for the platform to start
        await this.ready;
        await this.clearSelect();

        // Initialise persistent storage
        await this.persist.init();

        // Initialise the Electrolux API and identify robots
        const aegAccount = new AEGAccount(this.log, this.config, this.persist);
        const allRX9 = await aegAccount.getAllRX9();
        this.log.info(`Found ${plural(allRX9.length, 'robot vacuum')}`);

        // Create and register a Matter device for each robot
        await Promise.all(allRX9.map(async ({ log, appliancePromise }) => {
            try {
                // Create the device
                const appliance = await appliancePromise;
                const device = new DeviceRX9(log, this.config, appliance);
                const { serialNumber, applianceName } = appliance;
                this.setSelectDevice(serialNumber, applianceName, undefined, 'hub');

                // Register the device unless blocked by the black/white lists
                if (this.validateDevice(applianceName)) {
                    await this.registerDevice(device);
                    this.devices.push(device);
                }
            } catch (err) {
                logError(log, 'Creating device', err);
            }
        }));
        this.log.info(`Registered ${this.devicesDescription}`);
    }

    // Configure and initialise the devices when the platform is commissioned
    override async onConfigure(): Promise<void> {
        this.log.info(`Configuring ${PLUGIN_NAME}`);
        await super.onConfigure();

        // Configure and start polling the devices
        await Promise.all(this.devices.map(async device => {
            try {
                await device.start();
            } catch (err) {
                logError(device.log, 'Starting device', err);
            }
        }));
        this.log.info(`Configured ${this.devicesDescription}`);
    }

    // Cleanup resources when Matterbridge is shutting down
    override async onShutdown(reason?: string): Promise<void> {
        this.log.info(`Shutting down ${PLUGIN_NAME}: ${reason ?? 'none'}`);
        await super.onShutdown(reason);

        // Stop polling the devices
        await Promise.all(this.devices.map(async device => {
            try {
                await device.stop();
            } catch (err) {
                logError(device.log, 'Stopping device', err);
            }
        }));
        this.log.info(`Stopped ${this.devicesDescription}`);

        // Remove the devices from Matterbridge during development
        if (this.config.unregisterOnShutdown) {
            await this.unregisterAllDevices();
            this.log.info(`Unregistered ${this.devicesDescription}`);
        }
    }

    // Description of the registered device(s)
    get devicesDescription(): string {
        return plural(this.devices.length, 'robot vacuum device');
    }
}