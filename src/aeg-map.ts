// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnyMapCoordinate, MapCoordinate } from './aeg-map-coordinate.js';
import { assertIsDefined } from './utils.js';
import {
    RX9CleaningSession,
    RX9CleaningSessionClosed,
    RX9InteractiveMap,
    RX9MapData,
    RX9ZoneStatus,
    RX9ZoneType
} from './aegapi-rx9-types.js';
import { MapText, MapTextColour, MapTextConfig } from './aeg-map-text.js';

// Robot diameter
const ROBOT_DIAMETER = 0.325; // metres

// Character aspect ratio (for Matterbridge frontend log viewer)
const ASPECT_RATIO  = 5/9;

// Optional supplementary map data
export interface MapDataExtra {
    session?:       RX9CleaningSession;
    sessionClosed?: RX9CleaningSessionClosed;
    interactive?:   RX9InteractiveMap;
}

// Item and zone types
type MapItem = 'crumbs' | 'charger' | 'robot';
type ZoneType = 'avoid' | 'ignore' | 'success' | 'incomplete';

// Styles of map rendering
type MapGlyphType = Exclude<MapItem, 'crumbs'> | 'avoid';
type MapColourType = MapItem | ZoneType;
export interface MapConfig extends MapTextConfig {
    glyph:          Record<MapGlyphType, string>;
    colour:         Record<MapColourType, MapTextColour>;
    useLabels:      boolean;
}

// Default configuration for monospaced display
export const MAP_CONFIG_MONOSPACED: MapConfig = {
    maxSize:        new MapCoordinate({ x: 80, y: 80 * ASPECT_RATIO }),
    aspectRatio:    ASPECT_RATIO,
    quadrant:       '!▘▝▀▖▌▞▛▗▚▐▜▄▙▟█',
    box:            '╭╮╰╯─│',
    glyph: {
        charger:    '◊',
        robot:      '▼',
        avoid:      '╳'
    },
    colour: {
        crumbs:     {                         fg: '\u001B[38;5;255m' }, // (white)
        charger:    {                         fg: '\u001B[38;5;51m' },  // (cyan)
        robot:      {                         fg: '\u001B[38;5;51m'  }, // (cyan)
        avoid:      { bg: '\u001B[48;5;52m',  fg: '\u001B[38;5;196m' }, // (red on dark red)
        ignore:     { bg: '\u001B[48;5;18m',  fg: '\u001B[38;5;246m' }, // (grey on dark blue)
        success:    { bg: '\u001B[48;5;22m',  fg: '\u001B[38;5;46m'  }, // (green on dark green)
        incomplete: { bg: '\u001B[48;5;94m',  fg: '\u001B[38;5;226m' }  // (yellow on dark orange)
    },
    fill: {
        glyph:      '░',
        colour:     { bg: '\u001B[48;5;17m',  fg: '\u001B[38;5;17m'  } // (dark blue)
    },
    eol:            '\u001B[0m',
    useLabels:      true
};

// Default configuration for Matterbridge frontend
// (subset of glyphs that are same width in Arial)
export const MAP_CONFIG_MATTERBRIDGE: MapConfig = {
    ...MAP_CONFIG_MONOSPACED,
    quadrant:       '!▀▀▀▄▌██▄█▐█▄███',
    box:            '╔╗╚╝═║',
    glyph: {
        charger:    '┼',
        robot:      '╬',
        avoid:      '▒'
    },
    useLabels:      false
};

// Pre-processed map data
interface MapZone {
    coords:     MapCoordinate[];
    name?:      string;
    type:       ZoneType;
}

// Rendering of cleaned-area maps
export function aegRobotMap(
    config:         MapConfig,
    mapData:        RX9MapData,
    mapDataExtra:   MapDataExtra
): string[] {
    // Pre-process the map data to consistent real-world coordinates
    const applyTransform = createTransform(mapData);
    const items = preprocessItems(applyTransform, mapData);
    const zones = preprocessZones(applyTransform, mapData, mapDataExtra);

    // Generate the textual representation of the map
    return renderMapAsText(config, items, zones);
}

// Create a transformer from raw coordinates to consistent coordinates
function createTransform(map: RX9MapData): (coord: AnyMapCoordinate) => MapCoordinate {
    const transforms = Object.fromEntries(map.transforms.map(t => [t.t, t]));

    // Return a function to normalise a map coordinate
    return (orig: AnyMapCoordinate): MapCoordinate => {
        let coord = new MapCoordinate(orig);

        if ('t' in orig && orig.t !== undefined) {
            // The coordinate specifies a transformation, so apply it
            const transform = transforms[orig.t];
            assertIsDefined(transform);
            coord = coord.transform(transform);
        }

        // Apply a final rotation to match the map orientation in the app
        return coord.rotate(-Math.PI / 2);
    };
}

