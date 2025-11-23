
// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import { AnsiLogger } from 'matterbridge/logger';
import {
    RX92PowerMode,
    RX9InteractiveMap,
    RX9InteractiveMapZone,
    RX9RoomCategory
} from './aegapi-rx9-types.js';
import { AreaNamespaceTag } from 'matterbridge/matter';
import { Config } from './config-types.js';
import { ServiceArea } from 'matterbridge/matter/clusters';
import { assertIsDefined, formatList } from './utils.js';
import { AEGApplianceRX9 } from './aeg-appliance-rx9.js';

// Mapping from Electrolux room categories to Matter common areas
const ROOM_CATEGORY_MAP: Record<RX9RoomCategory, number | null> = {
    [RX9RoomCategory.Kitchen]:      AreaNamespaceTag.Kitchen.tag,
    [RX9RoomCategory.DiningRoom]:   AreaNamespaceTag.Dining.tag,
    [RX9RoomCategory.Hall]:         AreaNamespaceTag.Hallway.tag,       // (or Corridor/Entrance/EntryWay)
    [RX9RoomCategory.LivingRoom]:   AreaNamespaceTag.LivingRoom.tag,
    [RX9RoomCategory.Bedroom]:      AreaNamespaceTag.Bedroom.tag,
    [RX9RoomCategory.TVRoom]:       AreaNamespaceTag.MediaTvRoom.tag,
    [RX9RoomCategory.Bathroom]:     AreaNamespaceTag.Bathroom.tag,
    [RX9RoomCategory.ChildrenRoom]: AreaNamespaceTag.Nursery.tag,       // (or Bedroom/PlayRoom)
    [RX9RoomCategory.Office]:       AreaNamespaceTag.Office.tag,
    [RX9RoomCategory.Storage]:      AreaNamespaceTag.Boxroom.tag,       // (or StorageRoom)
    [RX9RoomCategory.Other]:        null                                // No Matter equivalent
};

// A selected cleaning area
interface SelectedArea {
    map:    RX9InteractiveMap;
    zone:   RX9InteractiveMapZone;
}

// Translation between Electrolux interactive maps and Matter areas
export class BabelServiceAreaRX9 {

    // The currently selected areas
    private areas: SelectedArea[] = [];

    // Construct a new translator
    constructor(
        readonly log:       AnsiLogger,
        readonly config:    Config,
        readonly appliance: AEGApplianceRX9
    ) {}

    // List of supported maps for cleaning
    get supportedMaps(): ServiceArea.Map[] {
        // Use the map's index as its Matter identifier
        return this.appliance.maps.map(({ name }, mapIndex) => ({
            name:   name.substring(0, 64),
            mapId:  mapIndex
        }));
    }

    // List of supported areas (zones) for cleaning
    get supportedAreas(): ServiceArea.Area[] {
        return this.appliance.maps.flatMap(({ zones }, mapIndex) =>
            (zones ?? [])
                .filter(zone => zone.zoneType === 'clean') // Exclude 'avoid' zones
                .map(({ name, roomCategory }, zoneIndex) => ({
                    mapId:  mapIndex,
                    areaId: encodeAreaId(mapIndex, zoneIndex),
                    areaInfo: {
                        locationInfo: {
                            locationName:   name.substring(0, 128),
                            floorNumber:    null,
                            areaType:       ROOM_CATEGORY_MAP[roomCategory]
                        },
                        landmarkInfo: null
                    }
                }))
        );
    }

    // Set areas to be cleaned
    set selectedAreas(areas: number[]) {
        // Map the selected areas to the interactive maps
        this.areas = areas.map(areaId => {
            const { mapIndex, zoneIndex } = decodeAreaId(areaId);
            const map = this.appliance.maps[mapIndex];
            assertIsDefined(map);
            const zone = map.zones?.[zoneIndex];
            assertIsDefined(zone);
            return { map, zone };
        });

        // Generate the CustomPlay zone configuration
        const anyArea = this.areas[0];
        this.appliance.customPlay = anyArea && {
            persistentMapId: anyArea.map.id,
            zones: this.areas.map(({ zone }) => ({
                zoneId:    zone.id,
                // eslint-disable-next-line @typescript-eslint/prefer-nullish-coalescing
                powerMode: zone.powerMode || RX92PowerMode.Smart
            }))
        };
    }

    // Map a zone UUID to its area identifier
    areaIdForZoneId(zoneId: string): number | null {
        for (let mapIndex = 0; mapIndex < this.appliance.maps.length; mapIndex++) {
            const map = this.appliance.maps[mapIndex];
            assertIsDefined(map);
            const zoneIndex = (map.zones ?? []).findIndex(zone => zone.id === zoneId);
            if (zoneIndex !== -1) return encodeAreaId(mapIndex, zoneIndex);
        }
        return null;
    }

    // Describe the selected areas
    toString(): string {
        const anyArea = this.areas[0];
        if (!anyArea) return 'All zones';
        const mapName = anyArea.map.name;
        const zoneNames = this.areas.map(({ zone }) => zone.name);
        return `[${mapName}] ${formatList(zoneNames)}`;
    }
}

// Encode the map and area indices into a single (32-bit) identifier
function encodeAreaId(mapIndex: number, zoneIndex: number): number {
    return (mapIndex << 16) | zoneIndex;
}

// Decode the map and area indices from a single (32-bit) identifier
function decodeAreaId(areaId: number): { mapIndex: number, zoneIndex: number } {
    return {
        mapIndex:  areaId >>> 16,
        zoneIndex: areaId & 0xffff
    };
}