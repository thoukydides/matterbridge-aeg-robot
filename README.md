<p align="center">
  <img src="https://raw.githubusercontent.com/wiki/thoukydides/matterbridge-aeg-robot/matterbridge-aeg-robot.svg" height="200">
</p>
<div align=center>

# matterbridge-aeg-robot

[![npm](https://badgen.net/npm/v/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![npm](https://badgen.net/npm/dt/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![npm](https://badgen.net/npm/dw/matterbridge-aeg-robot)](https://www.npmjs.com/package/matterbridge-aeg-robot)
[![Build and Lint](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/build.yml/badge.svg)](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/build.yml)
[![Test](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/test.yml/badge.svg)](https://github.com/thoukydides/matterbridge-aeg-robot/actions/workflows/test.yml)

A [Matterbridge](https://github.com/Luligu/matterbridge) plugin that connects [AEG RX 9](https://www.aeg.co.uk/wellbeing/discover/rx9) / [Electrolux Pure i9](https://www.electroluxgroup.com/en/electrolux-launches-pure-i9-robotic-vacuum-in-the-united-states-24513/) robot vacuums  
to the [Matter](https://csa-iot.org/all-solutions/matter/) smart home ecosystem.

</div>

## Installation

### Step 1 - Create Account and Setup Robot Vacuum
1. Use the AEG [iPhone](https://apps.apple.com/gb/app/aeg/id1599494494) or [Android](https://play.google.com/store/apps/details?id=com.electrolux.oneapp.android.aeg) app to create an account. *(It may be necessary to logout and login again to complete account creation.)*
1. Add the RX series robot vacuum to your AEG/Electrolux/Zanussi account.

### Step 2 - Obtain Electrolux Web API Credentials
1. Login to the [Electrolux Group Developer Portal](https://developer.electrolux.one/login) using the same account as used for the AEG mobile app.
1. On the [Dashboard](https://developer.electrolux.one/dashboard) page enter an *Api Key Name* and click *CREATE NEW API KEY*. Copy the *Api key*.
1. Click on *GENERATE TOKEN*. Copy the *Access Token* and *Refresh Token* values.

### Step 3 - Matterbridge Plugin Installation

1. Open the Matterbridge web interface, e.g. at http://localhost:8283/.
1. Under *Install plugins* type `matterbridge-aeg-robot` in the *Plugin name or plugin path* search box, then click *Install ⬇️*.
1. Click *🔄 Restart Matterbridge* to apply the change.
1. Open the **matterbridge-aeg-robot** *⚙️ Plugin config*.
1. Set the *API Key*, *Access Token*, and *Refresh Token* to the values obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard).
1. Click <kbd>CONFIRM</kbd> to save the configuration and restart Matterbridge again.

| ⚠️ Apple HomeKit + Robot Vacuums  |
| --- |
| *The Apple Home app only supports robot vacuums when they are standalone individually-paired Matter nodes. Attempting to pair a Matterbridge instance with multiple robot vacuums, or a robot vacuum plus other device types, can cause the Home app to crash or fail to properly recognise some of the devices. If you are using HomeKit with a robot vacuum then configure a separate Matterbridge instance for each robot vacuum.* |

<details>
<summary>Separate Matterbridge Instance per Robot Vacuum</summary>

### Separate Matterbridge Instances

Each additional Matterbridge instance should specify the following command line options:

| Command Line Options    | Default                     | Description
| ----------------------- | --------------------------- | ---
| `-homedir <directory>`  | `$HOME` or `USERPROFILE`    | Matterbridge defaults to creating `Matterbridge`, `.matterbridge`, and `.mattercert` directories within the user's home directory. A different "home" directory is required by each Matterbridge instance.
| `-port <number>`        | `5540`                      | The port number for the Matterbridge commissioning server. This should be unique for each instance to allow pairing with a Matter controller.
| `-frontend <number>`    | `8283`                      | The port number for the Matterbridge frontend. This should be unique for each instance to allow use of the web interface.
| `-vendorName "<name>"`  | `"Matterbridge"`            | Apple Home uses the vendor name of the Matter bridge for robot vacuums; use this option to override Matterbridge's default with `AEG`.
| `-productName "<name>"` | `"Matterbridge aggregator"` | Apple Home uses the product name of the Matter bridge for robot vacuums; use this option to override Matterbridge's default with model name of your robot vacuum.

If you have multiple AEG/Electrolux robot vacuums then select one for each instance using the `whiteList` plugin configuration option.

#### Example `systemd` Configuration

The following example assumes that:
* `systemd` is being used to launch Matterbridge (instead of via Docker or other means).
* Matterbridge is run as user `matterbridge` and group `matterbridge`.
* Matterbridge configuration files for this instance are being kept under `/var/lib/matterbridge-aeg-robot`.
* The commissioning server will be on port `5541` and the web frontend on port `8284`.
* This instance is for an AEG RX9.2 robot vacuum.

Modify as appropriate to suit your setup.

1. Create a directory for this instance's configuration files:
   ```shell
   sudo mkdir /var/lib/matterbridge-aeg-robot
   sudo chown matterbridge:matterbridge /var/lib/matterbridge-aeg-robot
   ```
1. Create a `/etc/systemd/system/matterbridge-aeg-robot.service` file containing:
   ```ini
   [Unit]
   Description=Matterbridge AEG Robot
   After=network-online.target
   
   [Service]
   Type=simple
   ExecStart=/usr/local/bin/matterbridge -service -nosudo -novirtual -homedir /var/lib/matterbridge-aeg-robot -port 5541 -frontend 8284 -vendorName 'AEG' -productName 'RX9.2'
   WorkingDirectory=/var/lib/matterbridge-aeg-robot
   StandardOutput=inherit
   StandardError=inherit
   Restart=always
   RestartSec=10s
   TimeoutStopSec=30s
   User=matterbridge
   Group=matterbridge
   
   [Install]
   WantedBy=multi-user.target
   ```
1. Reload the `systemd` service files and enable the new unit:
   ```shell
   sudo systemctl daemon-reload
   sudo systemctl enable --now matterbridge-aeg-robot.service
   ```
</details>
<details>
<summary>Command Line Installation</summary>

### Installation using Command Line
1. Stop Matterbridge:  
   `sudo systemctl stop matterbridge`
1. Install the plugin:  
   `npm install -g matterbridge-aeg-robot`
1. Register it with Matterbridge:  
   `sudo -u matterbridge matterbridge -add matterbridge-aeg-robot`
1. Restart Matterbridge:  
   `sudo systemctl start matterbridge`

#### Example `matterbridge-aeg-robot.config.json`
```JSON
{
    "name":                     "matterbridge-aeg-robot",
    "type":                     "DynamicPlatform",
    "version":                  "1.0.0",
    "apiKey":                   "<API Key>",
    "accessToken":              "<Authorization Access Token>",
    "refreshToken":             "<Authorization Refresh Token>",
    "pollIntervalSeconds":      30,
    "blackList":                [],
    "whiteList":                [],
    "debug":                    false,
    "debugFeatures":            [],
    "unregisterOnShutdown":     false
}
```

</details>
<details>
<summary>Advanced Configuration Options</summary>

### Advanced Configuration

You can include additional settings in `matterbridge-aeg-robot.config.json` to customise the behaviour or enable special debug features:

| Key                     | Default            | Description
| ----------------------- | ------------------ | ---
| `name`<br>`type`<br>`version` | n/a          | These are managed by Matterbridge and do not need to be set manually.
| `apiKey`                | (no default)       | *API Key* obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard).
| `accessToken`           | (no default)       | *Access Token* obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard).
| `refreshToken`          | (no default)       | *Refresh Token* obtained from the [Electrolux Group Developer Portal Dashboard](https://developer.electrolux.one/dashboard).
| `pollIntervalSeconds`   | `30`               | The time in seconds between successive polls of the Electrolux Group API for each robot vacuum.
| `blackList`             | `[]`               | If the list is not empty, then any robot vacuums with matching serial numbers will not be exposed as Matter devices.
| `whiteList`             | `[]`               | If the list is not empty, then only robot vacuums with matching serial numbers (and not on the `blacklist`) will be exposed as Matter devices.
| `debug`                 | `false`            | Sets the logger level for this plugin to *Debug*, overriding the global Matterbridge logger level setting.
| `debugFeatures`         | `[]`               | Miscellaneous options to control the information logged. None of these should be set unless you are investigating a compatibility issue or other problem.
| `unregisterOnShutdown`  | `false`            | Unregister all exposed devices on shutdown. This is used during development and testing; do not set it for normal use.

All supported robot vacuums associated with the account (those reporting a model name of `PUREi9`) will be added to Matterbridge. Unsupported appliances, such as air purifiers or RX8 robot vacuums, will be ignored. Exclude or include specific robot vacuums by listing their serial numbers in either the `blackList` or `whiteList`.

The API has a strict [rate limit](https://developer.electrolux.one/documentation/quotasAndRateLimits) of 5000 calls/day. The default value is 30 seconds, which results in 2880 calls/day for polling the state of a single appliance. If you have multiple robot vacuum cleaners in your account, or use the same API Key for other purposes, then scale the value appropriately: 60 seconds for two, 90 seconds for three, etc. More rapid polling is performed for a short period after a command has been sent to the robot vacuum; this is not configurable.

The supported `debugFeatures` are:

| Debug Feature          | Description
| ---------------------- | ---
| `Run API Tests`        | Performs a test of each idempotent Electrolux Group API endpoint (those just reading appliance information and status) once during plugin start-up. This is useful for detecting changes to the API implementation that may affect operation of this plugin.
| `Run Unsafe API Tests` | If `Run API Tests` is set then this additionally tests non-idempotent API endpoints (a `home` command is issued).
| `Log Endpoint Debug`   | Sets the `debug` flag to the Matterbridge/Matter.js endpoint implementation.
| `Log API Headers`      | Logs HTTP headers for each Electrolux Group API request. Rarely useful. (Requires *Debug* level logging.)
| `Log API Bodies`       | Logs message bodies for each Electrolux Group API request. Useful for diagnosing interoperability issues. (Requires *Debug* level logging.)
| `Log Appliance IDs`    | Product identifier and serial numbers are automatically redacted in the log by default. This setting causes these values to be logged verbatim.
| `Log Debug as Info`    | Redirect *Debug* level logging to *Info* level. This makes it visible in the Matterbridge frontend.

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

| 🚧 Electrolux Group API – DAM (Digital Appliance Model) |
| --- |
| *Electrolux have [announced](https://developer.electrolux.one/news) a transition of their API data model to a “Digital Appliance Model” (DAM). Based on the information currently available, this change is expected to break compatibility with this plugin (and other integrations using the Electrolux Group API); updates will be required to restore functionality.*<br>*It is not yet clear when (or even whether) legacy products such as the AEG RX9 / Electrolux Pure i9 robot vacuums will be migrated to this new model.*<br>*If you begin seeing log messages such as `Ignoring 1 incompatible appliance`, and the listed appliance type includes a `DAM_` prefix, please [open an issue](https://github.com/thoukydides/matterbridge-aeg-robot/issues/new/choose). Include a debug log captured using both the `Run API Tests` and `Log API Bodies` debug options.* |

<details>
<summary>Apple Home Limitations</summary>

### Robot Vacuums in Apple Home App

The Apple Home app in iOS/iPadOS 18.4 and macOS Sequoia has limited Matter support and exhibits multiple idiosyncrasies.

The Home app expects each robot vacuum to be a standalone, individually-paired Matter node implementing a single endpoint. However, Matterbridge acts as a Matter bridge - either a single bridge node for all plugins (*bridge* mode), or a separate bridge node per plugin (*childbridge* mode) - with each plugin's device exposed as an additional child endpoint. This causes a few issues when using this plugin with the Home app:
* **Multiple bridged devices:** A Matter bridge that exposes a robot vacuum plus other devices can crash the Home app. Hence, a separate Matterbridge instance is required for each robot vacuum. This plugin should be the only one enabled in each instance, and only a single robot vacuum device should be configured in each instance.
* **Device-specific information is ignored:** The Home app shows the bridge device information from Matterbridge's own root **Device Basic Information** cluster, ignoring the plugin's **Bridged Device Basic Information** cluster. As a result, the Home app displays the bridge's name, manufacturer, model, serial number, and firmware version; *not* those of the robot vacuum. The correct values can be specified using Matterbridge's command line options.

Other quirks in the Home app:
* **Delayed docking:** The *Send to Dock* button first sets **RVC Run Mode** to *Idle* (which maps to `stop` in the Electrolux Group API), followed by a **GoHome** command (`home`). The Electrolux Group API silently ignores commands sent too quickly in succession, so this plugin inserts a 5-second delay between them. This causes the robot vacuum to pause briefly before returning to the dock.
* **Incorrect RVC Clean Mode display:** The Home app displays ModeTag values (e.g. *Deep Clean*, *Quick*) rather than the advertised modes (*Smart*, *PowerSpot*, etc) reported by the robot vacuum. Worse, it only shows these when not cleaning, even though the Electrolux Group API only provides meaningful values during cleaning.

</details>

## Changelog

All notable changes to this project are documented in [`CHANGELOG.md`](CHANGELOG.md).

## Reporting Issues
          
If you have discovered an issue or have an idea for how to improve this project, please [open a new issue](https://github.com/thoukydides/matterbridge-aeg-robot/issues/new/choose) using the appropriate issue template.

### Pull Requests

As explained in [`CONTRIBUTING.md`](https://github.com/thoukydides/.github/blob/master/CONTRIBUTING.md), this project does **NOT** accept pull requests. Any PRs submitted will be closed without discussion.

## Legal

AEG, Electrolux, and Zanussi are trademarks of [AB Electrolux](https://www.electroluxgroup.com/).

### ISC License (ISC)

<details>
<summary>Copyright © 2025 Alexander Thoukydides</summary>

> Permission to use, copy, modify, and/or distribute this software for any purpose with or without fee is hereby granted, provided that the above copyright notice and this permission notice appear in all copies.
>
> THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
</details>