// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { Behavior, MaybePromise } from 'matterbridge/matter';
import { ClusterModel, FieldElement } from 'matterbridge/matter';
import { ModeBase, RvcOperationalState } from 'matterbridge/matter/clusters';
import {
    RvcCleanModeBehavior,
    RvcOperationalStateBehavior,
    RvcRunModeBehavior
} from 'matterbridge/matter/behaviors';
import {
    RvcCleanModeRX9,
    RvcOperationalStateRX9,
    RvcRunModeRX9,
    VENDOR_ERROR_RX9
} from './endpoint-rx9.js';
import { AnsiLogger } from 'matterbridge/logger';
import { ChangeToModeError, RvcOperationalStateError } from './error-rx9.js';
import { assertIsDefined, assertIsInstanceOf, logError } from './utils.js';

// Endpoint commands
export interface EndpointCommandsRX9 {
    ChangeRunMode:   (newMode: RvcRunModeRX9)   => MaybePromise;
    ChangeCleanMode: (newMode: RvcCleanModeRX9) => MaybePromise;
    Pause:           ()                         => MaybePromise;
    Resume:          ()                         => MaybePromise;
    GoHome:          ()                         => MaybePromise;
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
        const extendEnum = (name: string, values: FieldElement[]): void => {
            const element = schema.datatypes.find(e => e.name === name);
            assertIsDefined(element);
            element.children = [...element.children, ...values];
        };

        // Add manufacturer-specific OperationalState values
        extendEnum('OperationalStateEnum', [
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
        extendEnum('ErrorStateEnum', [
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