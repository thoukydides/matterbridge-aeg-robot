// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    RX9ApplianceInfo,
    RX9ApplianceState,
    RX9CleaningCommand,
    RX9Command,
    RX9CommandCustomPlayZone,
    RX9InteractiveMaps
} from './aegapi-rx9-types.js';
import { Appliance, ApplianceId } from './aegapi-types.js';
import { AEGAuthoriseUserAgent } from './aegapi-ua-auth.js';
import { checkers } from './ti/aegapi-rx9-types.js';

// Access to the Electrolux Group API for an AEG RX9.1 or RX9.2 robot vacuum cleaner
export class AEGAPIRX9 {

    // Create a new RX9.1 or RX9.2 API
    constructor(
        readonly ua:          AEGAuthoriseUserAgent,
        readonly applianceId: ApplianceId
    ) {}

    // Get appliance info
    async getApplianceInfo(): Promise<RX9ApplianceInfo> {
        return this.ua.getJSON(checkers.RX9ApplianceInfo, `/api/v1/appliances/${this.applianceId}/info`);
    }

    // Get appliance state
    async getApplianceState(): Promise<RX9ApplianceState> {
        return this.ua.getJSON(checkers.RX9ApplianceState, `/api/v1/appliances/${this.applianceId}/state`);
    }

    // Get interactive maps
    async getInteractiveMaps(): Promise<RX9InteractiveMaps> {
        return this.ua.getJSON(checkers.RX9InteractiveMaps, `/api/v1/appliances/${this.applianceId}/interactiveMap`);
    }

    // Send command to appliance
    async sendCleaningCommand(CleaningCommand: RX9CleaningCommand, signal?: AbortSignal): Promise<void> {
        const body: RX9Command = { CleaningCommand };
        await this.ua.put(`/api/v1/appliances/${this.applianceId}/command`, body, { signal });
    }

    async sendCustomPlayCommand(persistentMapId: string, zones: RX9CommandCustomPlayZone[], signal?: AbortSignal): Promise<void> {
        const body: RX9Command = { CustomPlay: { persistentMapId, zones } };
        await this.ua.put(`/api/v1/appliances/${this.applianceId}/command`, body, { signal });
    }

    // Check whether an appliance is an AEG RX9.1 or RX9.2 robot vacuum cleaner
    static isRX9(appliance: Appliance): boolean {
        return appliance.applianceType === 'PUREi9';
    }
}