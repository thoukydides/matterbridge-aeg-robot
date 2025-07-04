// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { EndpointRX9 } from './endpoint-rx9.js';
import {
    RvcCleanModeRX9,
    RvcOperationalStateRX9,
    RvcRunModeRX9
} from './behavior-rx9.js';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { BabelRX9 } from './babel-rx9.js';
import {
    BridgedDeviceBasicInformation,
    OperationalState,
    PowerSource,
    RvcCleanMode,
    RvcOperationalState,
    RvcRunMode
} from 'matterbridge/matter/clusters';
import {
    ChangeToModeError,
    RvcOperationalStateError
} from './error-rx9.js';
import { isDeepStrictEqual } from 'util';
import { formatSeconds, MS } from './utils.js';
import { ActivityRX9 } from './aeg-appliance-rx9-ctrl-activity.js';
import { AN, AV, CN, CV, RR } from './logger.js';

// A Matterbridge robot vacuum cleaner device
export class DeviceRX9 extends EndpointRX9 {

    // Translation from Electrolux Global API to Matter attributes
    babel:      BabelRX9;

    // State for determining whether to trigger an event
    private lastIsActive = false;
    private startActive = 0;
    private lastOperationalError = RvcOperationalStateError.toStruct();

    // Construct a new endpoint
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly appliance: AEGApplianceRX9
    ) {
        // Create a robot vacuum cleaner device
        const babel = new BabelRX9(log, config, appliance);
        super(log, config, babel.static);
        this.babel = babel;

        // Update the cluster attributes and trigger events when required
        this.updateBridgedBasicInformation();
        this.updatePowerSource();
        this.updateRvcRunMode();
        this.updateRvcCleanMode();
        this.updateRvcOperationalState();

        // Identify the device
        this.addCommandHandler('identify', () => {
            this.log.info(`${CN}Identify device${RR}`);
        });

        // Handle RVC Operational State Pause/Resume/GoHome commands
        this.setCommandHandlerRX9('Pause', async () => {
            const activity: ActivityRX9 = 'Pause';
            this.log.info(`${CN}RVC Operational State ${CV}Pause${RR} → ${CV}${activity}${RR}`);
            const allowed = await this.appliance.setActivity(activity);
            if (!allowed) throw new RvcOperationalStateError.CommandInvalidInState();
        });
        this.setCommandHandlerRX9('Resume', async () => {
            const activity: ActivityRX9 = 'Resume';
            this.log.info(`${CN}RVC Operational State ${CV}Resume${RR} → ${CV}${activity}${RR}`);
            const allowed = await this.appliance.setActivity(activity);
            if (!allowed) throw new RvcOperationalStateError.CommandInvalidInState();
        });
        this.setCommandHandlerRX9('GoHome', async () => {
            const activity: ActivityRX9 = 'Home';
            this.log.info(`${CN}RVC Operational State ${CV}GoHome${RR} → ${CV}${activity}${RR}`);
            const allowed = await this.appliance.setActivity(activity);
            if (!allowed) throw new RvcOperationalStateError.CommandInvalidInState();
        });

        // Handle RVC Run Mode cluster ChangeToMode commands
        this.setCommandHandlerRX9('ChangeRunMode', async newMode => {
            const activityMap: Record<RvcRunModeRX9, ActivityRX9> = {
                [RvcRunModeRX9.Idle]:       'Stop',
                [RvcRunModeRX9.Cleaning]:   'Clean'
            };
            const activity = activityMap[newMode];
            this.log.info(`${CN}RVC Run Mode${RR} ChangeToMode ${CV}${RvcRunModeRX9[newMode]}${RR}`
                        + ` (${CV}${newMode}${RR}) → ${CV}${activity}${RR}`);
            const allowed = await this.appliance.setActivity(activity);
            if (!allowed) throw new ChangeToModeError.InvalidInMode();
        });

        // Reject all RVC Clean Mode cluster ChangeToMode commands
        this.setCommandHandlerRX9('ChangeCleanMode', newMode => {
            // API does not support changing power mode or selecting spot cleaning
            this.log.info(`${CN}RVC Clean Mode${RR} ChangeToMode ${CV}${RvcCleanModeRX9[newMode]}${RR}`
                + ` (${CV}${newMode}${RR}) → ${CV}not supported${RR}`);
            throw new Error('Unsupported by Electrolux Global API');
        });

        // Handle Service Area SelectAreas commands
        this.setCommandHandlerRX9('SelectAreas', newAreas => {
            this.babel.areas.selectedAreas = newAreas;
            this.log.info(`${CN}ServiceArea${RR} SelectAreas ${CV}${this.babel.areas.toString()}${RR}`);
        });
    }

    // Start polling the device and set the initial state
    async start(): Promise<void> {
        await this.appliance.start();
    }

    // Stop polling the device
    async stop(): Promise<void> {
        await this.appliance.stop();
    }

    // Update the Bridged Basic Information cluster attributes when required
    updateBridgedBasicInformation(): void {
        this.babel.on('reachable', async reachable => {
            const clusterId = BridgedDeviceBasicInformation.Cluster.id;
            this.log.info(`${AN}Reachable${RR}: ${AV}${reachable}${RR}`);
            await this.updateAttribute(clusterId, 'reachable', reachable, this.log);
            const payload: BridgedDeviceBasicInformation.ReachableChangedEvent = { reachableNewValue: reachable };
            await this.triggerEvent(clusterId, 'reachableChanged', payload, this.log);
        }).on('softwareVersion', async version => {
            const clusterId = BridgedDeviceBasicInformation.Cluster.id;
            this.log.info(`${AN}Software version${RR}: ${AV}${version}${RR}`);
            await this.updateAttribute(clusterId, 'softwareVersion',        parseInt(version, 10),  this.log);
            await this.updateAttribute(clusterId, 'softwareVersionString',  version,                this.log);
        });
    }

    // Update the Power Source cluster attributes when required
    updatePowerSource(): void {
        this.babel.on('batteryStatus', async ({ status, batPercentRemaining, batChargeLevel, batChargeState }) => {
            const clusterId = PowerSource.Cluster.id;
            const logMessage = `${AN}Battery status${RR}: ${AV}${batPercentRemaining / 2}${RR}%`
                             + ` ${AV}${PowerSource.BatChargeLevel[batChargeLevel]}${RR} (${AV}${batChargeLevel}${RR}),`
                             + ` ${AV}${PowerSource.PowerSourceStatus[status]}${RR} (${AV}${status}${RR}),`
                             + ` ${AV}${PowerSource.BatChargeState[batChargeState]}${RR} (${AV}${batChargeState}${RR})`;
            this.log.info(logMessage);
            await this.updateAttribute(clusterId, 'status',              status,              this.log);
            await this.updateAttribute(clusterId, 'batPercentRemaining', batPercentRemaining, this.log);
            await this.updateAttribute(clusterId, 'batChargeLevel',      batChargeLevel,      this.log);
            await this.updateAttribute(clusterId, 'batChargeState',      batChargeState,      this.log);
        });
    }

    // Update the RVC Run Mode cluster attributes when required
    updateRvcRunMode(): void {
        this.babel.on('runMode', async runMode => {
            const clusterId = RvcRunMode.Cluster.id;
            this.log.info(`${AN}RVC Run Mode${RR}: ${AV}${RvcRunModeRX9[runMode]}${RR} (${AV}${runMode}${RR})`);
            await this.updateAttribute(clusterId, 'currentMode', runMode, this.log);
        });
    }

    // Update the RVC Clean Mode cluster attributes when required
    updateRvcCleanMode(): void {
        this.babel.on('cleanMode', async cleanMode => {
            const clusterId = RvcCleanMode.Cluster.id;
            this.log.info(`${AN}RVC Clean Mode${RR}: ${AV}${RvcCleanModeRX9[cleanMode]}${RR} (${AV}${cleanMode}${RR})`);
            await this.updateAttribute(clusterId, 'currentMode', cleanMode, this.log);
        });
    }

    // Update the RVC Operational State cluster attributes when required
    updateRvcOperationalState(): void {
        this.babel.on('operationalState', async ({ operationalState, operationalError, isActive }) => {
            const clusterId = RvcOperationalState.Cluster.id;
            this.log.info(`${AN}RVC Operational State${RR}: ${AV}${RvcOperationalStateRX9[operationalState]}${RR}`
                        + ` (${AV}${operationalState}${RR})`);
            await this.updateAttribute(clusterId, 'operationalState', operationalState, this.log);
            await this.updateAttribute(clusterId, 'operationalError', operationalError, this.log);

            // Trigger OperationCompletion event when changing from active to idle
            const { errorStateId, errorStateLabel, errorStateDetails } = operationalError;
            const isError = errorStateId !== RvcOperationalState.ErrorState.NoError;
            if (this.lastIsActive !== isActive) {
                this.lastIsActive = isActive;
                if (isActive) {
                    this.log.info(`(${AN}RVC Operation Started${RR})`);
                    this.startActive = Date.now();
                } else {
                    const totalOperationalTime = Math.round((Date.now() - this.startActive) / MS);
                    this.log.info(`${AN}RVC Operation Completion${RR} in ${AV}${formatSeconds(totalOperationalTime)}${RR}`);
                    const payload: OperationalState.OperationCompletionEvent = {
                        completionErrorCode:    errorStateId,
                        totalOperationalTime
                    };
                    await this.triggerEvent(clusterId, 'operationCompletion', payload, this.log);
                }
            }

            // Trigger OperationalError event if there is a new error
            if (!isDeepStrictEqual(this.lastOperationalError, operationalError)) {
                this.lastOperationalError = operationalError;
                if (isError) {
                    const errorName = RvcOperationalState.ErrorState[errorStateId];
                    let logMessage = `${AN}RVC Operational Error${RR}:`
                                   + ` ${errorName ? `${AV}${errorName}${RR} (${AV}${errorStateId}${RR})` : `${AV}${errorStateId}${RR}`}`;
                    if (errorStateLabel)   logMessage += ` [${AV}${errorStateLabel}${RR}]`;
                    if (errorStateDetails) logMessage += `: ${AV}${errorStateDetails}${RR}`;
                    this.log.info(logMessage);
                    const payload: RvcOperationalState.OperationalErrorEvent = {
                        errorState: operationalError
                    };
                    await this.triggerEvent(clusterId, 'operationalError', payload, this.log);
                } else {
                    this.log.info(`${AN}RVC Operational Error${RR}: ${AV}Error cleared${RR}`);
                }
            }
        });
    }
}