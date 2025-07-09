// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { Behavior, MaybePromise } from 'matterbridge/matter';
import { ClusterModel, FieldElement } from 'matterbridge/matter';
import { ModeBase, RvcOperationalState, ServiceArea } from 'matterbridge/matter/clusters';
import {
    RvcCleanModeBehavior,
    RvcOperationalStateBehavior,
    RvcRunModeBehavior,
    ServiceAreaBehavior
} from 'matterbridge/matter/behaviors';
import { AnsiLogger } from 'matterbridge/logger';
import { ChangeToModeError, RvcOperationalStateError, SelectAreaError } from './error-rx9.js';
import { assertIsDefined, assertIsInstanceOf, formatList } from './utils.js';
import { isDeepStrictEqual } from 'util';
import { logError } from './log-error.js';

// Robot Vacuum Cleaner Run Mode cluster modes
export enum RvcRunModeRX9 {
    Idle,
    Cleaning
}

// Robot Vacuum Cleaner Clean Mode cluster modes
export enum RvcCleanModeRX9 {
    Quiet,
    Smart,      // (not RX9.1)
    Power,
    QuietSpot,
    SmartSpot,  // (not RX9.1)
    PowerSpot
}

// Robot Vacuum Cleaner Operational State cluster operational states
export enum RvcOperationalStateRX9 {
    // 0x00~0x3F: General (Operational State) states
    Stopped         = 0x00,
    Running,
    Paused,
    Error,
    // 0x40~0x7F: Derived cluster (RVC Operational State) states
    SeekingCharger  = 0x40,
    Charging,
    Docked,
    // 0x80~0xBF: Manufacturer states
    ManualSteering  = 0x80,
    FirmwareUpgrade
}

// OperationalStatus manufacturer error
export const VENDOR_ERROR_RX9 = 0x80;

// Endpoint commands
export interface EndpointCommandsRX9 {
    ChangeRunMode:   (newMode: RvcRunModeRX9)   => MaybePromise;
    ChangeCleanMode: (newMode: RvcCleanModeRX9) => MaybePromise;
    Pause:           ()                         => MaybePromise;
    Resume:          ()                         => MaybePromise;
    GoHome:          ()                         => MaybePromise;
    SelectAreas:     (newAreas: number[])       => MaybePromise;
}
type EndpointCommandRX9Args<T extends keyof EndpointCommandsRX9> = Parameters<EndpointCommandsRX9[T]>;
type EndpointHandlerRX9<T extends keyof EndpointCommandsRX9> = (...args: EndpointCommandRX9Args<T>) => MaybePromise;

// Command handling behaviour for the endpoint
export class BehaviorDeviceRX9 {

    // Registered command handlers
    readonly commands: Partial<EndpointCommandsRX9> = {};

    // Construct new command handling behaviour
    constructor(readonly log: AnsiLogger) {}

    // Set a command handler
    setCommandHandler<Command extends keyof EndpointCommandsRX9>(command: Command, handler: EndpointCommandsRX9[Command]): void {
        if (this.commands[command]) throw new Error(`Handler already registered for command ${command}`);
        this.commands[command] = handler;
    }

    // Execute a command handler
    async executeCommand<Command extends keyof EndpointCommandsRX9>(
        command:    Command,
        ...args:    EndpointCommandRX9Args<Command>
    ): Promise<void> {
        const handler = this.commands[command];
        if (!handler) throw new Error(`${command} not implemented`);
        await (handler as EndpointHandlerRX9<Command>)(...args);
    }
}
export class BehaviorRX9 extends Behavior {
    static override readonly id = 'rx9';
    declare state: BehaviorRX9.State;
}
// eslint-disable-next-line @typescript-eslint/no-namespace
export namespace BehaviorRX9 {
    export class State {
        device!: BehaviorDeviceRX9;
    }
}

// Implement command handlers for the RVC Run Mode cluster
export class RvcRunModeServerRX9 extends RvcRunModeBehavior {

    // ChangeToMode command handler
    async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
        const { device } = this.agent.get(BehaviorRX9).state;
        const { log } = device;
        try {
            // Check whether it is a valid request
            log.info(`RVC Run Mode command: ChangeToMode ${newMode}`);
            const supported = this.state.supportedModes.some(({ mode }) => mode === newMode);
            if (!supported) throw new ChangeToModeError.UnsupportedMode;

            // Attempt to change the mode
            await device.executeCommand('ChangeRunMode', newMode);

            // Success
            return ChangeToModeError.toResponse();
        } catch (err) {
            logError(log, 'RVC Run Mode ChangeToMode', err);
            return ChangeToModeError.toResponse(err);
        }
    }
}

// Implement command handlers for the RVC Clean Mode cluster
export class RvcCleanModeServerRX9 extends RvcCleanModeBehavior {

