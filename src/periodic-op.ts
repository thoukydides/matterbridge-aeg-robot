// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import { setTimeout } from 'node:timers/promises';
import { logError } from './log-error.js';

// Configuration of a periodic operation
export interface PeriodicOpConfig {
    name:           string;
    interval:       number;
    intervalRapid:  number;
    timeout:        number;
    onOp:           () => Promise<void>;
    onError?:       (err?: unknown) => void;
}

// Perform an operation periodically, with error handling
export class PeriodicOp {

    // The result of the last action
    lastError:              unknown;

    // Abort signal used to cancel timers
    abortInterval?:         AbortController;
    abortWatchdog?:         AbortController;

    // Is this periodic operation enabled
    private enabled = true;

    // Timing of the next operation
    private lastOpTime = 0;
    private rapidUntil = 0;

    // The periodic operation loop
    private runPeriodicPromise: Promise<void>;

    // Create a new poller
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    PeriodicOpConfig
    ) {
        this.runPeriodicPromise = this.runPeriodic();
    }

    // Stop polling
    async stop(): Promise<void> {
        // Cancel any timer and prevent rescheduling
        this.enabled = false;
        this.abortInterval?.abort();

        // Wait for the operation to terminate cleanly
        await this.runPeriodicPromise;
        this.stopWatchdogAndClearError();
    }

    // Temporarily poll more rapidly
    requestRapid(duration: number): void {
        // Extend the use of rapid polling
        this.rapidUntil = Math.max(this.rapidUntil, Date.now() + duration);

        // Cancel any current interval timer
        this.abortInterval?.abort();
        this.abortInterval = undefined;
    }

    // Time until the next operation
    get timeUntilNextOp(): number {
        const now = Date.now();
        const interval = this.config[now < this.rapidUntil ? 'intervalRapid' : 'interval'];
        return Math.max(0, this.lastOpTime + interval - now);
    }

    // Perform the action periodically indefinitely
    async runPeriodic(): Promise<void> {
        void this.restartWatchdog();
        while (this.enabled) {
            try {
                // Wait until it is time for the next operation
                this.abortInterval = new AbortController();
                const { signal } = this.abortInterval;
                await setTimeout(this.timeUntilNextOp, undefined, { signal });

                // Attempt the operation
                this.lastOpTime = Date.now();
                await this.config.onOp();

                // Clear any prior error and restart the watchdog
                void this.restartWatchdog();
            } catch (err) {
                if (err instanceof Error && err.name === 'AbortError') {
                    this.log.debug(`${this.config.name} early wake`);
                } else {
                    logError(this.log, this.config.name, err);
                    this.lastError = err;
                }
            }
        }
    }

    // Stop any active watchdog and clear any error condition
    stopWatchdogAndClearError(): void {
        // Abort any active watchdog timer
        this.abortWatchdog?.abort();
        this.abortWatchdog = undefined;

        // Clear any prior error (whether from the polled operation or watchdog)
        if (this.lastError) {
            this.lastError = undefined;
            this.config.onError?.();
        }
    }

    // Start or restart the watchdog
    async restartWatchdog(): Promise<void> {
        try {
            // Abort any existing watchdog
            this.stopWatchdogAndClearError();

            // Start a new watchdog
            this.abortWatchdog = new AbortController();
            const { signal } = this.abortWatchdog;
            await setTimeout(this.config.timeout, undefined, { signal });

            // The timeout has occurred, so report the failure
            this.lastError ??= new Error(`${this.config.name} watchdog timeout`);
            this.config.onError?.(this.lastError);
        } catch (err) {
            if (err instanceof Error && err.name === 'AbortError') return;
            logError(this.log, this.config.name, err);
        }
    }
}