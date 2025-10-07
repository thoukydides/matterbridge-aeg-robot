# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v1.2.0] - 2025-10-07
### Added
* Service Area `CurrentArea` and `Progress` status attributes during a *Zones* clean (not supported by *Everywhere* clean).

## [v1.1.19] - 2025-10-05
### Fixed
* Support `avoid` zones without a valid `powerMode`. (#10)

## [v1.1.18] - 2025-10-05
### Fixed
* Restored support for the Service Area cluster. (#10)

## [v1.1.17] - 2025-10-04
### Changed
* Compatibility with Matterbridge version 3.4.0.
* Updated dependencies.

## [v1.1.16] - 2025-10-03
### Fixed
* Accept additional property values returned by recent API changes. (#10)

## [v1.1.15] - 2025-10-02
### Fixed
* Accept additional property values returned by recent API changes. (#10)
### Changed
* Updated dependencies.

## [v1.1.14] - 2025-09-22
### Fixed
* Accept `AbortedByUser` for the API's `endedReason` property. (#10)
### Changed
* Updated dependencies.

## [v1.1.13] - 2025-09-11
### Changed
* Accept additional properties returned by recent API changes.

## [v1.1.12] - 2025-09-07
### Fixed
* Accept `Nav` for the API's `endedReason` property. (#8)

## [v1.1.11] - 2025-09-06
### Changed
* Updated dependencies.

## [v1.1.10] - 2025-08-23
### Changed
* Updated dependencies.

## [v1.1.9] - 2025-08-06
### Changed
* Accept additional properties returned by recent API changes.

## [v1.1.8] - 2025-08-02
### Changed
* Accept additional properties returned by recent API changes.

## [v1.1.7] - 2025-08-02
### Changed
* Accept arbitrary case for property names in API responses.

## [v1.1.6] - 2025-08-01
### Changed
* Accept additional properties returned by recent API changes.

## [v1.1.5] - 2025-08-01
### Changed
* Accept additional properties returned by recent API changes.
* Updated dependencies.

## [v1.1.4] - 2025-07-29
### Changed
* Accept additional properties returned by recent API changes.
* Updated dependencies.

## [v1.1.3] - 2025-07-20
### Changed
* Accept `readwrite` access for the API's `powerMode` capability.
* Updated dependencies.

## [v1.1.2] - 2025-07-09
### Changed
* Improved logging of aggregated errors or those indicating another error as their cause.
* Updated dependencies.

## [v1.1.1] - 2025-07-06
### Fixed
* Resolved problems with multiple robot vacuums in a single Matterbridge instance, caused by duplicate Matter.js enum values.

## [v1.1.0] - 2025-07-06
### Added
* Improved Apple Home compatibility by enabling Matterbridge's `server` mode by default. This exposes each robot vacuum as a standalone Matter node rather than a bridged endpoint. It requires each robot vacuum to be re-paired with the Matter controller. The previous bridged behaviour can be restored by setting `"enableServerRvc": false`. Requires Matterbridge v3.1.1 or later.

## [v1.0.0] - 2025-07-04
### Added
* Support cleaning of specific zones via the Service Area cluster.
### Changed
* Updated dependencies.

## [v0.4.1] - 2025-06-21
### Changed
* Accept `CustomPlay/persistentMapId` and `CustomPlay/zones` capabilities from the API.
* Updated dependencies.

## [v0.4.0] - 2025-05-26
### Changed
* The `blackList` and `whiteList` now use the robot vacuum's serial number instead of its name.
* Revised README and package identifiers.

## [v0.3.1] - 2025-05-20
### Fixed
* Compatibility with Matterbridge version 3.0.3.
### Changed
* Updated dependencies.

## [v0.3.0] - 2025-04-30
### Added
* Implemented `Log Debug as Info` configuration option.
### Changed
* Dropped Node.js 18 support.
* Updated dependencies.

## [v0.2.0] - 2025-04-22
### Fixed
* Wait until endpoints have been initialised before configuring them.
### Changed
* Use manufacturer-defined **OperationalStatus** codes for `ManualSteering` and `FirmwareUpgrade` states (previously they were reported as `Error` states).
* Use manufacturer-defined **OperationalError** code for non-standard errors (previously all unmappable errors were reported as `UnableToCompleteOperation`).
* Improved log output colouring.

## [v0.1.0] - 2025-04-19
* Initial version.

---

Copyright © 2025 Alexander Thoukydides

[Unreleased]:       https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.2.0...HEAD
[v1.2.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.19...v1.2.0
[v1.1.19]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.18...v1.1.19
[v1.1.18]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.17...v1.1.18
[v1.1.17]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.16...v1.1.17
[v1.1.16]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.15...v1.1.16
[v1.1.15]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.14...v1.1.15
[v1.1.14]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.13...v1.1.14
[v1.1.13]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.12...v1.1.13
[v1.1.12]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.11...v1.1.12
[v1.1.11]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.10...v1.1.11
[v1.1.10]:          https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.9...v1.1.10
[v1.1.9]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.8...v1.1.9
[v1.1.8]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.7...v1.1.8
[v1.1.7]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.6...v1.1.7
[v1.1.6]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.5...v1.1.6
[v1.1.5]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.4...v1.1.5
[v1.1.4]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.3...v1.1.4
[v1.1.3]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.2...v1.1.3
[v1.1.2]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.1...v1.1.2
[v1.1.1]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.1.0...v1.1.1
[v1.1.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v1.0.0...v1.1.0
[v1.0.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.4.1...v1.0.0
[v0.4.1]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.4.0...v0.4.1
[v0.4.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.3.1...v0.4.0
[v0.3.1]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.3.0...v0.3.1
[v0.3.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.2.0...v0.3.0
[v0.2.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.1.0...v0.2.0
[v0.1.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/releases/tag/v0.1.0
