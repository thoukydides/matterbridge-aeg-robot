// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { PowerSource, RvcOperationalState } from 'matterbridge/matter/clusters';
import { RX92PowerMode, RX9BatteryStatus, RX9Dustbin, RX9RobotStatus } from './aegapi-rx9-types.js';
import { DynamicStateRX9 } from './aeg-appliance-rx9.js';
import { RvcRunModeRX9, RvcCleanModeRX9, RvcOperationalStateRX9 } from './endpoint-rx9.js';
import { RvcOperationalStateError } from './error-rx9.js';

// Helper types for converting an ordered list of property names/types
type ExtractTypes<T extends readonly [string, unknown][]> = {
    [K in keyof T]: T[K] extends [unknown, infer U] ? U : never;
};
type ExtractFields<T extends readonly [string, unknown][]> = {
    [K in T[number] as K[0]]: K[1];
};

// Map the robot status to different conditions
type StatusFieldEntries = [
    ['runMode',             keyof typeof RvcRunModeRX9],
    ['isSpotClean',         boolean],
    ['operationalState',    keyof typeof RvcOperationalStateRX9]
];
const STATUS_MAP: Record<RX9RobotStatus, ExtractTypes<StatusFieldEntries>> = {
    //                                          runMode     isSpotClean operationalState
    [RX9RobotStatus.Cleaning]:                 ['Cleaning', false,      'Running'],
    [RX9RobotStatus.PausedCleaning]:           ['Cleaning', false,      'Paused'],
    [RX9RobotStatus.SpotCleaning]:             ['Cleaning', true,       'Running'],
    [RX9RobotStatus.PausedSpotCleaning]:       ['Cleaning', true,       'Paused'],
    [RX9RobotStatus.Return]:                   ['Idle',     false,      'SeekingCharger'],
    [RX9RobotStatus.PausedReturn]:             ['Idle',     false,      'Paused'],
    [RX9RobotStatus.ReturnForPitstop]:         ['Cleaning', false,      'SeekingCharger'],
    [RX9RobotStatus.PausedReturnForPitstop]:   ['Cleaning', false,      'Paused'],
    [RX9RobotStatus.Charging]:                 ['Idle',     false,      'Charging'],
    [RX9RobotStatus.Sleeping]:                 ['Idle',     false,      'Docked'],
    [RX9RobotStatus.Error]:                    ['Idle',     false,      'Error'],
    [RX9RobotStatus.Pitstop]:                  ['Cleaning', false,      'Charging'],
    [RX9RobotStatus.ManualSteering]:           ['Idle',     false,      'Error'],
    [RX9RobotStatus.FirmwareUpgrade]:          ['Idle',     false,      'Error']
};
function mapStatus(status: RX9RobotStatus): ExtractFields<StatusFieldEntries> {
    const [runMode, isSpotClean, operationalState] = STATUS_MAP[status];
    return { runMode, isSpotClean, operationalState };
}