// Pre-process cleaning crumbs, charger location(s), and final robot location
function preprocessItems(
    applyTransform: (coord: AnyMapCoordinate) => MapCoordinate,
    mapData:        RX9MapData
): Record<MapItem, MapCoordinate[]> {
    const items: Record<MapItem,  MapCoordinate[]> = { crumbs: [], charger: [], robot: [] };
    const addItems = (type: MapItem, coords: AnyMapCoordinate[]): void => {
        coords.forEach(coord => items[type].push(applyTransform(coord)));
    };

    addItems('crumbs',  mapData.crumbs ?? []);
    addItems('charger', mapData.chargerPoses);
    addItems('robot',   [mapData.robotPose]);
    return items;
}

// Pre-process the cleaning zones
function preprocessZones(
    applyTransform: (coord: AnyMapCoordinate) => MapCoordinate,
    mapData:        RX9MapData,
    mapDataExtra:   MapDataExtra
): MapZone[] {
    const { session, sessionClosed, interactive } = mapDataExtra;
    const zones = new Map<string, MapZone>();

    // Cleaned area map target zones
    const zoneDefs =
        mapData.mapMatch?.zones.map(zone => ({ id: zone.uuid, ...zone }))
        ?? sessionClosed?.zones ?? session?.zones;
    zoneDefs?.forEach(({ id, vertices, type }) => {
        const zone: MapZone = {
            coords: vertices.map(coord => applyTransform(coord)),
            type:   (type === RX9ZoneType.avoidZone || type === 'avoidZone') ? 'avoid' : 'incomplete'
        };
        zones.set(id, zone);
    });

    // Attempt to name the zones from the interactive map
    interactive?.zones.forEach(({ id, vertices, name, zoneType }) => {
        let zone = zones.get(id);
        if (!zone) {
            zone = {
                coords: vertices.map(coord => applyTransform(coord)),
                type:   zoneType === 'avoid' ? 'avoid' : 'ignore'
            };
            zones.set(id, zone);
        }
        zone.name = name;
    });

    // Finally set the cleaning status for each (non-avoid) zone
    const zoneStatus =
        mapData.zoneStatus?.map(status => ({ id: status.uuid, ...status }))
        ?? sessionClosed?.zoneStatus ?? session?.zoneStatus;
    zoneStatus?.forEach(({ id, status }) => {
        const zone = zones.get(id);
        if (zone) zone.type = (status === RX9ZoneStatus.finished || status === 'finished') ? 'success' : 'incomplete';
    });

    // Return just the list of zones (their UUIDs are no longer required)
    return [...zones.values()];
}

// Render the map as text
function renderMapAsText(
    config: MapConfig,
    items:  Record<MapItem,  MapCoordinate[]>,
    zones:  MapZone[]
): string[] {
    // Create a canvas of the appropriate size
    const all = [Object.values(items), Array.from(zones.values(), z => z.coords)].flat(2);
    const [srcMin, srcMax] = MapCoordinate.boundingBox(all);
    const margin = MapCoordinate.ONE.scale(ROBOT_DIAMETER / 2);
    const canvas = new MapText(config, srcMin.sub(margin), srcMax.add(margin));

    // Plot cleaning zones (all fills, then all borders)
    const cleanZones = zones.filter(({ type }) => type !== 'avoid');
    cleanZones.forEach(({ coords, type }) => {
        canvas.plotFilledPolygon(coords, undefined, config.colour[type]);
    });
    cleanZones.forEach(({ coords, type }) => {
        canvas.plotRectangle(coords, config.colour[type]);
    });

    // Plot avoid zones
    zones.forEach(({ coords, type }) => {
        if (type !== 'avoid') return;
        canvas.plotFilledPolygon(coords, config.glyph[type], config.colour[type]);
    });

    // Plot the cleaned area breadcrumbs
    items.crumbs.forEach(crumb => {
        canvas.plotCircle(crumb, ROBOT_DIAMETER, undefined, config.colour.crumbs);
    });

    // Label zones
    zones.forEach(({ name, coords, type }) => {
        if (!config.useLabels || !name) return;
        const coord = MapCoordinate.mean(MapCoordinate.boundingBox(coords));
        canvas.plotLabel(coord, name, config.colour[type]);
    });

    // Plot the robot and charger locations
    (['charger', 'robot'] as const).forEach(type => {
        items[type].forEach(coord => {
            canvas.plotLabel(coord, config.glyph[type], config.colour[type]);
        });
    });

    // Convert the canvas to row strings
    return canvas.render();
};