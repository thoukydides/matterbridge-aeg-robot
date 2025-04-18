// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    AtLeastOne,
    bridgedNode,
    DeviceTypeDefinition,
    MatterbridgeEndpoint,
    powerSource,
    roboticVacuumCleaner
} from 'matterbridge';
import {
    BridgedDeviceBasicInformationServer,
    PowerSourceServer
} from 'matterbridge/matter/behaviors';
import {
    BasicInformation,
    PowerSource,
    RvcCleanMode,
    RvcOperationalState,
    RvcRunMode
} from 'matterbridge/matter/clusters';
import {
    BehaviorDeviceRX9,
    BehaviorRX9,
    EndpointCommandsRX9,
    RvcCleanModeServerRX9,
    RvcOperationalStateServerRX9,
    RvcRunModeServerRX9
} from './behavior-rx9.js';
import { AnsiLogger } from 'matterbridge/logger';
import { PLUGIN_URL } from './settings.js';
import { Config } from './config-types.js';
import { RvcOperationalStateError } from './error-rx9.js';

// Device-specific endpoint configuration
export interface EndpointInformationRX9 {
    // Matter.js endpoint identifier
    uniqueStorageKey:       string;
    // Device Basic Information cluster attributes
    uniqueId:               string; // 32 characters max
    vendorName:             string; // 32 characters max
    productName:            string; // 32 characters max
    nodeLabel:              string, // 32 characters max
    hardwareVersion:        string; // 64 characters max
    softwareVersion:        string; // 64 characters max
    manufacturingDate:      string; // 'YYYMMDD'
    partNumber:             string; // 32 characters max
    productLabel:           string; // 64 characters max
    serialNumber:           string; // 32 characters max
    productAppearance?:     BasicInformation.ProductAppearance;
    // Other endpoint configuration
    smartPowerCapable:      boolean;
}

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
    // HERE - Add these after patching the schema
    //ManualSteering  = 0x80,
    //FirmwareUpgrade
}

// OperationalStatus manufacturer error
// HERE - Use 0x80 after patching the schema
//export const VENDOR_ERROR_RX9 = 0x80;
export const VENDOR_ERROR_RX9 = RvcOperationalState.ErrorState.UnableToCompleteOperation;

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
        const definition: AtLeastOne<DeviceTypeDefinition> = [roboticVacuumCleaner, bridgedNode, powerSource];
        const debug = config.debugFeatures.includes('Log Endpoint Debug');
        super(definition, { uniqueStorageKey: information.uniqueStorageKey }, debug);

        // Use supplied logger instead of the one created by the base class
        this.log = log;

        // Create the clusters
        this.createDefaultIdentifyClusterServer()
            .createBridgedDeviceBasicInformationClusterServer()
            .createPowerSourceClusterServer()
            .createRvcRunModeClusterServer()
            .createRvcCleanModeClusterServer()
            .createRvcOperationalStateClusterServer();

        // Add a command handler behavior
        this.behaviorDeviceRX9 = new BehaviorDeviceRX9(this.log);
        this.behaviors.require(BehaviorRX9, { device: this.behaviorDeviceRX9 });
    }

    // Create the Bridged Device Basic Information cluster
    createBridgedDeviceBasicInformationClusterServer(): this {
        // Copy of values (possibly) required by Matterbridge
        this.deviceName             = this.information.nodeLabel;
        this.serialNumber           = this.information.serialNumber;
        this.uniqueId               = this.information.uniqueId;
        this.productId              = undefined;
        this.productName            = this.information.productName;
        this.vendorId               = undefined;
        this.vendorName             = this.information.vendorName;
        this.softwareVersion        = parseInt(this.information.softwareVersion, 10);
        this.softwareVersionString  = this.information.softwareVersion;
        this.hardwareVersion        = parseInt(this.information.hardwareVersion, 10);
        this.hardwareVersionString  = this.information.hardwareVersion;

        // Create the cluster
        this.behaviors.require(BridgedDeviceBasicInformationServer.enable({
            events: {
                leave:              true,
                reachableChanged:   true
            }
        }), {
            // Constant attributes
            uniqueId:               this.information.uniqueId           .substring(0, 32),
            vendorName:             this.information.vendorName         .substring(0, 32),
            productName:            this.information.productName        .substring(0, 32),
            nodeLabel:              this.information.nodeLabel          .substring(0, 32),
            hardwareVersion:        parseInt(this.information.hardwareVersion, 10),
            hardwareVersionString:  this.information.hardwareVersion    .substring(0, 64),
            manufacturingDate:      this.information.manufacturingDate,
            partNumber:             this.information.partNumber         .substring(0, 32),
            productUrl:             PLUGIN_URL,
            productLabel:           this.information.productLabel       .substring(0, 64),
            serialNumber:           this.information.serialNumber       .substring(0, 32),
            productAppearance:      this.information.productAppearance,
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
            //},
            // HERE - Add these after modifying the schema
            //{
            //    operationalStateId:     RvcOperationalStateRX9.ManualSteering,
            //    operationalStateLabel: 'Manual Steering'
            //}, {
            //    operationalStateId:     RvcOperationalStateRX9.FirmwareUpgrade,
            //    operationalStateLabel: 'Firmware Upgrade'
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

    // Set a command handler
    setCommandHandlerRX9<Command extends keyof EndpointCommandsRX9>(command: Command, handler: EndpointCommandsRX9[Command]): this {
        this.behaviorDeviceRX9.setCommandHandler(command, handler);
        return this;
    }
}