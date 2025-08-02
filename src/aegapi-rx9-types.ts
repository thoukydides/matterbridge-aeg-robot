// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    ApplianceId,
    ApplianceInfoDTO,
    ApplianceStatus,
    ConnectionState
} from './aegapi-types.js';

// Task schedule
export type WeekdayLC =
    'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday'
  | 'sunday';

// RX9.2 cleaning power mode (RX9.1 uses ecoMode instead)
export enum RX92PowerMode {
    Quiet                   = 1, // Lower energy consumption and quieter
    Smart                   = 2, // Cleans quietly on hard surfaces, uses full power on carpets
    Power                   = 3  // Optimal cleaning performance, higher energy consumption
}

// Battery charge level
export enum RX9BatteryStatus {
    Dead                    = 1,
    CriticalLow             = 2,
    Low                     = 3,
    Medium                  = 4,
    High                    = 5,
    FullyCharged            = 6
}

// Current activity
export enum RX9RobotStatus {
    Cleaning                = 1,
    PausedCleaning          = 2,
    SpotCleaning            = 3,
    PausedSpotCleaning      = 4,
    Return                  = 5,
    PausedReturn            = 6,
    ReturnForPitstop        = 7,
    PausedReturnForPitstop  = 8,
    Charging                = 9,
    Sleeping                = 10,
    Error                   = 11,
    Pitstop                 = 12,
    ManualSteering          = 13,
    FirmwareUpgrade         = 14
}

// Status of the dust collection bin
export enum RX9Dustbin {
    Unknown                 = 'notConnected',
    Present                 = 'connected',
    Missing                 = 'empty',
    Full                    = 'full'
}

// Interactive map zone room type
export enum RX9RoomCategory {
    Kitchen                 = 0,
    DiningRoom              = 1,
    Hall                    = 2,
    LivingRoom              = 3,
    Bedroom                 = 4,
    TVRoom                  = 5,
    Bathroom                = 6,
    ChildrenRoom            = 7,
    Office                  = 8,
    Storage                 = 9,
    Other                   = 10
}

// Interactive map zone behaviour
export type RX9ZoneType =
    'clean'
  | 'avoid';

// Functionality supported by the AEG RX9.1 and RX9.2
export type RX9Capabilities =
    'EcoMode'               // RX9.1 models (2 levels via ecoMode)
  | 'PowerLevels'           // RX9.2 models (3 levels via powerMode)
  | 'CustomPlay'
  | 'FreezeMapOnDemand'
  | 'InteractiveMap'
  | 'MultipleScheduledCleaningsPerDay'
  | 'PowerZones';

// CleaningCommand values supported by the AEG RX9.1 and RX9.2
export type RX9CleaningCommand =
    'play'
  | 'stop'
  | 'pause'
  | 'home';

// Cleaning result
export type RX9Completion =
    'abortedByUser'
  | 'cleaningFinishedSuccessful'
  | 'cleaningFinishedSuccessfulInCharger'
  | 'cleaningFinishedSuccessfulInStartPose'
  | 'endedNotFindingCharger'
  | 'error'
  | 'robotPowerDown';

// RX9.2 scheduled tasks (not supported by RX9.1)
export interface RX92Zone {
    powerMode:                      RX92PowerMode;
}
export interface RX92Task {
    enabled:                        boolean;
    start: {
        weekDays:                   WeekdayLC[];
        time:                       string;     // e.g. '09:00:13'
        properties: {
            zones:                  RX92Zone[];
        }
    }
}
export interface RX92Tasks {
    [index: string]:                RX92Task;
}

// GET /api/v1/appliances/{applianceId}/info
export interface RX9NoTriggers { [index: string]: never };
export interface RX9ApplianceCapabilities {
    cleaningCommand: {
        access:                     'readwrite';
        type:                       'string';
        values: {
            // { [key in RX9CleaningCommand]: object; }
            play:                   RX9NoTriggers;
            stop:                   RX9NoTriggers;
            pause:                  RX9NoTriggers;
            home:                   RX9NoTriggers;
        }
    };
    robotStatus: {
        access:                     'read';
        type:                       string;
        values: {
            // { [key in `${RX9RobotStatus}`]: RX9Empty; }
            1:                      RX9NoTriggers;  // Cleaning
            2:                      RX9NoTriggers;  // PausedCleaning
            3:                      RX9NoTriggers;  // SpotCleaning
            4:                      RX9NoTriggers;  // PausedSpotCleaning
            5:                      RX9NoTriggers;  // Return
            6:                      RX9NoTriggers;  // PausedReturn
            7:                      RX9NoTriggers;  // ReturnForPitstop
            8:                      RX9NoTriggers;  // PausedReturnForPitstop
            9:                      RX9NoTriggers;  // Charging
            10:                     RX9NoTriggers;  // Sleeping
            11:                     RX9NoTriggers;  // Error
            12:                     RX9NoTriggers;  // Pitstop
            13:                     RX9NoTriggers;  // ManualSteering
            14:                     RX9NoTriggers;  // FirmwareUpgrade
        }
    };
    dustbinStatus?: {
        access:                     'read';
        type:                       'string';
        values: {
            // { [key in Capitalize<RX9Dustbin>]: RX9Empty; }
            NOTCONNECTED:           RX9NoTriggers;
            CONNECTED:              RX9NoTriggers;
            EMPTY:                  RX9NoTriggers;
            FULL:                   RX9NoTriggers;
        }
    };
    batteryStatus?: {
        access:                     'read';
        type:                       'int';
        max:                        6;
        min:                        1;
    };
    powerMode?: {
        access:                     'read' | 'readwrite';
        type:                       'int';
        min:                        1;
        max:                        3;
    };
    'customPlay/persistentMapId'?: {
        access:                     'readwrite';
        type:                       'custom';
    };
    'customPlay/zones'?: {
        access:                     'readwrite';
        type:                       'custom';
    }
}
export interface RX9ApplianceInfo {
    applianceInfo:                  ApplianceInfoDTO;
    capabilities:                   RX9ApplianceCapabilities;
}

