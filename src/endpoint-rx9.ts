// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    bridgedNode,
    DeviceTypeDefinition,
    MatterbridgeEndpoint,
    powerSource,
    roboticVacuumCleaner
} from 'matterbridge';
import {
    BasicInformationServer,
    BridgedDeviceBasicInformationServer,
    PowerSourceServer
} from 'matterbridge/matter/behaviors';
import {
    BasicInformation,
    PowerSource,
    RvcCleanMode,
    RvcRunMode,
    ServiceArea
} from 'matterbridge/matter/clusters';
import {
    BehaviorDeviceRX9,
    BehaviorRX9,
    EndpointCommandsRX9,
    RvcCleanModeRX9,
    RvcCleanModeServerRX9,
    RvcOperationalStateRX9,
    RvcOperationalStateServerRX9,
    RvcRunModeRX9,
    RvcRunModeServerRX9,
    ServiceAreaServerRX9
} from './behavior-rx9.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { RvcOperationalStateError } from './error-rx9.js';
import { AtLeastOne, ServerNode } from 'matterbridge/matter';

// Device-specific endpoint configuration
export interface EndpointInformationRX9 {
    // Matter.js endpoint identifier
    uniqueStorageKey:       string;
    // Device Basic Information cluster attributes
    hardwareVersion:        string; // 64 characters max
    manufacturingDate:      string; // 'YYYMMDD'
    nodeLabel:              string, // 32 characters max
    partNumber:             string; // 32 characters max
    productAppearance?:     BasicInformation.ProductAppearance;
    productId:              number; // uint16
    productLabel:           string; // 64 characters max
    productName:            string; // 32 characters max
    productUrl:             string; // 256 characters max
    serialNumber:           string; // 32 characters max
    softwareVersion:        string; // 64 characters max
    uniqueId:               string; // 32 characters max
    vendorId:               number; // uint16
    vendorName:             string; // 32 characters max
    // RVC Clean Mode cluster configuration
    smartPowerCapable:      boolean;
    // Service Area cluster attributes
    supportedAreas:         ServiceArea.Area[];
    supportedMaps:          ServiceArea.Map[];
}

// A Matterbridge endpoint with robot vacuum cleaner clusters
export class EndpointRX9 extends MatterbridgeEndpoint {

    // Command handlers
    readonly behaviorDeviceRX9: BehaviorDeviceRX9;

    // Construct a new endpoint
    constructor(
        log:                    AnsiLogger,
        readonly config:        Config,
        readonly information:   EndpointInformationRX9
    ) {
        const definition: AtLeastOne<DeviceTypeDefinition> = [roboticVacuumCleaner, powerSource];
        const mode = config.enableServerRvc ? 'server' : undefined;
        if (!mode) definition.push(bridgedNode);
        const debug = config.debugFeatures.includes('Log Endpoint Debug');
        super(definition, { uniqueStorageKey: information.uniqueStorageKey, mode }, debug);

        // Use supplied logger instead of the one created by the base class
        this.log = log;

        // Matterbridge requires a unique name for each endpoint
        this.deviceName             = information.nodeLabel;

        // Copy of values (possibly) required by Matterbridge
        this.hardwareVersion        = parseInt(this.information.hardwareVersion, 10);
        this.hardwareVersionString  = information.hardwareVersion;
        this.productId              = information.productId;
        this.productName            = information.productName;
        this.serialNumber           = information.serialNumber;
        this.softwareVersion        = parseInt(this.information.softwareVersion, 10);
        this.softwareVersionString  = information.softwareVersion;
        this.uniqueId               = information.uniqueId;
        this.vendorId               = information.vendorId;
        this.vendorName             = information.vendorName;

        // Create the clusters
        // (Matterbridge creates the Basic Information cluster in 'server' mode)
        if (!mode) this.createBridgedDeviceBasicInformationClusterServer();
        this.createDefaultIdentifyClusterServer()
            .createPowerSourceClusterServer()
            .createRvcRunModeClusterServer()
            .createRvcCleanModeClusterServer()
            .createRvcOperationalStateClusterServer();
        if (information.supportedAreas.length) {
            this.createServiceAreaClusterServer();
        }

        // Add a command handler behavior
        this.behaviorDeviceRX9 = new BehaviorDeviceRX9(this.log);
        this.behaviors.require(BehaviorRX9, { device: this.behaviorDeviceRX9 });
    }

    // Perform any post-registration setup
    async postRegister(): Promise<void> {
        // Matterbridge incorrectly sets Basic Information cluster attributes
        if (this.serverNode) {
            this.log.info('Patching Basic Information cluster attributes');
            await this.patchBasicInformationClusterServer(this.serverNode);
        }
    }

