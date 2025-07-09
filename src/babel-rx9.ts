// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { AnsiLogger } from 'matterbridge/logger';
import { Config } from './config-types.js';
import { BabelStaticRX9 } from './babel-static-rx9.js';
import { BABEL_DYNAMIC_RX9 } from './babel-dynamic-rx9.js';
import { isDeepStrictEqual } from 'util';
import { MaybePromise } from 'matterbridge/matter';
import { BabelServiceAreaRX9 } from './babel-areas-rx9.js';
import { logError } from './log-error.js';

// Derive types from the definition
type BabelDynamicRX9 = typeof BABEL_DYNAMIC_RX9;
type BabelEventRX9 = keyof BabelDynamicRX9;
type BabelStatusRX9 = {
    [K in BabelEventRX9]: ReturnType<BabelDynamicRX9[K]>
};

// Event handlers
export type BabelListenerRX9<Event extends BabelEventRX9> = (value: BabelStatusRX9[Event]) => MaybePromise;
export type BabelListenersRX9 = {
    [Event in BabelEventRX9]: BabelListenerRX9<Event>[];
};
// Workaround TypeScript limitations preserving key-value relationships for tuples
type StatusEmit<K extends BabelEventRX9> = (newValue: BabelStatusRX9[K]) => MaybePromise;

// Translation of appliance information to Matter attributes
export class BabelRX9 {

    // Static appliance information
    readonly static: BabelStaticRX9;

    // Service areas (iInteractive maps)
    readonly areas: BabelServiceAreaRX9;

    // Event listeners
    private readonly listeners: Partial<BabelListenersRX9> = {};

    // Emitted dynamic robot status
    private readonly emittedState = new Map<BabelEventRX9, unknown>();

    // Construct a new translator
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly appliance: AEGApplianceRX9
    ) {
        // Delegate manipulation of static data and service areas
        this.areas = new BabelServiceAreaRX9(this.log, this.config, this.appliance);
        this.static = new BabelStaticRX9(this.log, this.config, this.appliance, this.areas);

        // Translate and emit events for dynamic data whenever it changes
        this.appliance.on('changed', () => {
            for (const event of Object.keys(BABEL_DYNAMIC_RX9) as BabelEventRX9[]) {
                void this.emitIfChanged(event);
            }
        });
    }

    // Register a status event handler
    on<Event extends BabelEventRX9>(event: Event, listener: BabelListenerRX9<Event>): this {
        this.listeners[event] ??= [];
        this.listeners[event].push(listener);
        return this;
    }

    // Emit a status event if the value has changed
    async emitIfChanged(event: BabelEventRX9): Promise<void> {
        // Perform the translation to generate the new value
        const newValue = this.getState(event);
        if (newValue === undefined) return;

        // No action required if the value is unchanged
        if (isDeepStrictEqual(this.emittedState.get(event), newValue)) return;
        this.emittedState.set(event, newValue);

        // Log the new value
        this.log.debug(`Babel ${event}: ${JSON.stringify(newValue)}`);

        // Emit an event for this value
        for (const listener of (this.listeners[event] ?? [])) {
            try {
                await (listener as StatusEmit<typeof event>)(newValue);
            } catch (err) {
                logError(this.log, `Babel ${event} listener`, err);
            }
        }
    }

    // Translate a specific value
    getState<K extends BabelEventRX9>(event: K): BabelStatusRX9[K] | undefined {
        try {
            return BABEL_DYNAMIC_RX9[event](this.appliance.state) as BabelStatusRX9[K];
        } catch (err) {
            logError(this.log, `Babel ${event} translation`, err);
        }
    }
}