// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { ModeBase, RvcOperationalState } from 'matterbridge/matter/clusters';
import { VENDOR_ERROR_RX9 } from './endpoint-rx9.js';

// RVC Operational State errors
export class RvcOperationalStateError extends Error {

    // Create a new error
    constructor(
        readonly id:        RvcOperationalState.ErrorState | number,
        readonly label?:    string, // (if a manufacturer-specific id, otherwise undefined)
        readonly details?:  string,
        options?:           ErrorOptions
    ) {
        const idName = RvcOperationalState.ErrorState[id] ?? `0x${id.toString(16)}`;
        let message = label ?? idName;
        if (details) message += ` (${details})`;
        super(message, options);
        Error.captureStackTrace(this, RvcOperationalStateError);
        this.name = `RvcOperationalStateError[${idName}]`;
    }

    // Convert an arbitrary error (or nullish for success) to an ErrorStateId
    static toId(err?: unknown, defaultId = VENDOR_ERROR_RX9): RvcOperationalState.ErrorState | number {
        if (!err) return RvcOperationalState.ErrorState.NoError as number;
        return err instanceof RvcOperationalStateError ? err.id : defaultId;
    }

    // Convert an arbitrary error (or nullish for success) to an ErrorStateStruct
    static toStruct(err?: unknown, defaultId?: number): RvcOperationalState.ErrorStateStruct {
        return (err instanceof RvcOperationalStateError) ? {
            errorStateId:       err.id,
            errorStateLabel:    err.label  ?.substring(0, 64) ?? '',
            errorStateDetails:  err.details?.substring(0, 64) ?? ''
        } : {
            errorStateId:       this.toId(err, defaultId),
            errorStateLabel:    err instanceof Error ? err.message.substring(0, 64)
                                : err ? 'Unknown error' : '',
            errorStateDetails:  ''
        };
    }

    // Convert an arbitrary error (or nullish for success) to an OperationalCommandResponse
    static toResponse(err?: unknown, defaultId?: number): RvcOperationalState.OperationalCommandResponse {
        return { commandResponseState: RvcOperationalStateError.toStruct(err, defaultId) };
    }

    // Helper function to create a new error class with a specific status code
    static create(
        idName: keyof typeof RvcOperationalState.ErrorState
    ): new (details?: string, options?: ErrorOptions) => RvcOperationalStateError {
        return class extends RvcOperationalStateError {
            constructor(details?: string, options?: ErrorOptions) {
                const id = RvcOperationalState.ErrorState[idName];
                super(id, undefined, details, options);
            }
        };
    }

    // Standard error codes defined by the RVC Operational State Cluster
    static readonly NoError                   = this.create('NoError');
    static readonly UnableToStartOrResume     = this.create('UnableToStartOrResume');
    static readonly UnableToCompleteOperation = this.create('UnableToCompleteOperation');
    static readonly CommandInvalidInState     = this.create('CommandInvalidInState');
    static readonly FailedToFindChargingDock  = this.create('FailedToFindChargingDock');
    static readonly Stuck                     = this.create('Stuck');
    static readonly DustBinMissing            = this.create('DustBinMissing');
    static readonly DustBinFull               = this.create('DustBinFull');
    static readonly WaterTankEmpty            = this.create('WaterTankEmpty');
    static readonly WaterTankMissing          = this.create('WaterTankMissing');
    static readonly WaterTankLidOpen          = this.create('WaterTankLidOpen');
    static readonly MopCleaningPadMissing     = this.create('MopCleaningPadMissing');
}

// RVC Clean/Run Mode ChangeToMode errors
export class ChangeToModeError extends Error {

    // Create a new error
    constructor(readonly status: ModeBase.ModeChangeStatus | number, message?: string, options?: ErrorOptions) {
        super(message, options);
        Error.captureStackTrace(this, ChangeToModeError);
        const statusName = ModeBase.ModeChangeStatus[status];
        this.name = `ChangeToModeError[${statusName ?? `0x${status.toString(16)}`}]`;
    }

    // Convert an arbitrary error (or nullish for success) to a ChangeToModeResponse
    static toResponse(err?: unknown): ModeBase.ChangeToModeResponse {
        return {
            status:     err instanceof ChangeToModeError ? err.status
                        : ModeBase.ModeChangeStatus[err ? 'GenericFailure' : 'Success'],
            statusText: err instanceof Error ? err.message.substring(0, 64) : 'Unable to change mode'
        };
    }

    // Helper function to create a new error class with a specific status code
    static create(statusName: keyof typeof ModeBase.ModeChangeStatus): new (message?: string, options?: ErrorOptions) => ChangeToModeError {
        const statusCode = ModeBase.ModeChangeStatus[statusName];
        return class extends ChangeToModeError {
            constructor(message?: string, options?: ErrorOptions) {
                message ??= `ChangeToMode status ${statusName}`;
                super(statusCode, message, options);
            }
        };
    }

    // Standard status codes defined by the Mode Base Cluster
    static readonly Success         = this.create('Success');
    static readonly UnsupportedMode = this.create('UnsupportedMode');
    static readonly GenericFailure  = this.create('GenericFailure');
    static readonly InvalidInMode   = this.create('InvalidInMode');
}