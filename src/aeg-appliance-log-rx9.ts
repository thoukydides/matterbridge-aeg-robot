// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger, LogLevel } from 'matterbridge/logger';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { formatList, formatMilliseconds, MS, plural } from './utils.js';
import {
    RX9BatteryStatus,
    RX9Dustbin,
    RX9Message,
    RX92PowerMode,
    RX9RobotStatus
} from './aegapi-rx9-types.js';
import { RR, RT, RV } from './logger-options.js';
import {
    aegRobotMap,
    MAP_CONFIG_MATTERBRIDGE,
    MAP_CONFIG_MONOSPACED
} from './aeg-map.js';

// Descriptions of the robot activity
const activityNames: Record<RX9RobotStatus, string | null> = {
    [RX9RobotStatus.Cleaning]:                  'CLEANING',
    [RX9RobotStatus.PausedCleaning]:            'PAUSED during cleaning',
    [RX9RobotStatus.SpotCleaning]:              'SPOT CLEANING',
    [RX9RobotStatus.PausedSpotCleaning]:        'PAUSED during spot cleaning',
    [RX9RobotStatus.Return]:                    'returning HOME',
    [RX9RobotStatus.PausedReturn]:              'PAUSED during return home',
    [RX9RobotStatus.ReturnForPitstop]:          'returning HOME; it will resume cleaning when charged',
    [RX9RobotStatus.PausedReturnForPitstop]:    'PAUSED during return home; it will resume cleaning when charged',
    [RX9RobotStatus.Charging]:                  'CHARGING',
    [RX9RobotStatus.Sleeping]:                  'SLEEPING (either charged on dock or idle off dock)',
    [RX9RobotStatus.Error]:                     'in an ERROR state',
    [RX9RobotStatus.Pitstop]:                   'CHARGING; it will resume cleaning when charged',
    [RX9RobotStatus.ManualSteering]:            'being STEERED MANUALLY',
    [RX9RobotStatus.FirmwareUpgrade]:           'performing a FIRMWARE UPGRADE'
};

// Descriptions of the robot battery levels
const batteryNames: Record<RX9BatteryStatus, string> = {
    [RX9BatteryStatus.Dead]:                    'DEAD',
    [RX9BatteryStatus.CriticalLow]:             'CRITICALLY LOW',
    [RX9BatteryStatus.Low]:                     'LOW',
    [RX9BatteryStatus.Medium]:                  'MEDIUM',
    [RX9BatteryStatus.High]:                    'HIGH',
    [RX9BatteryStatus.FullyCharged]:            'FULLY CHARGED'
};

// Descriptions of dustbin states
const dustbinNames: Record<RX9Dustbin, { value: string, extra?: string }> = {
    [RX9Dustbin.Unknown]:   { value: 'UNKNOWN' },
    [RX9Dustbin.Present]:   { value: 'PRESENT', extra: 'not full' },
    [RX9Dustbin.Missing]:   { value: 'MISSING' },
    [RX9Dustbin.Full]:      { value: 'FULL',    extra: 'requires emptying' }
};

// Descriptions of power modes
const powerModeNames: Record<RX92PowerMode, { value: string, extra: string }> = {
    [RX92PowerMode.Quiet]:  { value: 'QUIET',   extra: 'lower energy consumption and quieter' },
    [RX92PowerMode.Smart]:  { value: 'SMART',   extra: 'cleans quietly on hard surfaces, uses full power on carpets' },
    [RX92PowerMode.Power]:  { value: 'POWER',   extra: 'optimal cleaning performance, higher energy consumption' }
};

// Logging of information about a robot
export class AEGApplianceRX9Log {

    // Logger
    readonly log: AnsiLogger;

    // Reported error messages
    private readonly loggedHealthErrors = new Set<string>();

    // Construct a robot logger
    constructor(readonly appliance: AEGApplianceRX9) {
        // Use the appliance's logger
        this.log = appliance.log;

        // Start logging information about the robot
        this.logStatic();
        this.logStatus();
        this.logMessages();
        this.logMaps();
    }