// GET /api/v1/appliances/{applianceId}/state
export interface RX9Gateway {
    connectionId:                   string;     // UUID
    location:                       string;     // e.g. 'west-europe'
    serverId:                       string;     // UUID
}
export interface RX9Message {
    id:                             number;     // e.g. 1
    internalErrorId?:               number;     // e.g. 10005
    text:                           string;     // e.g. 'Please help me get free'
    timestamp:                      number;     // e.g. 1672820985
    type:                           number;     // e.g. 0
    userErrorId?:                   number;     // e.g. 15
}
export interface RX9RobotPushMessage {
    time:                           string;     // e.g. '2023-12-20T14:10:43+00:00'
    type:                           string;     // e.g. 'RVCError' or 'ScheduleCleaningStarted'
    value:                          string;     // e.g. '10005' or 'Started'
    information: {
        id:                         string;     // UUID
        timestamp:                  string;     // e.g. '2023-12-20T14:10:43+00:00'
        serverInstanceId:           string;     // UUID
    }
    areaCovered:                    number | null;
}
export interface RX9CapabilitiesObject {
    [index: string]:                object;     // [key in RX9Capabilities]
}
export interface RX9CleaningSessionZone {
    id:                             string;     // UUID
    type:                           'cleanZone' | 'avoidZone';
    vertices:                       [RX9InteractiveMapVertex, RX9InteractiveMapVertex, RX9InteractiveMapVertex, RX9InteractiveMapVertex];
}
export interface RX9CleaningSessionZoneStatus {
    id:                             string;     // UUID
    status:                         'idle' | 'started' | 'finished' | 'terminated';
    powerMode:                      RX92PowerMode;
}
export interface RX9CleaningSession {
    action:                         'update';
    areaCovered:                    number;     // e.g. 27.900002
    cleaningDuration:               number;     // e.g. 29900000000
    completion?:                    RX9Completion;
    eventTime:                      string;     // e.g '2025-07-29T11:32:41'
    id:                             string;     // e.g. 'si_832',
    isTimeReliable:                 boolean;
    lastUpdate:                     string;     // e.g. '2025-07-29T10:34:31.0182278Z'
    messageType:                    'normal';
    persistentMapId?:               string;     // UUID
    persistentMapSN:                number;     // e.g. 183
    pitstopCount:                   number;     // e.g. 1
    pitstopDuration:                number;     // e.g. 21920000000
    robotInternalError?:            number;     // e.g. 10005
    robotUserError?:                number;     // e.g. 15
    sessionId:                      number;     // e.g. 832
    startTime:                      string;     // e.g. '2025-07-29T09:00:05'
    zones?:                         RX9CleaningSessionZone[];
    zoneStatus?:                    RX9CleaningSessionZoneStatus[];
}
export interface RX9CleaningSessionClosed {
    cleanedArea:                    number;     // e.g. 27.46
    cleanedAreaId:                  string;     // UUID
    cleaningDuration:               number;     // e.g. 39610000000
    completion:                     number;     // e.g. 2,
    created:                        string;     // e.g. '2025-07-19T08:00:59.74'
    endedReason:                    null;
    eventTime:                      string;     // e.g. '2025-07-20T09:00:04'
    firmwareVersion:                string;     // e.g. '43.23'
    id:                             number;     // e.g. 85596328
    isChargerPoseReliable:          boolean;
    isRobotPoseReliable:            boolean;
    isTimeReliable:                 boolean;
    lastUpdate:                     string;     // e.g. '2025-07-20T08:01:05.3757968Z'
    persistentMapId:                string;     // UUID
    persistentMapSn:                number;     // e.g. 181
    pitstopCount:                   number;     // e.g. 1
    pitstopDuration:                number;     // e.g. 22160000000
    platform:                       string;     // e.g. '1.01'
    robotInternalError:             null;
    robotUserError:                 null;
    sessionId:                      number;     // e.g. 822
    startReason:                    'Schedule';
    startTime:                      string;     // e.g. '2025-07-19T09:00:04'
    zones:                          [];
    zoneStatus:                     null;
}
export interface RX9MapPoint {
    t:                              number;     // e.g. 1000
    xy:                             [number, number]; // e.g. [-0.24129055, 0.31136945]
}
export interface RX9MapPointAngle {
    t?:                             number;     // e.g. 1000
    xya:                            [number, number, number]; // e.g. [0.05495656, -0.03892141, -0.029699445]
}
export interface RX9MapTransform {
    t:                              number;     // e.g. 1000
    xya:                            [number, number, number]; // e.g. [0.05495656, -0.03892141, -0.029699445]
}
export interface RX9MapZone {
    uuid:                           string;     // UUID
    type:                           number;     // e.g. 0
    vertices:                       [RX9MapPoint, RX9MapPoint, RX9MapPoint, RX9MapPoint];
}
export interface RX9MapMatch {
    sequenceNo:                     number;     // e.g. 183
    uuid:                           string;     // UUID
    zones:                          RX9MapZone[];
}
export interface RX9MapZoneStatus {
    powerMode:                      RX92PowerMode;
    status:                         number;     // e.g. 4
    uuid:                           string;     // UUID
}
export interface RX9MapData {
    chargerPoses:                   RX9MapPointAngle[];
    cleaningComplete:               number;     // e.g. 1
    crumbCollectionDelta:           boolean;
    crumbs?:                        RX9MapPoint[];
    mapMatch?:                      RX9MapMatch;
    robotPose:                      RX9MapPointAngle;
    robotPoseReliable:              boolean;
    sessionId:                      number;     // e.g. 832
    timestamp:                      string;     // e.g. '2025-07-29T11:32:40'
    transforms:                     RX9MapTransform[];
    zoneStatus?:                    RX9MapZoneStatus[];
}
export interface RX9ApplianceStateReportedBase {
    applianceName:                  string;     // e.g. 'AEG RX9.2 Robot'
    availableLanguages:             string[];   // e.g. ['deu', 'eng', ...]
    batteryStatus:                  RX9BatteryStatus;
    capabilities:                   RX9CapabilitiesObject;
    cleaningSession?:               RX9CleaningSession;
    cleaningSessionClosed?:         RX9CleaningSessionClosed;
    deviceId?:                      string;     // e.g. '900277479937001234567890'
    dustbinStatus:                  RX9Dustbin;
    firmwareVersion:                string;     // e.g. '43.23'
    gw?:                            RX9Gateway;
    language:                       string;     // e.g. 'eng'
    mapData?:                       RX9MapData;
    messageList: {
        messages:                   RX9Message[];
    }
    mute:                           boolean;
    nextFirmwareUpgradeAttempt?:    string;     // e.g. '2023-12-20T14:10:43+00:00'
    persistentMapsCreated?: {
        mapId:                      string;     // UUID
    }
    platform:                       string;     // e.g. '1.01'
    robotPushMessage?:              RX9RobotPushMessage;
    robotStatus:                    RX9RobotStatus;
}
export interface RX91ApplianceStateReported extends RX9ApplianceStateReportedBase {
    ecoMode:                        boolean;
}
export interface RX92ApplianceStateReported extends RX9ApplianceStateReportedBase {
    powerMode:                      RX92PowerMode;
    tasks?:                         RX92Tasks;
}
export type RX9ApplianceStateReported =
    RX91ApplianceStateReported | RX92ApplianceStateReported;
