// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { AEGApplianceRX9Log } from './aeg-appliance-log-rx9.js';
import { Config } from './config-types.js';
import { formatList, MS } from './utils.js';
import {
    RX9ApplianceInfo,
    RX9ApplianceState,
    RX9BatteryStatus,
    RX9Capabilities,
    RX9Dustbin,
    RX9Message,
    RX92PowerMode,
    RX9RobotStatus,
    RX9InteractiveMaps,
    RX9CustomPlayMapZones
} from './aegapi-rx9-types.js';
import { AEGAPIRX9 } from './aegapi-rx9.js';
import { Appliance, ApplianceInfoDTO } from './aegapi-types.js';
import EventEmitter from 'events';
import { PeriodicOp } from './periodic-op.js';
import {
    ActivityRX9,
    AEGApplianceRX9CtrlActivity
} from './aeg-appliance-rx9-ctrl-activity.js';
import { logError } from './log-error.js';

// Dynamic information about a robot
export interface DynamicStateRX9 {
    // Raw values provided by the Electrolux Group API
    connected:          boolean;
    enabled:            boolean;
    batteryStatus:      RX9BatteryStatus;
    dustbinStatus:      RX9Dustbin;
    firmwareVersion:    string;
    robotStatus:        RX9RobotStatus;
    messages:           RX9Message[];
    ecoMode?:           boolean;
    powerMode?:         RX92PowerMode;
    // Status polling errors
    apiError?:          unknown;
    // Derived values
    isDocked:           boolean;
    isCharging:         boolean;
    fauxStatus:         RX9RobotStatus;
}
export type StatusEventRX9 = keyof DynamicStateRX9;
type StatusEventMap = {
    [event in StatusEventRX9]-?: [DynamicStateRX9[event], Partial<DynamicStateRX9>[event]];
}
// Workaround TypeScript limitations preserving key-value relationships for tuples
type StatusEmit<K extends StatusEventRX9> =
    (event: K, newValue: DynamicStateRX9[K], oldValue: Partial<DynamicStateRX9>[K]) => boolean;

// Other event types
interface OtherEventMap {
    error:          [unknown];                              // Error event (from EventEmitter)
    preEmitPatch:   [DynamicStateRX9];                      // Opportunity to fake state
    message:        [RX9Message];                           // New message received from API
    changed:        [StatusEventRX9[], DynamicStateRX9];    // List of changed keys
};

// Timings for polling the status
const POLL_INTERVAL_RAPID   = 1 * MS;
const POLL_TIMEOUT_MULTIPLE = 2;
const POLL_TIMEOUT_OFFSET   = 10 * MS;