    // Log static information about the robot once at startup
    logStatic(): void {
        const { applianceType, brand, capabilities, colour, model, variant } = this.appliance;
        const redacted = !this.appliance.config.debugFeatures.includes('Log Appliance IDs');
        this.log.info(`${RT}My name is "${RV}${this.appliance.applianceName}${RT}"${RR}`);
        this.log.info(`${RV}${brand} ${applianceType}${RT} (${RV}${model}${RT}/${RV}${variant}${RT}) ${RV}${colour}${RR}`);
        if (!redacted) this.log.info(`${RT}Product ID ${RV}${this.appliance.applianceId}${RR}`);
        this.log.info(`${RT}Product number code ${RV}${this.appliance.pnc}${RR}`);
        if (!redacted) this.log.info(`${RT}Serial number ${RV}${this.appliance.serialNumber}${RR}`);
        this.log.info(`${RT}Hardware platform ${RV}${this.appliance.platform}${RR}`);
        const capabilityValues = [...capabilities].sort().map(c => `${RV}${c}${RT}`);
        this.log.info(`${RT}Supports ${plural(capabilities.length, 'capability')}: ${formatList(capabilityValues)}${RR}`);
    }

    // Log initial values and changes for other status
    logStatus(): void {
        this.appliance.on('firmwareVersion', (firmwareVersion: string) => {
            this.log.info(`${RT}Firmware version ${RV}${firmwareVersion}${RT} installed${RR}`);
        }).on('batteryStatus', (batteryStatus: RX9BatteryStatus) => {
            this.log.info(`${RT}Battery level is ${RV}${batteryNames[batteryStatus]}${RR}`);
        }).on('robotStatus', (robotStatus: RX9RobotStatus) => {
            this.log.info(`${RT}Robot is ${RV}${activityNames[robotStatus]}${RR}`);
        }).on('fauxStatus', (fauxStatus: RX9RobotStatus) => {
            if (fauxStatus === this.appliance.state.robotStatus) return;
            this.log.info(`${RT}Predicting robot will be ${RV}${activityNames[fauxStatus]}${RR}`);
        }).on('dustbinStatus', (dustbinStatus: RX9Dustbin) => {
            const { value, extra } = dustbinNames[dustbinStatus];
            this.log.info(`${RT}Dust collection bin is ${RV}${value}${extra ? `${RT} and ${extra}` : ''}${RR}`);
        }).on('powerMode', (powerMode?: RX92PowerMode) => {
            if (powerMode === undefined) return;
            const { value, extra } = powerModeNames[powerMode];
            this.log.info(`${RT}Power mode is set to ${RV}${value}${RT} (${extra})${RR}`);
        }).on('ecoMode', (ecoMode?: boolean) => {
            if (ecoMode === undefined) return;
            this.log.info(`${RT}ECO mode is ${RV}${ecoMode ? 'enabled' : 'disabled'}${RR}`);
        }).on('enabled', (enabled: boolean) => {
            this.log.log(enabled ? LogLevel.INFO : LogLevel.WARN,
                         `${RT}Robot is ${RV}${enabled ? 'enabled' : 'disabled'}${RR}`);
        }).on('connected', (connected: boolean) => {
            this.log.log(connected ? LogLevel.INFO : LogLevel.WARN,
                         `${RT}Robot ${RV}${connected ? 'is' : 'is NOT'}${RT} connected to the cloud servers${RR}`);
        }).on('apiError', (err?: unknown) => { this.logHealth(err); });
    }

    // Log changes to cloud server health
    logHealth(err?: unknown): void {
        if (err) {
            const message = err instanceof Error ? err.message : JSON.stringify(err);
            if (!this.loggedHealthErrors.has(message)) {
                this.loggedHealthErrors.add(message);
                this.log.error(`Lost connection to cloud servers: ${message}`);
            }
        } else {
            this.loggedHealthErrors.clear();
            this.log.info(`${RT}Successfully connected to cloud servers${RR}`);
        }
    }

    // Log messages from the robot
    logMessages(): void {
        this.appliance.on('message', (message: RX9Message) => {
            const age = `${formatMilliseconds(Date.now() - message.timestamp * MS)} ago`;
            const bits = [`type=${message.type}`];
            if (message.userErrorId)     bits.push(`user-error=${message.userErrorId}`);
            if (message.internalErrorId) bits.push(`internal-error=${message.internalErrorId}`);
            this.log.warn(`Message: ${message.text} (${age})`);
            this.log.debug(`Message: ${formatList(bits)}`);
        });
    }

    // Log map data from the robot
    logMaps(): void {
        this.appliance.on('map', (mapData, mapDataExtra) => {
            const { logMapStyle } = this.appliance.config;
            if (logMapStyle !== 'Off') {
                const mapStyle = logMapStyle === 'Matterbridge'
                    ? MAP_CONFIG_MATTERBRIDGE : MAP_CONFIG_MONOSPACED;
                const mapText = aegRobotMap(mapStyle, mapData, mapDataExtra);
                for (const line of mapText) this.log.info(line);
            }
        });
    }
}
