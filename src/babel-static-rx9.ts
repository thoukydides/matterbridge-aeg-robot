// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { BasicInformation, ServiceArea } from 'matterbridge/matter/clusters';
import { createHash } from 'node:crypto';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { EndpointInformationRX9 } from './endpoint-rx9.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { formatDateISO8601 } from './utils.js';
import { BabelServiceAreaRX9 } from './babel-areas-rx9.js';
import { PLUGIN_URL, VENDOR_ID } from './settings.js';

// Mapping from API colours to Matter ProductFinish equivalents
const COLOUR_MAP = new Map<string, BasicInformation.Color>([
    ['DARKGOLD',        BasicInformation.Color.Gold],
    ['INDIGOBLUE',      BasicInformation.Color.Blue],
    ['MAHOGANYBRONZE',  BasicInformation.Color.Brass],
    ['SHALEGREY',       BasicInformation.Color.Gray],
    ['SILVER',          BasicInformation.Color.Silver],
    ['SOFTSAND',        BasicInformation.Color.Olive],
    ['SPACETEAL',       BasicInformation.Color.Teal]
]);

// PNCs for model names
const FAMILY_MODEL_PNC: Record<string, Record<string, string[]>> = {
    // Electrolux models
    'PURE i9': {
        'PI91-5':     ['900277343'],
        'PI91-5SGM':  ['900277252', '900277255', '900277258', '900277261', '900277264'],
        'PI91-5MBM':  ['900277253'],
        'PI91-5SSM':  ['900277267', '900277269', '900277271', '900277273', '900277292', '900277293'],
        'PI91-5BSM':  ['900277254']
    },
    'PURE i9.2': {
        'PI92-4STN':  ['900277466'],
        'PI92-4ANM':  ['900277469'],
        'PI92-6DGM':  ['900277470'],
        'PI92-6SGM':  ['900277494'],
        'PI92-6STN':  ['900277491']
    },
    // AEG models
    'RX9.1': {
        'RX9-1-IBM':  ['900277268'],
        'RX9-1-SGM':  ['900277283']
    },
    'RX9.2': {
        'RX9-2-6IBM': ['900277480', '900277486'],
        'RX9-2-4STN': ['900277484', '900277478'],
        'RX9-2-4ANM': ['900277479', '900277485']
    }
};
interface FamilyModel { family: string, model: string };
const PNC_FAMILY_MODEL_LIST = Object.entries(FAMILY_MODEL_PNC).flatMap(([family, models]) =>
    Object.entries(models).flatMap(([model, pncs]) =>
        pncs.map<[string, FamilyModel]>((pnc) => { return [pnc, { family, model }];})));
const PNC_FAMILY_MODEL = new Map(PNC_FAMILY_MODEL_LIST);
if (PNC_FAMILY_MODEL.size !== PNC_FAMILY_MODEL_LIST.length) {
    throw new Error('Duplicate PNCs in FAMILY_MODEL_PNC');
}

// Translation of static appliance information to Matter attributes
export class BabelStaticRX9 implements EndpointInformationRX9 {

    // Construct a new translator
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly appliance: AEGApplianceRX9,
        readonly areas:     BabelServiceAreaRX9
    ) {}

    // Generate a human-readable unique storage key
    get uniqueStorageKey(): string {
        // Avoid issues with redacted logs by using an opaque value
        return this.uniqueId;
    }

    // Use the Appliance ID to generate a 32-character opaque unique ID
    get uniqueId(): string {
        const { pnc, applianceId } = this.appliance;
        const hash = createHash('sha256').update(applianceId).digest('hex');
        return `rx9-${pnc}-${hash}`.substring(0, 32);
    }

    // Use the plugin's project page as the product page
    get productUrl(): string {
        return PLUGIN_URL;
    }

    // Unique identifier for the vendor
    get vendorId(): number {
        return VENDOR_ID;
    }

    // Human-readable name of the vendor for the node
    get vendorName(): string {
        return this.appliance.brand;
    }

    // Use any digits in the model number as the product identifier
    get productId(): number {
        const hex = this.appliance.model.replace(/[^0-9]/g, '');
        const parsed = parseInt(hex.substring(0, 4), 10);
        return isNaN(parsed) ? 0x0000 : parsed;
    }

    // Human-readable model name; attempt to map the PNC to its model number
    get productName(): string {
        const { model } = this.familyAndModel;
        return model ?? this.appliance.applianceType;
    }

    // User-defined name for the node (may be updated)
    get nodeLabel(): string {
        return this.appliance.applianceName;
    }

    // Version number of the hardware of the node
    get hardwareVersion(): string {
        return this.appliance.platform;
    }

    // Version number of the software running on the node
    get softwareVersion(): string {
        return this.appliance.state.firmwareVersion;
    }

    // Date that the node was manufactured; approximate using API appliance creation date
    get manufacturingDate(): string {
        const creationDate = new Date(this.appliance.created);
        return formatDateISO8601(creationDate, '');
    }

    // Human-readable part number
    get partNumber(): string {
        return this.appliance.pnc;
    }

    // Human-readable model name; attempt to map the PNC to its family and colour
    // (this is intended to be a more user-friendly version of productName)
    get productLabel(): string {
        let { family } = this.familyAndModel;
        const { model, variant } = this.appliance;
        family ??= `${model.toUpperCase()}/${variant}`;
        return `${family} ${this.appliance.colour}`;
    }

    // Human-readable serial number
    get serialNumber(): string {
        return this.appliance.serialNumber;
    }

    // Description of the product's appearance
    get productAppearance(): BasicInformation.ProductAppearance | undefined {
        // Map known colours to their Matter equivalents
        const primaryColor = COLOUR_MAP.get(this.appliance.colour);
        if (primaryColor === undefined) {
            warnUnrecognisedValue(this.log, 'colour', this.appliance.colour);
            return;
        }

        // Satin is the closest finish description supported by Matter
        const finish = BasicInformation.ProductFinish.Satin;
        return { finish, primaryColor };
    }

    // Does the appliance support 'smart' power levels (RX9.2 only)
    get smartPowerCapable(): boolean {
        return this.appliance.capabilities.includes('PowerLevels');
    }

    // Attempt to map the PNC to the model family and model number
    get familyAndModel(): { family?: string, model?: string } {
        const { pnc } = this.appliance;
        const familyModel = PNC_FAMILY_MODEL.get(pnc);
        if (!familyModel) warnUnrecognisedValue(this.log, 'PNC', pnc);
        return familyModel ?? {};
    }

    // List of supported areas (zones) for cleaning
    get supportedAreas(): ServiceArea.Area[] {
        return this.areas.supportedAreas;
    }

    // List of supported maps for cleaning
    get supportedMaps(): ServiceArea.Map[] {
        return this.areas.supportedMaps;

    }
}

// Warn about unrecognised values
const unrecognisedValues = new Map<string, Set<string>>();
function warnUnrecognisedValue(log: AnsiLogger, type: string, value: string): void {
    const warnedValues = unrecognisedValues.get(type) ?? new Set<string>();
    if (!warnedValues.has(value)) {
        log.warn(`Unrecognised ${type}: ${value}`);
        warnedValues.add(value);
        unrecognisedValues.set(type, warnedValues);
    }
}