export interface RX9ApplianceStateProperties {
    reported:                       RX9ApplianceStateReported;
}
export interface RX9ApplianceState {
    applianceId:                    ApplianceId;
    connectionState:                ConnectionState;
    status:                         ApplianceStatus;
    properties:                     RX9ApplianceStateProperties;
}

// GET /api/v1/appliances/{applianceId}/interactiveMap
export interface RX9InteractiveMapVertex {
    x:                              number;
    y:                              number;
}
export interface RX9InteractiveMapZone {
    name:                           string;     // e.g. 'Living Room'
    id:                             string;     // UUID
    zoneType:                       'clean' | 'avoid';
    vertices:                       [RX9InteractiveMapVertex, RX9InteractiveMapVertex, RX9InteractiveMapVertex, RX9InteractiveMapVertex];
    roomCategory:                   RX9RoomCategory;
    powerMode:                      RX92PowerMode | null;
}
export interface RX9InteractiveMap {
    name:                           string;     // e.g. 'Home'
    id:                             string;     // UUID
    timestamp:                      string;     // e.g. '2023-12-20T14:10:43+00:00'
    rotation:                       number;     // e.g. 0
    zones:                          RX9InteractiveMapZone[];
}
export type RX9InteractiveMaps = RX9InteractiveMap[];

// PUT /api/v1/appliances/{applianceId}/command
export interface RX9CommandCleaning {
    CleaningCommand:                RX9CleaningCommand;
}
export interface RX9CommandCustomPlayZone {
    zoneId:                         string;     // UUID
    powerMode:                      RX92PowerMode;
}
export interface RX9CustomPlayMapZones {
    persistentMapId:                string;     // UUID
    zones:                          RX9CommandCustomPlayZone[];
}
export interface RX9CommandCustomPlay {
    CustomPlay:                     RX9CustomPlayMapZones;
}
export type RX9Command = RX9CommandCleaning | RX9CommandCustomPlay;