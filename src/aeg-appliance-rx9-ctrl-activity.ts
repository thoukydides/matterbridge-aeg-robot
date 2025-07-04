// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { RX9CleaningCommand, RX9RobotStatus } from './aegapi-rx9-types.js';
import { AEGApplianceRX9Ctrl } from './aeg-appliance-rx9-ctrl.js';
import { formatList, formatMilliseconds, MS, plural } from './utils.js';
import { setTimeout } from 'node:timers/promises';
import { CC, RR } from './logger.js';

// Expected result of starting an activity (true = no-op, undefined = invalid)
type StatusName = keyof typeof RX9RobotStatus
const ACTIVITY =            ['Clean',       'Stop',     'Pause',                    'Resume',           'Home'] as const;
export type ActivityRX9 = (typeof ACTIVITY)[number];
const FAUX_STATUS_MAP: Record<StatusName, (StatusName | true | undefined)[]> = {
    Cleaning:               [true,          'Sleeping', 'PausedCleaning',           true,               'Return'],
    PausedCleaning:         [true,          'Sleeping', true,                       'Cleaning',         'Return'],
    SpotCleaning:           [true,          'Sleeping', 'PausedSpotCleaning',       true,               'Return'],
    PausedSpotCleaning:     [true,          'Sleeping', true,                       'SpotCleaning',     'Return'],
    Return:                 ['Cleaning',    'Sleeping', 'PausedReturn',             true,               true],
    PausedReturn:           ['Cleaning',    'Sleeping', true,                       'Return',           'Return'],
    ReturnForPitstop:       [true,          'Sleeping', 'PausedReturnForPitstop',   true,               'Return'],
    PausedReturnForPitstop: [true,          'Sleeping', true,                       'ReturnForPitstop', 'Return'],
    Charging:               ['Cleaning',    true,       undefined,                  undefined,          true],
    Sleeping:               ['Cleaning',    true,       undefined,                  undefined,          'Return'],
    Error:                  ['Cleaning',    'Sleeping', undefined,                  undefined,          'Return'],
    Pitstop:                [true,          'Charging', undefined,                  undefined,          'Charging'],
    ManualSteering:         ['Cleaning',    'Sleeping', undefined,                  undefined,          'Return'],
    FirmwareUpgrade:        [undefined,     undefined,  undefined,                  undefined,          undefined]
};

// Command(s) required to start an activity
const CLEANING_COMMAND_MAP: Record<StatusName, (RX9CleaningCommand[] | undefined)[]> = {
    //                      Clean               Stop        Pause       Resume      Home
    Cleaning:               [[],                ['stop'],   ['pause'],  [],         ['home']],
    PausedCleaning:         [[],                ['stop'],   [],         ['play'],   ['home']],
    SpotCleaning:           [[],                ['stop'],   ['pause'],  [],         ['home']],
    PausedSpotCleaning:     [[],                ['stop'],   [],         ['play'],   ['home']],
    Return:                 [['stop', 'play'],  ['stop'],   ['pause'],  [],         []],
    PausedReturn:           [['stop', 'play'],  ['stop'],   [],         ['play'],   ['home']],
    ReturnForPitstop:       [[],                ['stop'],   ['pause'],  [],         ['home']],
    PausedReturnForPitstop: [[],                ['stop'],   [],         ['play'],   ['home']],
    Charging:               [['play'],          [],         undefined,  undefined,  []],
    Sleeping:               [['play'],          [],         undefined,  undefined,  ['home']],
    Error:                  [['play'],          ['stop'],   undefined,  undefined,  ['home']],
    Pitstop:                [[],                ['stop'],   undefined,  undefined,  ['home']],
    ManualSteering:         [['stop', 'play'],  ['stop'],   undefined,  undefined,  ['home']],
    FirmwareUpgrade:        [undefined,         undefined,  undefined,  undefined,  undefined]
};

