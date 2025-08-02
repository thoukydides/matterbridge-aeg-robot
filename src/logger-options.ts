// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { nf, YELLOW } from 'matterbridge/logger';
import { InspectOptions } from 'util';

// Log colours
export const RR = `\u001B[39;49m${nf}`; // Reset to normal text (light grey)
export const RT = '\u001B[38;5;67m';    // Raw description (dim blue)
export const RV = '\u001B[38;5;75m';    // Raw value (dim cyan)
export const AN = '\u001B[38;5;87m';    // Attribute or event names (bright cyan)
export const AV = YELLOW;               // Attribute or event values
export const CN = '\u001B[38;5;120m';   // Command cluster (bright green)
export const CV = YELLOW;               // Command name/value
export const CC = '\u001B[30;43m';      // RX9CleaningCommand (yellow background)

// Single-line inspection format
export const INSPECT_SINGLE_LINE: InspectOptions = {
    colors:             true,
    depth:              Infinity,
    maxArrayLength:     Infinity,
    maxStringLength:    100,
    breakLength:        Infinity,
    compact:            true,
    sorted:             true,
    numericSeparator:   false
};

// Verbose inspection format
export const INSPECT_VERBOSE: InspectOptions = {
    colors:             true,
    depth:              Infinity,
    maxArrayLength:     Infinity,
    maxStringLength:    Infinity,
    breakLength:        80,
    compact:            3,
    sorted:             true,
    numericSeparator:   true
};