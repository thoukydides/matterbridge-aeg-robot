# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [v0.4.0] - 2025-05-26
### Changed
* The `blacklist` and `whitelist` now use the robot vacuum's serial number instead of its name.
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
* Added more log colouring.

## [v0.1.0] - 2025-04-19
* Initial version.

---

Copyright © 2025 Alexander Thoukydides

[Unreleased]:       https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.4.0...HEAD
[v0.4.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.3.1...v0.4.0
[v0.3.1]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.3.0...v0.3.1
[v0.3.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.2.0...v0.3.0
[v0.2.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/compare/v0.1.0...v0.2.0
[v0.1.0]:           https://github.com/thoukydides/matterbridge-aeg-robot/releases/tag/v0.1.0