// An AEG RX 9 / Electrolux Pure i9 robot manager
export class AEGApplianceRX9
    extends EventEmitter<StatusEventMap & OtherEventMap>
    implements Appliance, ApplianceInfoDTO {

    // Control the robot
    readonly setActivity:   (command: ActivityRX9) => Promise<boolean>;
    customPlay?:            RX9CustomPlayMapZones;

    // Static information
    //   ... from getAppliances
    readonly applianceId:   string;
    readonly applianceName: string;
    readonly applianceType: string;
    readonly created:       string;
    //   ... from getApplianceInfo
    readonly brand:         string;
    readonly colour:        string;
    readonly deviceType:    string;
    readonly model:         string;
    readonly pnc:           string;
    readonly serialNumber:  string;
    readonly variant:       string;
    //   ... from getApplianceState
    readonly capabilities:  RX9Capabilities[];
    readonly platform:      string;

    // Dynamic information about the robot
    readonly state: DynamicStateRX9 = {
        connected:          false,
        enabled:            false,
        batteryStatus:      RX9BatteryStatus.Dead,
        dustbinStatus:      RX9Dustbin.Unknown,
        firmwareVersion:    '',
        robotStatus:        RX9RobotStatus.Error,
        fauxStatus:         RX9RobotStatus.Error,
        messages:           [],
        isDocked:           false,
        isCharging:         false
    };

    private emittedState: Partial<DynamicStateRX9> = {};

    // Messages about the robot
    private readonly emittedMessages = new Set<number>();

    // Periodic API polling
    poll?: PeriodicOp;

    // Create a new robot manager
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly api:       AEGAPIRX9,
        appliance:          Appliance,
        info:               RX9ApplianceInfo,
        state:              RX9ApplianceState,
        readonly maps:      RX9InteractiveMaps
    ) {
        super({ captureRejections: true });
        super.on('error', err => { logError(this.log, 'Event', err); });

        // Initialise static information about the robot
        //   ... from getAppliances
        this.applianceId    = appliance.applianceId;
        this.applianceName  = appliance.applianceName;
        this.applianceType  = appliance.applianceType;
        this.created        = appliance.created;
        //   ... from getApplianceInfo
        const { applianceInfo } = info;
        this.brand          = applianceInfo.brand;
        this.colour         = applianceInfo.colour;
        this.deviceType     = applianceInfo.deviceType;
        this.model          = applianceInfo.model;
        this.pnc            = applianceInfo.pnc;
        this.serialNumber   = applianceInfo.serialNumber;
        this.variant        = applianceInfo.variant;
        //   ... from getApplianceState
        const { reported } = state.properties;
        this.platform       = reported.platform;
        this.capabilities   = Object.keys(reported.capabilities) as RX9Capabilities[];

        // Initialise dynamic information
        this.updateFromApplianceState(state);

        // Allow the robot to be controlled
        this.setActivity    = new AEGApplianceRX9CtrlActivity(this).makeSetter();

        // Start logging information about this robot
        new AEGApplianceRX9Log(this);
    }

    // Start polling the appliance
    async start(): Promise<void> {
        if (this.poll) return;

        // Ensure that events are generated for the initial state
        this.emittedState = {};
        this.emittedMessages.clear();

        // Start polling the status
        this.poll = new PeriodicOp(this.log, {
            name:           'Appliance state',
            interval:       this.config.pollIntervalSeconds * MS,
            intervalRapid:  POLL_INTERVAL_RAPID,
            timeout:        this.config.pollIntervalSeconds * MS * POLL_TIMEOUT_MULTIPLE + POLL_TIMEOUT_OFFSET,
            onOp:           this.pollApplianceState.bind(this),
            onError:        this.pollError.bind(this)
        });
        return Promise.resolve();
    }

    // Stop polling the appliance
    async stop(): Promise<void> {
        await this.poll?.stop();
        this.poll = undefined;
    }

    // Periodically poll the appliance state
    async pollApplianceState(): Promise<void> {
        const state = await this.api.getApplianceState();
        this.updateFromApplianceState(state);
        this.updateDerivedAndEmit();
    }

    // Handle a status update for a periodic action
    pollError(err?: unknown): void {
        this.state.apiError = err;
        this.updateDerivedAndEmit();
    }

    // Describe this robot
    toString(): string {
        const { brand, model, applianceName, applianceId } = this;
        return `${brand} ${model} '${applianceName}' (Product ID ${applianceId})`;
    }

    // Update dynamic robot state
    updateFromApplianceState(state: RX9ApplianceState): void {
        // Extract the relevant information
        const { reported } = state.properties;
        const { messageList } = reported;
        this.updateStatus({
            connected:          state.connectionState === 'Connected',
            enabled:            state.status          === 'enabled',
            batteryStatus:      reported.batteryStatus,
            dustbinStatus:      reported.dustbinStatus,
            firmwareVersion:    reported.firmwareVersion,
            robotStatus:        reported.robotStatus,
            messages:           messageList.messages,
            ecoMode:            'ecoMode'   in reported ? reported.ecoMode   : undefined,
            powerMode:          'powerMode' in reported ? reported.powerMode : undefined
        });
    }

    // Updated derived values and emit changes
    updateDerivedAndEmit(): void {
        this.updateDerived();
        this.emit('preEmitPatch', this.state);
        this.emitMessages();
        this.emitChangeEvents();
    }

    // Update derived values
    updateDerived(): void {
        const { robotStatus, batteryStatus, isDocked: wasDocked } = this.state;

        // Mapping of robot activities
        type ActivityMap = [boolean | null, boolean];
        const activityMap: Record<RX9RobotStatus, ActivityMap> = {
            //                                          Docked  Charging
            [RX9RobotStatus.Cleaning]:                 [false,  false],
            [RX9RobotStatus.PausedCleaning]:           [false,  false],
            [RX9RobotStatus.SpotCleaning]:             [false,  false],
            [RX9RobotStatus.PausedSpotCleaning]:       [false,  false],
            [RX9RobotStatus.Return]:                   [false,  false],
            [RX9RobotStatus.PausedReturn]:             [false,  false],
            [RX9RobotStatus.ReturnForPitstop]:         [false,  false],
            [RX9RobotStatus.PausedReturnForPitstop]:   [false,  false],
            [RX9RobotStatus.Charging]:                 [true,   true],
            [RX9RobotStatus.Sleeping]:                 [null,   false],
            [RX9RobotStatus.Error]:                    [null,   false],
            [RX9RobotStatus.Pitstop]:                  [true,   true],
            [RX9RobotStatus.ManualSteering]:           [false,  false],
            [RX9RobotStatus.FirmwareUpgrade]:          [null,   false]
        };
        const [isDockedStatus, isCharging] = activityMap[robotStatus];

        // Use heuristics to determine whether docked state when unspecified
        const isDockedInferred = batteryStatus === RX9BatteryStatus.FullyCharged ? true
                               : batteryStatus === RX9BatteryStatus.High         ? wasDocked
                               : false;
        const isDocked = isDockedStatus ?? isDockedInferred;

        // Update the status
        this.updateStatus({ isDocked, isCharging, fauxStatus: robotStatus });
    }

    // Apply a partial update to the robot status
    updateStatus(update: Partial<DynamicStateRX9>): void {
        Object.assign(this.state, update);
    }

    // Apply updates to the robot status and emit events for changes
    emitChangeEvents(): void {
        // Identify the values that have changed
        const keys = Object.keys(this.state) as StatusEventRX9[];
        const changed = keys.filter(key => {
            const a = this.state[key], b = this.emittedState[key];
            if (Array.isArray(a) && Array.isArray(b)) {
                return a.length !== b.length
                    || a.some((element, index) => element !== b[index]);
            } else {
                return a !== b;
            }
        });
        if (!changed.length) return;

        // Log a summary of the changes
        const toText = (value: unknown): string => {
            switch (typeof(value)) {
            case 'undefined':   return '?';
            case 'string':      return /[- <>:,]/.test(value) ? `"${value}"` : value;
            case 'number':      return value.toString();
            case 'boolean':     return value.toString();
            default:            return JSON.stringify(value);
            }
        };
        const summary = changed.map(key =>
            `${key}: ${toText(this.emittedState[key])}->${toText(this.state[key])}`);
        this.log.debug(formatList(summary));

        // Emit an event listing all of the keys that have changed
        this.emit('changed', keys, this.state);

        // Emit events for each change
        changed.forEach(key => (this.emit as StatusEmit<typeof key>)(key, this.state[key], this.emittedState[key]));

        // Store a copy of the updated values
        this.emittedState = {...this.state};
    }

    // Emit events for any new messages
    emitMessages(): void {
        const { messages } = this.state;

        // If there are no current messages then just flush the cache
        if (!messages.length) {
            this.emittedMessages.clear();
            return;
        }

        // Emit events for any new messages
        messages.forEach(message => {
            const { id } = message;
            if (!(this.emittedMessages.has(id))) {
                this.emittedMessages.add(id);
                this.emit('message', message);
            }
        });
    }

    // Create a new AEG RX 9 / Electrolux Pure i9 robot manager
    static async create(log: AnsiLogger, config: Config, api: AEGAPIRX9, appliance: Appliance): Promise<AEGApplianceRX9> {
        // Read the full appliance details
        const info  = await api.getApplianceInfo();
        const state = await api.getApplianceState();

        // Only read interactive maps if CustomPlay capability advertised
        let maps: RX9InteractiveMaps = [];
        if ('CustomPlay' in state.properties.reported.capabilities) {
            maps  = await api.getInteractiveMaps();
        }

        // Create the robot manager
        return new AEGApplianceRX9(log, config, api, appliance, info, state, maps);
    }
}