    // ChangeToMode command handler
    async changeToMode({ newMode }: ModeBase.ChangeToModeRequest): Promise<ModeBase.ChangeToModeResponse> {
        const { device } = this.agent.get(BehaviorRX9).state;
        const { log } = device;
        try {
            // Check whether it is a valid request
            log.info(`RVC Clean Mode command: ChangeToMode ${newMode}`);
            const supported = this.state.supportedModes.some(({ mode }) => mode === newMode);
            if (!supported) throw new ChangeToModeError.UnsupportedMode;

            // Attempt to change the mode
            await device.executeCommand('ChangeCleanMode', newMode);

            // Success
            return ChangeToModeError.toResponse();
        } catch (err) {
            logError(log, 'RVC Clean Mode ChangeToMode', err);
            return ChangeToModeError.toResponse(err);
        }
    }
}

// Implement command handlers for the RVC Operational State cluster
export class RvcOperationalStateServerRX9 extends RvcOperationalStateBehavior {

    static {
        const schema = RvcOperationalStateServerRX9.schema;
        assertIsInstanceOf(schema, ClusterModel);

        // Add manufacturer-specific OperationalState values
        extendEnum(schema, 'OperationalStateEnum', [
            FieldElement({
                name:           'ManualSteering',
                id:             RvcOperationalStateRX9.ManualSteering,
                conformance:    'O',
                description:    'The device is being steered manually'
            }),
            FieldElement({
                name:           'FirmwareUpgrade',
                id:             RvcOperationalStateRX9.FirmwareUpgrade,
                conformance:    'O',
                description:    'The device firmware is being upgraded'
            })
        ]);

        // Add manufacturer-specific ErrorState values
        extendEnum(schema, 'ErrorStateEnum', [
            FieldElement({
                name:           'OtherError',
                id:             VENDOR_ERROR_RX9,
                conformance:    'O',
                description:    'The device has an error that is not covered by the Matter-defined error states'
            })
        ]);
    }

    // Common command handler
    async command(
        command: 'Pause' | 'Resume' | 'GoHome',
        defaultErrorId: RvcOperationalState.ErrorState
    ): Promise<RvcOperationalState.OperationalCommandResponse> {
        const { device } = this.agent.get(BehaviorRX9).state;
        const { log } = device;
        try {
            log.info(`RVC Operational State command: ${command}`);
            await device.executeCommand(command);
            return RvcOperationalStateError.toResponse();
        } catch (err) {
            logError(log, `RVC Operational State ${command}`, err);
            return RvcOperationalStateError.toResponse(err, defaultErrorId);
        }
    }

    // Pause command handler
    override pause():  Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('Pause', RvcOperationalState.ErrorState.CommandInvalidInState as number);
    }

    // Resume command handler
    override resume(): Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('Resume', RvcOperationalState.ErrorState.UnableToStartOrResume as number);
    }

    // GoHome command handler
    override goHome(): Promise<RvcOperationalState.OperationalCommandResponse> {
        return this.command('GoHome', RvcOperationalState.ErrorState.CommandInvalidInState as number);
    }
}

// Implement command handlers for the Service Areas cluster
export class ServiceAreaServerRX9 extends ServiceAreaBehavior {

    // SelectAreas command handler
    override async selectAreas({ newAreas }: ServiceArea.SelectAreasRequest): Promise<ServiceArea.SelectAreasResponse> {
        const { device } = this.agent.get(BehaviorRX9).state;
        const { log } = device;
        try {
            // Remove any duplicated areas from the list
            log.info(`Service Area command: SelectAreas ${formatList(newAreas.map(id => String(id)))}`);
            newAreas = [...new Set(newAreas)];

            // Check whether it is a valid request
            const maps = new Set<number | null>();
            for (const area of newAreas) {
                const supportedArea = this.state.supportedAreas.find(({ areaId }) => areaId === area);
                if (!supportedArea) throw new SelectAreaError.UnsupportedArea(`${area} is not a supported area`);
                maps.add(supportedArea.mapId);
            }

            // If all areas are specified then treat it as an empty list
            if (newAreas.length === this.state.supportedAreas.length) newAreas = [];
            else if (maps.size !== 1) throw new SelectAreaError.InvalidSet('Areas must all be from the same map');

            // Attempt to select the areas
            await device.executeCommand('SelectAreas', newAreas);
            this.state.selectedAreas = newAreas;

            // Success
            return SelectAreaError.toResponse();
        } catch (err) {
            if (isDeepStrictEqual(new Set(this.state.selectedAreas), new Set(newAreas))) {
                // Matter requires Success status if the areas are unchanged
                logError(log, 'Service Area SelectAreas (error ignored)', err);
                return SelectAreaError.toResponse();
            } else {
                logError(log, 'Service Area SelectAreas', err);
                return SelectAreaError.toResponse(err);
            }
        }
    }
}

// Extend a Matter.js schema enum with new values
function extendEnum(schema: ClusterModel, name: string, values: FieldElement[]): void {
    const element = schema.datatypes.find(e => e.name === name);
    assertIsDefined(element);
    for (const value of values) {
        // Re-use any existing definition of the same value
        if (element.children.some(e => e.id === value.id)) continue;

        // Ensure new values have unique names
        let name = value.name;
        let suffix = 0;
        while (element.children.some(e => e.name === name)) name += `_${++suffix}`;
        element.children = [...element.children, { ...value, name }];
    }
}