// Translation of dynamic appliance information to Matter attributes
export const BABEL_DYNAMIC_RX9 = {

    // Version number of the software running on the node
    softwareVersion: ({ firmwareVersion }: DynamicStateRX9): string => {
        return firmwareVersion;
    },

    // Is the appliance reachable?
    reachable: ({ connected, enabled, apiError }: DynamicStateRX9): boolean => {
        return connected && enabled && !apiError;
    },

    // Battery charge level and charging status
    batteryStatus: ({ batteryStatus, isCharging }: DynamicStateRX9): {
        status:                 PowerSource.PowerSourceStatus;
        batPercentRemaining:    number; // ×2, e.g. 200 for 100%
        batChargeLevel:         PowerSource.BatChargeLevel;
        batChargeState:         PowerSource.BatChargeState;
    } => {
        type BatteryMap = [
            number,
            keyof typeof PowerSource.PowerSourceStatus,
            keyof typeof PowerSource.BatChargeLevel,
            keyof typeof PowerSource.BatChargeState
        ];
        const batteryMap: Record<RX9BatteryStatus, BatteryMap> = {
            //                                     %    Status         ChargeLevel ChargeState
            [RX9BatteryStatus.Dead]:            [  0,   'Unavailable', 'Critical', 'IsNotCharging'],
            [RX9BatteryStatus.CriticalLow]:     [ 20,   'Active',      'Critical', 'IsNotCharging'],
            [RX9BatteryStatus.Low]:             [ 40,   'Active',      'Warning',  'IsNotCharging'],
            [RX9BatteryStatus.Medium]:          [ 60,   'Active',      'Ok',       'IsNotCharging'],
            [RX9BatteryStatus.High]:            [ 80,   'Active',      'Ok',       'IsNotCharging'],
            [RX9BatteryStatus.FullyCharged]:    [100,   'Active',      'Ok',       'IsAtFullCharge']
        };
        const [batPercentRemaining, statusEnum, batChargeLevelEnum, batChargeStateEnum] = batteryMap[batteryStatus];
        return {
            status:                 PowerSource.PowerSourceStatus[statusEnum],
            batPercentRemaining:    batPercentRemaining * 2,
            batChargeLevel:         PowerSource.BatChargeLevel[batChargeLevelEnum],
            batChargeState:         PowerSource.BatChargeState[isCharging ? 'IsCharging' : batChargeStateEnum]
        };
    },

    // Is the appliance active?
    runMode: ({ fauxStatus }: DynamicStateRX9): RvcRunModeRX9 => {
        const { runMode } = mapStatus(fauxStatus);
        return RvcRunModeRX9[runMode];
    },

    // Type of cleaning and power level
    cleanMode: ({ fauxStatus, powerMode, ecoMode }: DynamicStateRX9): RvcCleanModeRX9 => {
        const { isSpotClean } = mapStatus(fauxStatus);
        powerMode ??= ecoMode === true ? RX92PowerMode.Quiet : RX92PowerMode.Power;
        const PowerMap: Record<RX92PowerMode, [keyof typeof RvcCleanModeRX9, keyof typeof RvcCleanModeRX9]> = {
            [RX92PowerMode.Quiet]:      ['Quiet', 'QuietSpot'],
            [RX92PowerMode.Smart]:      ['Smart', 'SmartSpot'],
            [RX92PowerMode.Power]:      ['Power', 'PowerSpot']
        };
        const cleanMode = PowerMap[powerMode][isSpotClean ? 1 : 0];
        return RvcCleanModeRX9[cleanMode];
    },

    // Current operational state
    operationalState: ({ connected, enabled, apiError, fauxStatus, batteryStatus, dustbinStatus, isDocked, messages }: DynamicStateRX9): {
        operationalState:   RvcOperationalStateRX9;
        operationalError:   RvcOperationalState.ErrorStateStruct;
        isActive:           boolean;
    } => {
        try {
            // Start with a direct mapping of the appliance state
            let { operationalState } = mapStatus(fauxStatus);

            // Cannot trust anything unless the robot is connected
            // (these should mark the whole device as non-reachable anyway)
            if (apiError instanceof Error)  throw apiError;
            else if (apiError)              throw new Error('API error');
            else if (!connected)            throw new Error('Not connected to cloud servers');
            else if (!enabled)              throw new Error('Appliance not enabled');

            // Attempt to identify known error messages
            if (messages.some(m => m.type === 0 && (m.userErrorID === 15 || m.internalErrorID === 10005))) {
                throw new RvcOperationalStateError.Stuck(); // 'Please help me get free'
            }

            // If any messages are being reported then pick the most recent
            if (messages.length) {
                const { text } = messages.reduce((latest, current) =>
                    latest.timestamp < current.timestamp  ? current : latest);
                throw new Error(text);
            }

            // Report any dustbin issues at low priority only when idle
            const { runMode } = mapStatus(fauxStatus);
            if (runMode === 'Idle') {
                switch (dustbinStatus) {
                case RX9Dustbin.Missing:    throw new RvcOperationalStateError.DustBinMissing();
                case RX9Dustbin.Full:       throw new RvcOperationalStateError.DustBinFull();
                }
            }

            // Finally, special behaviour for some robot states
            switch (fauxStatus) {

            // Use heuristics when the robot is sleeping
            case RX9RobotStatus.Sleeping:
                if (batteryStatus === RX9BatteryStatus.Dead) throw new RvcOperationalStateError.FailedToFindChargingDock();
                operationalState = isDocked ? 'Docked' : 'Stopped';
                break;

            // Some robot states are not supported by standard Matter Operational States
            case RX9RobotStatus.ManualSteering:     throw new Error('Manual Steering');
            case RX9RobotStatus.FirmwareUpgrade:    throw new Error('Upgrading firmware');

            // Robot reporting an error, but no obvious cause
            case RX9RobotStatus.Error:              throw new Error('Unidentified error');
            }

            // Return the (non-error) operational state
            return {
                operationalState: RvcOperationalStateRX9[operationalState],
                operationalError: RvcOperationalStateError.toStruct(),
                isActive:         runMode !== 'Idle'
            };
        } catch (err) {
            // Any error forces the operational state to Error
            return {
                operationalState: RvcOperationalStateRX9.Error,
                operationalError: RvcOperationalStateError.toStruct(err),
                isActive:         false
            };
        }
    }

} as const;