    // Patch the Basic Information cluster attributes with correct values
    async patchBasicInformationClusterServer(serverNode: ServerNode): Promise<void> {
        await serverNode.setStateOf(BasicInformationServer, {
            // Mandatory attributes that should already be set correctly:
            //   productId, productName, vendorId, vendorName
            // Mandatory attributes incorrectly set by Matterbridge
            hardwareVersion:        parseInt(this.information.hardwareVersion, 10),
            hardwareVersionString:  this.information.hardwareVersion    .substring(0, 64),
            nodeLabel:              this.information.nodeLabel          .substring(0, 32),
            softwareVersion:        parseInt(this.information.softwareVersion, 10),
            softwareVersionString:  this.information.softwareVersion    .substring(0, 64),
            // Optional attributes incorrectly set by Matterbridge
            manufacturingDate:      this.information.manufacturingDate  .substring(0, 16),
            partNumber:             this.information.partNumber         .substring(0, 32),
            productAppearance:      this.information.productAppearance,
            productLabel:           this.information.productLabel       .substring(0, 64),
            productUrl:             this.information.productUrl         .substring(0, 256),
            serialNumber:           this.information.serialNumber       .substring(0, 32)
        });
    }

    // Create the Bridged Device Basic Information cluster
    createBridgedDeviceBasicInformationClusterServer(): this {
        this.behaviors.require(BridgedDeviceBasicInformationServer.enable({
            events: {
                leave:              true,
                reachableChanged:   true
            }
        }), {
            // Constant attributes
            uniqueId:               this.information.uniqueId           .substring(0, 32),
            hardwareVersion:        parseInt(this.information.hardwareVersion, 10),
            hardwareVersionString:  this.information.hardwareVersion    .substring(0, 64),
            manufacturingDate:      this.information.manufacturingDate,
            nodeLabel:              this.information.nodeLabel          .substring(0, 32),
            partNumber:             this.information.partNumber         .substring(0, 32),
            productAppearance:      this.information.productAppearance,
            productLabel:           this.information.productLabel       .substring(0, 64),
            productName:            this.information.productName        .substring(0, 32),
            productUrl:             this.information.productUrl         .substring(0, 256),
            serialNumber:           this.information.serialNumber       .substring(0, 32),
            vendorName:             this.information.vendorName         .substring(0, 32),
            // Variable attributes
            reachable:              true,
            softwareVersion:        parseInt(this.information.softwareVersion, 10),
            softwareVersionString:  this.information.softwareVersion    .substring(0, 64),
            // Unsupported attributes (no certified AEG/Electrolux Matter products)
            vendorId:               undefined,
            productId:              undefined
        });
        return this;
    }

    // Create the Power Source cluster for the rechargeable battery
    createPowerSourceClusterServer(): this {
        this.behaviors.require(PowerSourceServer.withFeatures(
            PowerSource.Feature.Battery,
            PowerSource.Feature.Rechargeable,
            PowerSource.Feature.Replaceable
        ), {
            // Constant attributes
            order:                      0,
            description:                'Primary Batteries',
            batReplacementNeeded:       false,
            batPresent:                 true,
            batReplaceability:          PowerSource.BatReplaceability.UserReplaceable,
            batReplacementDescription:  'Electrolux OSBP72L125 / AEG OSBP72LI (2 × 7.2V Li-ion)',
            batApprovedChemistry:       PowerSource.BatApprovedChemistry.LithiumIon,
            batCapacity:                2500, // 18Wh at 7.2V = 2.5Ah
            batQuantity:                2,
            batFunctionalWhileCharging: false,
            endpointList:               [],
            // Variable attributes (with dummy defaults)
            status:                     PowerSource.PowerSourceStatus.Active,
            batPercentRemaining:        null,
            batChargeLevel:             PowerSource.BatChargeLevel.Ok,
            batChargeState:             PowerSource.BatChargeState.Unknown,
            // Unsupported attributes
            batVoltage:                 null,
            batTimeRemaining:           undefined,
            activeBatFaults:            undefined,
            batCommonDesignation:       undefined,
            batAnsiDesignation:         undefined,
            batIecDesignation:          undefined,
            batTimeToFullCharge:        undefined,
            batChargingCurrent:         undefined,
            activeBatChargeFaults:      undefined
        });
        return this;
    }

    // Create the RVC Run Mode cluster
    createRvcRunModeClusterServer(): this {
        this.behaviors.require(RvcRunModeServerRX9.enable({
            commands: {
                changeToMode: true
            }
        }), {
            // Constant attributes
            supportedModes: [{
                label:      'Idle',
                mode:       RvcRunModeRX9.Idle,
                modeTags:   [{ value: RvcRunMode.ModeTag.Idle }]
            }, {
                label:      'Cleaning',
                mode:       RvcRunModeRX9.Cleaning,
                modeTags:   [{ value: RvcRunMode.ModeTag.Cleaning }]
            }],
            // Variable attributes (with dummy defaults)
            currentMode:    RvcRunModeRX9.Idle
        });
        return this;
    }

