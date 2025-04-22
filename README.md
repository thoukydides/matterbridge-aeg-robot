<p align="center">
  <img src="https://raw.githubusercontent.com/wiki/thoukydides/matterbridge-aeg-robot/matterbridge-aeg-robot.png" height="200">
</p>
<div align=center>

# matterbridge-aeg-robot

[![npm](https://badgen.net/npm/v/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![npm](https://badgen.net/npm/dt/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![npm](https://badgen.net/npm/dw/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![Build and Lint](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/build.yml/badge.svg)](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/build.yml)

AEG RX 9 / Electrolux Pure i9 robot vacuum plugin for [Matterbridge](https://github.com/Luligu/matterbridge).

</div>

AEG, Electrolux, and Zanussi are trademarks of [AB Electrolux](https://www.electroluxgroup.com/).

## Installation

**Important:** This plugin requires Matterbridge version 3.0 (or later), or a recent build from the Matterbridge `edge` branch. At the time of writing, the current stable release is 2.2.8, so please ensure you are using the appropriate version for full compatibility.

### Step 1 - Create Account and Setup Robot Vacuum
1. Use the AEG [iPhone](https://apps.apple.com/gb/app/aeg/id1599494494) or [Android](https://play.google.com/store/apps/details?id=com.electrolux.oneapp.android.aeg) app to create an account. *(It may be necessary to logout and login again to complete account creation.)*
1. Add the RX series robot vacuum to your AEG/Electrolux/Zanussi account.

### Step 2 - Obtain Electrolux Web API Credentials
1. Login to the [Electrolux Group Developer Portal](https://developer.electrolux.one/login) using the same account as used for the AEG mobile app.
1. On the [Dashboard](https://developer.electrolux.one/dashboard) page enter an *Api Key Name* and click *CREATE NEW API KEY*. Copy the *Api key*.
1. Click on *GENERATE TOKEN*. Copy the *Access Token* and *Refresh Token* values.

### Step 3 - Matterbridge Plugin Installation

#### Recommended Approach using Matterbridge Frontend

1. Open the Matterbridge web interface, e.g. at http://localhost:8283/.
1. Under *Install plugins* type `matterbridge-aeg-robot` in the *Plugin name or plugin path* search box, and click *Install ⬇️*.
1. Click *🔄 Restart Matterbridge*.
1. Open the **matterbridge-aeg-robot** *⚙️ Plugin config* and set the *API Key*, *Access Token*, and *Refresh Token* to the values obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard).
1. Click *CONFIRM* to save the plugin configuration and restart Matterbridge again.

<details>
<summary>Alternative method using command line (and advanced configuration)</summary>

#### Installation using Command Line

1. Stop Matterbridge:  
   `systemctl stop matterbridge`
1. Install the plugin:  
   `npm install -g matterbridge-aeg-robot`
1. Register it with Matterbridge:  
   `matterbridge -add matterbridge-aeg-robot`
1. Restart Matterbridge:  
   `systemctl start matterbridge`

#### Example `matterbridge-aeg-robot.config.json`
```JSON
{
    "apiKey":                 "<API Key>",
    "accessToken":            "<Authorization Access Token>",
    "refreshToken":           "<Authorization Refresh Token>"
}
```

The `apiKey`, `accessToken`, and `refreshToken` should be obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard). All supported robot vacuums associated with the account (those reporting a model name of `PUREi9`) will be added to Matterbridge. Unsupported appliances, such as air purifiers or RX8 robot vacuums, will be ignored.

#### Advanced Configuration

You can include additional settings in `config.json` to customise the behaviour or enable special debug features:
```JSON
{
    "name":                   "matterbridge-aeg-robot",
    "type":                   "DynamicPlatform",
    "version":                "1.0.0",
    "whiteList":              ["WALL·E"],
    "blackList":              [],
    "apiKey":                 "<API Key>",
    "accessToken":            "<Authorization Access Token>",
    "refreshToken":           "<Authorization Refresh Token>",
    "pollIntervalsSeconds":   30,
    "debug":                  false,
    "debugFeatures":          ["Run API Tests", "Run Unsafe API Tests", "Log Endpoint Debug", "Log API Headers", "Log API Bodies", "Log Appliance IDs"],
    "unregisterOnShutdown":   false
}
```

The `name`, `type`, and `version`, are all set by Matterbridge to match the plugin.

`blackList` and `whiteList` control which robot vacuums are exposed as Matter devices. If `blacklist` is not empty, then any appliance names listed will be excluded. If `whitelist` is not empty, then only appliance names on that list (and not on the `blacklist`) will be included.

The `pollIntervalSeconds` specifies the time in seconds between successive polls of the Electrolux Group API. The API has a strict [rate limit](https://developer.electrolux.one/documentation/quotasAndRateLimits) of 5000 calls/day. The default value is 30 seconds, which results in 2880 calls/day for polling the state of a single appliance. If you have multiple robot vacuum cleaners in your account, or use the same API Key for other purposes, then scale the value appropriately: 60 seconds for two, 90 seconds for three, etc. More rapid polling is performed for a short period after a command has been sent to the robot vacuum; this is not configurable.

Setting the `debug` option sets the logger level for this plugin to *Debug*, overriding the global Matterbridge logger level setting.

The `Log Appliance IDs` option prevents redaction of appliance Product ID and Serial Number values in the log. Avoid setting `debug` or any other `debugFeatures` unless you are investigating a compatibility issue, API error, or other problem.

</details>

## Functionality

This plugin supports starting, pausing, stopping cleaning, and returning the vacuum to its charging dock. It also reports whether the vacuum is actively cleaning, the current power level, docked status, battery level, and any active errors.

Unfortunately, the Electrolux Group API only allows basic control of robot vacuums: **Play**, **Stop**, **Pause**, and **Home**. It does not support any other control (such as selection of power modes, spot cleaning, or zones), so these cannot be controlled via this plugin.

<details>
<summary>Matter Clusters</summary>

This plugin exposes each robot vacuum as a Matter 1.4 device, supporting the following clusters:

### Bridged Device Basic Information Cluster

The **Bridged Device Basic Information** cluster provides information about the appliance:
* **HardwareVersion** / **HardwareVersionString**: The robot vacuum's hardware platform version.
* **ManufacturingDate**: The date that the robot vacuum cleaner was installed.
* **NodeLabel**: The name set by the user for the robot vacuum.
* **PartNumber**: The robot vacuum's PNC.
* **ProductAppearance**: The (approximate) colour and finish of the robot vacuum cleaner.
* **ProductLabel**: The robot vacuum's model family (if it can be identified from its PNC) and colour.
* **ProductName**: The robot vacuum's model name (if it can be identified from its PNC).
* **ProductURL**: URL for this plugin's homepage.
* **Reachable**: Indicates whether it is possible to communicate with the robot vacuum (plugin connected to the Electrolux Group API, robot vacuum connected to cloud servers, and robot vacuum enabled).
* **SerialNumber**: The robot vacuum's serial number.
* **SoftwareVersion** / **SoftwareVersionString**: The robot vacuum's firmware version.
* **UniqueId**: Opaque identifier used by Matter to identify the device (derived from a SHA-256 hash of the API `applianceId`).
* **VendorName**: The robot vacuum's manufacturer.

It also generates an event:
* **ReachableChanged**: Triggered when the **Reachable** attribute changes.

### Power Source Cluster

The **Power Source** cluster provides information about the battery and charging status:
* **Status**: Indicates whether the battery is currently being used.
* **BatChargeRemaining**: Indicates a coarse ranking of the battery charge level.
* **BatChargeLevel**: The battery charge level as a percentage.
* **BatChargeState**: The charging status:
    * *IsCharging* = Actively charging the battery.
    * *IsNotCharging* = Not currently charging. The battery is not fully charged.
    * *IsAtFullCharge* = The battery is fully charged.

The following mapping from values reported by the Electrolux Group API is used:

| Reported Battery Level | Status        | BatChargeRemaining | BatChargeLevel |
| ---------------------- | :-----------: | -----------------: | :------------: |
| `Dead`                 | *Unavailable* |               *0%* | *Critical*     |
| `Critical Low`         | *Active*      |              *20%* | *Critical*     |
| `Low`                  | *Active*      |              *40%* | *Warning*      |
| `Medium`               | *Active*      |              *60%* | *OK*           |
| `High`                 | *Active*      |              *80%* | *OK*           |
| `Fully Charged`        | *Active*      |             *100%* | *OK*           |

### RVC Run Mode Cluster

The **RVC Run Mode** cluster indicates whether the robot vacuum is cleaning:
* **CurrentMode**: 
    *Idle* = Indicates that the robot is not performing a cleaning operation.
    *Cleaning* = Indicates that the robot is actively cleaning (including paused, charging, or returning to the dock for charging, during a cleaning operation).

It supports a single command:
* **ChangeToMode**: Set **CurrentMode**:
    **Idle**: Attempt to stop a cleaning operation (but do not return to the dock).
    **Cleaning**: Attempt to start a new cleaning operation.

### RVC Clean Mode Cluster

The **RVC Clean Mode Cluster** indicates the type of clean being performed:

| RX9.1          | RX9.2   | Full Clean | Full Clean ModeTags                               | Spot Clean  | Spot Clean ModeTags | Description                                                 |
| -------------- | ------- | :--------: | ------------------------------------------------- | :---------: | ------------------- | ----------------------------------------------------------- |
| `ECO mode`     | `Quiet` | *Quiet*    | *Vacuum*, *Quiet*, *LowNoise*, *LowEnergy*, *Min* | *QuietSpot* | +*Quick*            | Lower energy consumption and quieter                        |
| n/a            | `Smart` | *Smart*    | *Vacuum*, *Auto*                                  | *SmartSpot* | +*Quick*            | Cleans quietly on hard surfaces, uses full power on carpets |
| `Not ECO mode` | `Power` | *Power*    | *Vacuum*, *Max*, *DeepClean*                      | *PowerSpot* | +*Quick*            | Optimal cleaning performance, higher energy consumption     |

Although the **ChangeToMode** command is defined, it will always return an error since the Electrolux API does not support selecting power modes or triggering spot cleans.

### RVC Operational State Cluster

The **RVC Operational State Cluster** indicates the detailed robot vacuum status:
* **OperationalState**: Indicates the current state of the robot vacuum:

| Reported Status                                                                              | OperationalState                 |
| -------------------------------------------------------------------------------------------- | -------------------------------- |
| `Charging` <br> `Pitstop`                                                                    | *Charging*                       |
| `Cleaning` <br> `SpotCleaning`                                                               | *Running*                        |
| `Error`                                                                                      | *Error*                          |
| `FirmwareUpgrade`                                                                            | *FirmwareUpgrade* (non-standard) |
| `ManualSteering`                                                                             | *ManualSteering* (non-standard)  |
| `PausedCleaning` <br> `PausedSpotCleaning` <br> `PausedReturn` <br> `PausedReturnForPitstop` | *Paused*                         |
| `Return` <br> `ReturnForPitstop`                                                             | *SeekingCharger*                 |
| `Sleeping` (off dock)                                                                        | *Stopped*                        |
| `Sleeping` (on dock)                                                                         | *Docked*                         |

* **OperationalError**: Indicates details of a non-transient problem with the robot vacuum when **OperationalState** is *Error*.

It supports three commands:
* **Pause**: Attempt to pause a cleaning operation (including returning to the charging dock).
* **Resume**: Attempt to resume cleaning, if currently paused.
* **GoHome**: Attempt to stop any cleaning operation in progress and initiate a return to the charging dock.

It also generates two events:
* **OperationCompletion**: Triggered when **RVC Run Mode** transitions from *Cleaning* to *Idle* indicating the end of a cleaning operation.
* **OperationalError**: Triggered when a new **OperationalError** occurs.

</details>

## Compatibility

This plugin has only been tested with a single AEG RX9.2 robot vacuum (model `RX9-2-4ANM`, PNC `900 277 479`, running firmware `43.23`). It should work with other AEG RX9/RX9.1/RX9.2 or Electrolux Pure i9/i9.1/i9.2 models.

Matter controllers vary in their support for Matter 1.4 RVCs. This plugin is only tested with Apple HomeKit and the Apple Home app.

### Apple HomeKit Limitations

The Apple Home app expects each robot vacuum to be a standalone, individually-paired Matter node implementing a single endpoint. However, Matterbridge acts as a Matter bridge - either a single bridge node for all plugins (*bridge* mode), or a separate bridge node per plugin (*childbridge* mode) - with each plugin’s device exposed as an additional child endpoint. This causes a few issues when using this plugin with the Home app:
* **One robot vacuum per Matterbridge instance:** A separate Matterbridge instance is required for each robot vacuum. Each must use unique port numbers (both `-port <port>` and `-frontend <port>`) and their own home directory (`-homedir <path>`). This plugin should be the only one enabled in each instance. If your account contains multiple robot vacuums, use the `whitelist` setting to select one per instance.
* **Device-specific information is ignored:** The Home app shows the bridge device information from Matterbridge’s own root **Device Basic Information** cluster, ignoring the plugin’s **Bridged Device Basic Information** cluster. As a result, the Home app displays the bridge’s name, manufacturer, model, serial number, and firmware version; *not* those of the robot vacuum.

Other quirks in the Home app:
* **Delayed docking:** The *Send to Dock* button first sets **RVC Run Mode** to *Idle* (which maps to `stop` in the Electrolux Group API), followed by a **GoHome** command (`home`). The Electrolux Group API silently ignores commands sent too quickly in succession, so this plugin inserts a 5-second delay between them. This causes the robot vacuum to pause briefly before returning to the dock.
* **Incorrect clean mode display:** The Home app displays ModeTag values (e.g. *Deep Clean*, *Quick*) rather than the advertised modes (*Smart*, *PowerSpot*, etc) reported by the vacuum. Worse, it only shows these when not cleaning, even though the Electrolux Group API only provides meaningful values during cleaning.

## Changelog

All notable changes to this project are documented in the [CHANGELOG.md](CHANGELOG.md) file.

## Reporting Issues
          
If you have discovered an issue or have an idea for how to improve this project, please [open a new issue](https://github.com/thoukydides/matterbridge-aeg-robot/issues/new/choose) using the appropriate issue template.

### Pull Requests

This project does **NOT** accept pull requests. Any PRs submitted will be closed without discussion. For more details refer to the [`CONTRIBUTING.md`](https://github.com/thoukydides/.github/blob/master/CONTRIBUTING.md) file.

## ISC License (ISC)

<details>
<summary>Copyright © 2025 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>