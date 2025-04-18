// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { AEGAPI } from './aegapi.js';
import { formatList, formatSeconds, plural } from './utils.js';
import { Config } from './config-types.js';
import { AEGAPIRX9 } from './aegapi-rx9.js';
import { API_DAILY_LIMIT, API_DAILY_POLL_LIMIT, PLUGIN_NAME } from './settings.js';
import { Appliance } from './aegapi-types.js';
import { PrefixLogger } from './logger.js';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import NodePersist from 'node-persist';

// A robot manager being created
export interface AEGPendingRX9 extends Appliance {
    log:                AnsiLogger;
    appliancePromise:   Promise<AEGApplianceRX9>;
};

// Number of seconds in a day
const SECONDS_PER_DAY = 24 * 60 * 60;

// An AEG user account manager
export class AEGAccount {

    // Electrolux Group API
    readonly api: AEGAPI;

    // Create a new AEG user account manager
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly persist:   NodePersist.LocalStorage
    ) {
        // Create a new API instance
        this.api = new AEGAPI(log, config, persist);
    }

    // Return a list of AEG RX9.1 and RX9.2 robot vacuum cleaners in the account
    async getAllRX9(): Promise<AEGPendingRX9[]> {
        // Read the list of appliances and identify compatible robots
        const appliances   = await this.api.getAppliances();
        const robots       = appliances.filter(appliance =>  AEGAPIRX9.isRX9(appliance));
        const incompatible = appliances.filter(appliance => !AEGAPIRX9.isRX9(appliance));

        // Log details of any incompatible appliances
        if (incompatible.length) {
            this.log.info(`Ignoring ${plural(incompatible.length, 'incompatible appliance')}: `
                          + formatList(incompatible.map(a => `${a.applianceName} (${a.applianceType})`)));
        }

        // Ensure that the polling interval is under the daily API limit
        this.checkPollingInterval(robots.length);

        // Create a manager for each robot
        return robots.map(appliance => this.createRX9(appliance));
    }

    // Create a manager for a single robot
    createRX9(appliance: Appliance): AEGPendingRX9 {
        const api = this.api.rx9API(appliance.applianceId);
        const log = new PrefixLogger(this.log, appliance.applianceName);
        const appliancePromise = AEGApplianceRX9.create(log, this.config, api, appliance);
        return { ...appliance, log, appliancePromise };
    }

    // Ensure that the polling interval is under the daily API limit
    checkPollingInterval(robots: number): void {
        // Check whether the daily rate limit will be exceeded
        const { pollIntervalSeconds } = this.config;
        const dailyCalls = (seconds: number): number => Math.ceil(robots * SECONDS_PER_DAY / seconds);
        if (dailyCalls(pollIntervalSeconds) < API_DAILY_LIMIT) return;

        // Pick a more suitable polling interval
        const newPollIntervalSeconds = Math.ceil(robots * SECONDS_PER_DAY / API_DAILY_POLL_LIMIT);
        this.config.pollIntervalSeconds = newPollIntervalSeconds;

        // Log details of the increased poll interval
        this.log.warn(`Increasing polling interval from ${formatSeconds(pollIntervalSeconds)} to ${formatSeconds(newPollIntervalSeconds)} `
                    + `due to Electrolux Group API rate limit of ${API_DAILY_LIMIT} calls/day`);
        this.log.warn(`With ${plural(robots, 'robot vacuum cleaner')} this reduces the polling rate from `
                    + `${dailyCalls(pollIntervalSeconds)} to ${dailyCalls(newPollIntervalSeconds)} calls/day`);
        this.log.warn(`Increase the value of pollIntervals.statusSeconds in the Matterbridge ${PLUGIN_NAME}.config.json file`);
    }
}