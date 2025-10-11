// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import {
    RX9MapPoint,
    RX9MapPointAngle,
    RX9MapTransform,
    RX9ZoneVertex
} from './aegapi-rx9-types.js';

// Any type that can represent a coordinate
export type AnyMapCoordinate = RX9ZoneVertex | RX9MapPoint | RX9MapPointAngle;

// A transformable coordinate
export class MapCoordinate implements RX9ZoneVertex {

    readonly x: number;
    readonly y: number;

    // Constructor a coordinate
    constructor(coord: AnyMapCoordinate) {
        [this.x, this.y] = 'x'  in coord ? [coord.x, coord.y]
                         : 'xy' in coord ? coord.xy
                                         : coord.xya;
    }

    // Scale the coordinate around the origin
    scale(scaleX: number, scaleY: number = scaleX): MapCoordinate {
        return new MapCoordinate({ x: this.x * scaleX, y: this.y * scaleY });
    }

    // Translate the coordinate
    add(addend: RX9ZoneVertex): MapCoordinate {
        return new MapCoordinate({
            x:  this.x + addend.x,
            y:  this.y + addend.y
        });
    }

    // Difference between two coordinates
    sub(subtrahend: RX9ZoneVertex): MapCoordinate {
        return new MapCoordinate({
            x:  this.x - subtrahend.x,
            y:  this.y - subtrahend.y
        });
    }

    // Rotate the coordinate anti-clockwise around the origin
    rotate(radians: number): MapCoordinate {
        return new MapCoordinate({
            x:  this.x * Math.cos(radians) - this.y * Math.sin(radians),
            y:  this.x * Math.sin(radians) + this.y * Math.cos(radians)
        });
    }

    // Round a coordinate to the nearest values
    round(): MapCoordinate {
        return new MapCoordinate({
            x:  Math.round(this.x),
            y:  Math.round(this.y)
        });
    }

    // Round a coordinate down to integral values
    floor(): MapCoordinate {
        return new MapCoordinate({
            x:  Math.floor(this.x),
            y:  Math.floor(this.y)
        });
    }

    // Round a coordinate up to integral values
    ceil(): MapCoordinate {
        return new MapCoordinate({
            x:  Math.ceil(this.x),
            y:  Math.ceil(this.y)
        });
    }

    // Map transformation
    transform(transform: RX9MapTransform): MapCoordinate {
        const [x, y, radians] = transform.xya;
        return this.sub({ x, y }).rotate(-radians);
    }

    // Split a coordinate into integral and signed fraction parts
    quantize(): [MapCoordinate, MapCoordinate] {
        const int = this.round();
        const frac = this.sub(int);
        return [int, frac];
    }

    // String representation of the coordinate
    toString(): string {
        return `(${this.x}, ${this.y})`;
    }

    // Bounding box for a collection of coordinates
    static boundingBox(coords: RX9ZoneVertex[]): [MapCoordinate, MapCoordinate] {
        const allX = coords.map(coord => coord.x);
        const allY = coords.map(coord => coord.y);
        return [
            new MapCoordinate({ x: Math.min(...allX), y: Math.min(...allY) }),
            new MapCoordinate({ x: Math.max(...allX), y: Math.max(...allY) })
        ];
    }

    // Mean of a collection of coordinate
    static mean(coords: RX9ZoneVertex[]): MapCoordinate {
        const mean = (values: number[]): number =>
            values.reduce((prev, current) => prev + current, 0) / values.length;
        return new MapCoordinate({
            x:  mean(coords.map(coord => coord.x)),
            y:  mean(coords.map(coord => coord.y))
        });
    }

    // Useful constants
    static readonly ZERO = new MapCoordinate({ x: 0, y: 0 });
    static readonly ONE  = new MapCoordinate({ x: 1, y: 1 });
}