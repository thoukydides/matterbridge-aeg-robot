// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';
import { Config } from './config-types.js';
import { MS } from './utils.js';
import { AEGAPIRX9 } from './aegapi-rx9.js';

// Timeout waiting for changes, as a multiple of the status polling interval
const TIMEOUT_REQUEST_ACCEPTED = 10 * MS; // 10 seconds to issue request
const TIMEOUT_STATUS_CONFIRMED = 60 * MS; // 1 minute for the appliance to respond

// An abstract AEG RX 9 / Electrolux Pure i9 robot controller
export abstract class AEGApplianceRX9Ctrl<Type extends number | string> {

    readonly log:           AnsiLogger;
    readonly config:        Config;
    readonly api:           AEGAPIRX9;

    // The most recently requested target value
    private target?:        Type;

    // The current attempt to set a target value
    private setInProgress?: {
        target:             Type;
        abortController:    AbortController;
        promise:            Promise<void>;
    };

    // Override of status with prediction after successful request
    private pending?: {
        target:             Type;
        timeout:            number;
    };

    // Optional mapping of enum target values to text
    readonly toText?:       Record<Type, string>;

    // Create a new robot controller
    constructor(readonly appliance: AEGApplianceRX9, readonly name: string) {
        this.config = appliance.config;
        this.log    = appliance.log;
        this.api    = appliance.api;

        // Override the status while a requested change is pending
        appliance.on('preEmitPatch', () => { this.pendingCheckAndPatch(); });
    }

    // Return a set method bound to this instance
    makeSetter(): (target: Type) => Promise<boolean> {
        return (target) => this.set(target);
    }

    // Request a change to the robot, returning whether it is a valid request
    async set(target: Type): Promise<boolean> {
        // Set the new target value
        const description = this.description(target);
        this.target = target;

        // Ensure that there is only a single attempt in progress at a time
        const supersededError = new DOMException('Request superseded', 'AbortError');
        while (this.setInProgress) {
            // If the target value has changed then abandon this request
            if (this.target !== target) {
                this.log.debug(`Failing superseded request to ${description}`);
                throw supersededError;
            }

            // If already setting the target state then share its operation
            if (target === this.setInProgress.target) {
                this.log.debug(`Piggybacking duplicate request to ${description}`);
                await this.setInProgress.promise;
                return true;
            }

            // Abort the previous request that this replaces
            this.setInProgress.abortController.abort(supersededError);
            try { await this.setInProgress.promise; } catch { /* empty */ }
        }

        // No action required if in, or cannot transition to, the required state
        const isTargetSet = this.isTargetSet(target);
        if (isTargetSet === true) {
            this.log.info(`Ignoring redundant request to ${description}`);
            return true;
        } else if (isTargetSet === undefined) {
            this.log.info(`Rejecting invalid request to ${description}`);
            return false;
        }

        // Attempt to apply the requested change
        this.log.debug(`New request to ${description}`);
        const abort = new AbortController();
        const promise = this.trySet(target, abort.signal);
        this.setInProgress = { target, abortController: abort, promise };
        await this.setInProgress.promise;
        return true;
    }

    // Attempt to apply a single change
    async trySet(target: Type, signal: AbortSignal): Promise<void> {
        const description = this.description(target);
        this.log.info(`Attempting to ${description}`);
        try {
            // Apply the change
            const requestSignal = AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_REQUEST_ACCEPTED)]);
            await this.setTarget(target, requestSignal);
            this.log.info(`Request accepted ${description}`);

            // Start monitoring the status and override with prediction
            this.pending = { target, timeout: Date.now() + TIMEOUT_STATUS_CONFIRMED };
            this.appliance.updateDerivedAndEmit();
            this.appliance.poll?.requestRapid(TIMEOUT_STATUS_CONFIRMED);

        } catch (cause) {
            // Cancel any (previous) status override
            this.pending = undefined;

            // Identify the underlying error
            let err = cause instanceof Error ? cause : new Error(String(cause));
            while (err.name === 'AbortError' && err.cause instanceof Error) err = err.cause;

            // Map the error type to a description
            const errMap: Record<string, string> = {
                AbortError:     'Aborted',
                TimeoutError:   'Timed out'
            };
            const result = errMap[err.name] ?? 'Failed to';
            this.log.warn(`${result} ${description}`);
            throw err;
        } finally {
            // Log the result and clear the pending promise
            this.setInProgress = undefined;
        }
    }

    // Override the status while a requested change is pending
    pendingCheckAndPatch(): void {
        if (!this.pending) return;
        const { target, timeout } = this.pending;
        const description = this.description(target);

        // Check whether the target state has been reached
        if (this.isTargetSet(target)) {
            this.log.info(`Status confirmed ${description}`);
            this.pending = undefined;
        } else if (timeout < Date.now()) {
            this.log.warn(`Timed out waiting for status to confirm ${description}`);
            this.pending = undefined;
        } else {
            // Patch the status with the predicted value
            this.preEmitPatch(target);
        }
    }

    // Describe setting the target value
    description(target: Type): string {
        const value = this.toText ? this.toText[target] : `"${target}"`;
        return `set ${this.name} to ${value}`;
    }

    // Check whether the robot is (or can) transition to the requested state
    abstract isTargetSet(target: Type): boolean | undefined;

    // Attempt to set the requested state
    abstract setTarget(target: Type, signal?: AbortSignal): Promise<void>;

    // Override the status while a requested change is pending
    abstract preEmitPatch(target: Type): void;
}