    // Create the RVC Clean Mode cluster
    createRvcCleanModeClusterServer(): this {
        const tag = RvcCleanMode.ModeTag;
        this.behaviors.require(RvcCleanModeServerRX9.enable({
            commands: {
                changeToMode: true
            }
        }), {
            // Constant attributes
            supportedModes: [{
                label:      'Quiet Cleaning',
                mode:       RvcCleanModeRX9.Quiet,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Quiet },
                    { value: tag.LowNoise },
                    { value: tag.LowEnergy },
                    { value: tag.Min }
                ]
            }, {
                label:      'Smart Cleaning',
                mode:       RvcCleanModeRX9.Smart,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Auto }
                ]
            }, {
                label:      'Power Cleaning',
                mode:       RvcCleanModeRX9.Power,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Max },
                    { value: tag.DeepClean }
                ]
            }, {
                label:      'Quiet Spot Cleaning',
                mode:       RvcCleanModeRX9.QuietSpot,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Quick },
                    { value: tag.Quiet },
                    { value: tag.LowNoise },
                    { value: tag.LowEnergy },
                    { value: tag.Min }
                ]
            }, {
                label:      'Smart Spot Cleaning',
                mode:       RvcCleanModeRX9.SmartSpot,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Quick },
                    { value: tag.Auto }
                ]
            }, {
                label:      'Power Spot Cleaning',
                mode:       RvcCleanModeRX9.PowerSpot,
                modeTags:   [
                    { value: tag.Vacuum },
                    { value: tag.Quick },
                    { value: tag.Max },
                    { value: tag.DeepClean }
                ]
            }].filter(mode => this.information.smartPowerCapable || mode.modeTags.some(t => t.value !== tag.Auto)),
            // Variable attributes (with dummy defaults)
            currentMode:    RvcCleanModeRX9.Quiet
        });
        return this;
    }

    // Create the RVC Operational State cluster
    createRvcOperationalStateClusterServer(): this {
        this.behaviors.require(RvcOperationalStateServerRX9.enable({
            events: {
                operationalError:       true,
                operationCompletion:    true
            }, commands: {
                pause:                  true,
                resume:                 true,
                goHome:                 true
            }
        }), {
            // Constant attributes
            operationalStateList: [{
                operationalStateId:     RvcOperationalStateRX9.Stopped
            }, {
                operationalStateId:     RvcOperationalStateRX9.Running
            }, {
                operationalStateId:     RvcOperationalStateRX9.Paused
            }, {
                operationalStateId:     RvcOperationalStateRX9.Error
            }, {
                operationalStateId:     RvcOperationalStateRX9.SeekingCharger
            }, {
                operationalStateId:     RvcOperationalStateRX9.Charging
            }, {
                operationalStateId:     RvcOperationalStateRX9.Docked
            }, {
                operationalStateId:     RvcOperationalStateRX9.ManualSteering,
                operationalStateLabel: 'Manual Steering'
            }, {
                operationalStateId:     RvcOperationalStateRX9.FirmwareUpgrade,
                operationalStateLabel: 'Firmware Upgrade'
            }],
            // Variable attributes (with dummy defaults)
            operationalState:       RvcOperationalStateRX9.Stopped,
            operationalError:       RvcOperationalStateError.toStruct(),
            // Unsupported attributes
            phaseList:              null,
            currentPhase:           null,
            countdownTime:          null
        });
        return this;
    }

    // Create Service Area cluster
    createServiceAreaClusterServer(): this {
        this.behaviors.require(ServiceAreaServerRX9.withFeatures(
            ServiceArea.Feature.Maps,
            ServiceArea.Feature.SelectWhileRunning,
            ServiceArea.Feature.ProgressReporting
        ).enable({
            commands: {
                selectAreas:            true
            }
        }), {
            // Constant attributes
            supportedAreas:         this.information.supportedAreas,
            supportedMaps:          this.information.supportedMaps,
            // Variable attributes (with dummy defaults)
            currentArea:            null,
            progress:               [],
            selectedAreas:          [],
            // Unsupported attributes
            estimatedEndTime:       undefined
        });
        return this;
    }

    // Set a command handler
    setCommandHandlerRX9<Command extends keyof EndpointCommandsRX9>(command: Command, handler: EndpointCommandsRX9[Command]): this {
        this.behaviorDeviceRX9.setCommandHandler(command, handler);
        return this;
    }
}