// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import assert from 'node:assert';
import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';

// Command to use to launch Matterbridge
const MATTERBRIDGE = process.env.MATTERBRIDGE;
if (!MATTERBRIDGE) throw new Error('MATTERBRIDGE environment variable not set');
const [SPAWN_COMMAND, ...SPAWN_ARGS] = MATTERBRIDGE.split(' ');

// Match ANSI colour codes so that they can be stripped
// eslint-disable-next-line no-control-regex
const ANSI_ESCAPE = /\x1B\[[0-9;]*[msuK]/g;

// Log messages indicating success
const SUCCESS_OUTPUT_REGEX = [
    /\[Matterbridge AEG Robot\] All \d+ API tests passed/,
    /\[Matterbridge AEG Robot\] Registered \d+ robot vacuum device/
];

// Length of time to wait (seconds)
const TIMEOUT_SUCCESS = 15;

// Collect stdout and stderr, checking for success message(s)
let rawOutput = '', cleanOutput = '';
let testSuccessful = false;
async function parseOutputStream(child: ChildProcessWithoutNullStreams, streamName: 'stdout' | 'stderr'): Promise<void> {
    try {
        const stream = child[streamName];
        stream.setEncoding('utf8');
        for await (const chunk of stream) {
            assert(typeof chunk === 'string');

            // Accumulate the log output
            rawOutput   += chunk.toString();
            cleanOutput += chunk.toString().replace(ANSI_ESCAPE, '');

            // Check for all of the expected log messages
            if (!testSuccessful && SUCCESS_OUTPUT_REGEX.every(re => re.test(cleanOutput))) {
                testSuccessful = true;
                child.kill('SIGTERM');
            }
        }
    } catch (err) {
        // Stream should only terminate if the process is killed
        if (!testSuccessful) {
            throw new Error(`Unexpected ${streamName} termination: ${String(err)}`);
        }
    }
};

// Run the test
void (async (): Promise<void> => {
    // Attempt to launch Matterbridge
    const child = spawn(SPAWN_COMMAND, SPAWN_ARGS, {
        detached:   true,
        stdio:      'pipe',
        timeout:    TIMEOUT_SUCCESS * 1000
    });

    try {

        // Monitor stdout and stderr until they close
        await Promise.all([
            parseOutputStream(child, 'stdout'),
            parseOutputStream(child, 'stderr')
        ]);

        // Report an error if the expected log messages have not appeared
        // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
        if (testSuccessful) {
            console.log('Test successful');
        } else {
            throw new Error('Process terminated without success');
        }

    } catch (err) {

        // Test finished without seeing the expected log messages
        const errs = err instanceof AggregateError ? err.errors : [err];
        const messages = errs.map(e => e instanceof Error ? e.message : String(e));
        if (child.exitCode !== null) messages.unshift(`Matterbridge exited with code ${child.exitCode}`);
        console.error('Test failed:\n' + messages.map(m => `    ${m}\n`).join(''));
        console.log(rawOutput);
        process.exitCode = 1;

    } finally {

        if (!child.killed) {
            console.warn('Sending SIGKILL to Matterbridge');
            child.kill('SIGKILL');
        }

    }
})();