// Check that the mapping tables are consistent
const errors: string[] = [];
for (const status of Object.keys(FAUX_STATUS_MAP) as StatusName[]) {
    for (let column = 0; column < ACTIVITY.length; ++column) {
        const fauxStatus = FAUX_STATUS_MAP[status][column];
        const command = CLEANING_COMMAND_MAP[status][column];
        const activity = ACTIVITY[column];
        const description = `${activity} activity in ${status} state`;
        switch (fauxStatus) {
        case true:
            if (!command || command.length) errors.push(`${description} should have empty command list`);
            break;
        case undefined:
            if (command)                    errors.push(`${description} is invalid, so should have undefined command list`);
            break;
        default:
            if (!command?.length)           errors.push(`${description} requires a non-empty command list`);
            if (fauxStatus === status)      errors.push(`${description} cannot transition to the same state`);
        }
    }
}
if (errors.length) throw new Error(`Inconsistent activity mapping tables:\n${errors.join('\n')}`);

// Minimum interval between successive commands
const COMMAND_INTERVAL = 5 * MS; // 5 seconds

// Robot controller for changing the activity
export class AEGApplianceRX9CtrlActivity extends AEGApplianceRX9Ctrl<ActivityRX9> {

    // Time of the last successful command response
    private lastCommandTime = 0;

    // Create a new robot controller for changing the name
    constructor(readonly appliance: AEGApplianceRX9) {
        super(appliance, 'activity');
    }

    // Check whether the robot is (or can) perform the required activity
    override isTargetSet(target: ActivityRX9): boolean | undefined {
        const fauxStatus = this.mapLookup(FAUX_STATUS_MAP, target);
        return typeof fauxStatus === 'string' ? false : fauxStatus;
    }

    // Attempt to set the requested state
    override async setTarget(target: ActivityRX9, signal?: AbortSignal): Promise<void> {
        const description = this.description(target);

        // Lookup the appropriate commands for the current state
        const commands = this.mapLookup(CLEANING_COMMAND_MAP, target);
        if (!commands) throw new Error(`Target ${target} not valid in current state`);

        // Sequence the command(s) to the robot
        this.log.info(`Sending ${plural(commands.length, 'command', false)}`
                    + ` ${formatList(commands.map(c => `${CC}${c}${RR}`))} to ${description}`);
        for (const command of commands) {
            // Ensure a minimum interval between commands
            const delay = this.lastCommandTime + COMMAND_INTERVAL - Date.now();
            if (0 < delay) {
                this.log.debug(`Waiting ${formatMilliseconds(delay, 1)}s before sending next command`);
                await setTimeout(delay, undefined, { signal });
            }

            // Send the next command, selecting 'CustomPlay' instead of 'Play' if appropriate
            if (command === 'play' && this.appliance.customPlay) {
                const { persistentMapId, zones } = this.appliance.customPlay;
                this.log.info(`Using ${CC}CustomPlay${RR} command for zone cleaning`);
                await this.api.sendCustomPlayCommand(persistentMapId, zones, signal);
            } else {
                await this.api.sendCleaningCommand(command, signal);
            }
            this.lastCommandTime = Date.now();
        }
    }

    // Override the status while a requested change is pending
    override preEmitPatch(target: ActivityRX9): void {
        const description = this.description(target);
        const { robotStatus } = this.appliance.state;

        // Predict and overwrite the target status
        const fauxStatus = this.mapLookup(FAUX_STATUS_MAP, target);
        switch (fauxStatus) {
        case true:      throw new Error(`Target ${target} achieved`);
        case undefined: throw new Error(`Target ${target} not valid in current state`);
        default:
            this.log.debug(`Patching ${description} status: ${RX9RobotStatus[robotStatus]}->${fauxStatus}`);
            this.appliance.state.fauxStatus = RX9RobotStatus[fauxStatus];
        }
    }

    // Convert an activity name to a column index
    mapLookup<T>(map: Record<StatusName, T[]>, target: ActivityRX9): T | undefined {
        const { robotStatus } = this.appliance.state;
        const row = RX9RobotStatus[robotStatus] as keyof typeof RX9RobotStatus;
        const column = ACTIVITY.indexOf(target);
        return map[row][column];
    }
}