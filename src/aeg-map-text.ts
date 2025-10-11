// Matterbridge plugin for AEG RX9 / Electrolux Pure i9 robot vacuum
// Copyright © 2025 Alexander Thoukydides

import assert from 'assert';
import { MapCoordinate } from './aeg-map-coordinate.js';
import { assertIsDefined } from './utils.js';

// A single character with its colour codes
export interface MapTextColour {
    bg?:            string;
    fg?:            string;
}
export interface MapTextCell {
    glyph:          string;
    colour:         Required<MapTextColour>;
}

// Configuration of canvas and drawing style
export interface MapTextConfig {
    maxSize:        MapCoordinate;
    aspectRatio:    number; // (width / height)
    quadrant:       string;
    box:            string;
    fill:           MapTextCell;
    eol:            string;
}

// A text canvas
export class MapText {

    // The canvas
    readonly canvas:    MapTextCell[][];
    readonly cols:      number;
    readonly rows:      number;

    // Transform from source position to character coordinates
    readonly scaleX:    number;
    readonly scaleY:    number;
    readonly topLeft:   MapCoordinate;

    // Construct a text canvas
    constructor(
        readonly config:    MapTextConfig,
        boundMin:           MapCoordinate,
        boundMax:           MapCoordinate
    ) {
        // Scaling from source coordinates to characters
        const { maxSize, aspectRatio, fill } = config;
        const boundSize = boundMax.sub(boundMin);
        this.scaleX = Math.min((maxSize.x - 1) / boundSize.x,
                               (maxSize.y - 1) / (boundSize.y * aspectRatio));
        this.scaleY = this.scaleX * aspectRatio;

        // Source coordinate corresponding to centre of top-left character
        this.topLeft = new MapCoordinate({ x: boundMin.x, y: boundMax.y });

        // Actual canvas dimensions in characters
        const canvasSize = boundSize.scale(this.scaleX, this.scaleY).round();
        this.cols = canvasSize.x + 1;
        this.rows = canvasSize.y + 1;

        // Create a blank canvas
        this.canvas = Array.from({ length: this.rows }, () =>
            Array.from({ length: this.cols }, () => structuredClone(fill))
        );
    }

    // Convert a coordinate to canvas coordinates
    transform(coord: MapCoordinate): MapCoordinate {
        return coord.sub(this.topLeft).scale(this.scaleX, -this.scaleY);
    }

    // Plot a string label
    plotLabel(centre: MapCoordinate, label: string, colour?: MapTextColour): void {
        // Split the label into glyphs (strictly speaking 'graphemes')
        const segmenter = new Intl.Segmenter();
        const glyphs = Array.from(segmenter.segment(label), ({segment}) => segment);

        // Centre the label at the specified coordinate
        const coord = this.transform(centre)
            .sub(new MapCoordinate({ x: glyphs.length / 2, y: 0 }))
            .round();

        // Move a partially visible label entirely within the canvas
        let x = coord.x;
        if (x < 0) x = 0;
        if (this.cols < glyphs.length) glyphs.length = this.cols;
        if (this.cols < x + glyphs.length) x = this.cols - glyphs.length;

        // Plot the individual glyphs
        glyphs.forEach((glyph, index) => {
            this.set(new MapCoordinate({ x: x + index, y: coord.y }), glyph, colour);
        });
    }

    // Plot a rectangular box (outline only)
    plotRectangle(coords: MapCoordinate[], colour?: MapTextColour): void {
        // Use the rounded bounding box of the provided coordinates
        const [coordMin, coordMax] = MapCoordinate.boundingBox(coords.map(coord => this.transform(coord).round()));

        // Named access to the box drawing characters
        const [tl, tr, bl, br, h, v] = this.config.box;
        assertIsDefined(tl); assertIsDefined(tr); assertIsDefined(bl);
        assertIsDefined(br); assertIsDefined(h);  assertIsDefined(v);

        // Plot the edges
        for (let x = coordMin.x + 1; x < coordMax.x; ++x) {
            this.set(new MapCoordinate({ x, y: coordMin.y }), h, colour);
            this.set(new MapCoordinate({ x, y: coordMax.y }), h, colour);
        }
        for (let y = coordMin.y + 1; y < coordMax.y; ++y) {
            this.set(new MapCoordinate({ x: coordMin.x, y }), v, colour);
            this.set(new MapCoordinate({ x: coordMax.x, y }), v, colour);
        }

        // Plot the corners
        this.set(coordMin, tl, colour);
        this.set(coordMax, br, colour);
        this.set(new MapCoordinate({ x: coordMin.x, y: coordMax.y }), bl, colour);
        this.set(new MapCoordinate({ x: coordMax.x, y: coordMin.y }), tr, colour);
    }

    // Plot a solid polygon (filled)
    plotFilledPolygon(coords: MapCoordinate[], glyph?: string, colour?: MapTextColour): void {
        // Transform coordinates and organise as edges
        coords = coords.map(coord => this.transform(coord));
        const edges = coords.map<[MapCoordinate, MapCoordinate]>((coord, index) => {
            const nextCoord = coords[(index + 1) % coords.length];
            assertIsDefined(nextCoord);
            return [coord, nextCoord];
        });

        // Iterate over the rows occupied by the polygon
        const coordsY = coords.map(({ y }) => y);
        const yMin = Math.min(...coordsY);
        const yMax = Math.max(...coordsY);
        for (let y = Math.ceil(yMin); y < yMax; ++y) {
            // Determine where the edges cross this row
            const intersections = edges
                .filter(([{y: y0}, {y: y1}]) => Math.min(y0, y1) <= y && y < Math.max(y0, y1))
                .map(([c0, c1]) => c0.x + (y - c0.y) * (c1.x - c0.x) / (c1.y - c0.y))
                .sort((a, b) => a - b);
            assert(intersections.length % 2 === 0);

            // Fill between each pair of intersections
            for (let i = 0; i < intersections.length; i += 2) {
                const [x0, x1] = intersections.slice(i, i + 2);
                assertIsDefined(x0); assertIsDefined(x1);
                for (let x = Math.ceil(x0); x < x1; ++x) {
                    this.set(new MapCoordinate({ x, y }), glyph, colour);
                }
            }
        }
    }

    // Plot a filled circle
    plotCircle(centre: MapCoordinate, diameter: number, glyph?: string, colour?: MapTextColour): void {
        // Ellipse characteristics in character coordinates
        const coord = this.transform(centre);
        const radiusX = diameter * this.scaleX / 2;
        const radiusY = diameter * this.scaleY / 2;

        // Grid size for quadrant blocks or whole characters
        const step = glyph === undefined ? 0.5 : 1;
        const ceil = (value: number): number =>
            (Math.ceil(value / step - step) + step) * step;

        // Plot the ellipse, row by row
        for (let y = ceil(coord.y - radiusY); y < coord.y + radiusY; y += step) {
            const r = Math.sqrt(1 - ((y - coord.y) / radiusY) ** 2) * radiusX;
            for (let x = ceil(coord.x - r); x <= coord.x + r; x += step) {
                if (glyph) this.set(new MapCoordinate({ x, y }), glyph, colour);
                else this.setQuadrant(new MapCoordinate({ x, y }), colour);
            }
        }
    }

    // Set a quadrant block
    setQuadrant(coord: MapCoordinate, colour?: MapTextColour): void {
        const { quadrant } = this.config;
        const [int, frac] = coord.quantize();

        // Determine the currently set quadrants
        let quadBits = quadrant.indexOf(this.get(int).glyph);
        if (quadBits === -1) quadBits = 0;

        // Set the required quadrant
        const quad = (frac.x < 0 ? 0 : 1) + (frac.y < 0 ? 0 : 2);
        const quadGlyph = quadrant[quadBits | (1 << quad)];
        assertIsDefined(quadGlyph);
        this.set(int, quadGlyph, colour);
    }

    // Get a single cell from the canvas
    get(coord: MapCoordinate): MapTextCell {
        const cell = this.canvas[coord.y]?.[coord.x];
        assertIsDefined(cell);
        return cell;
    }

    // Set a single cell in the canvas
    set(coord: MapCoordinate, glyph?: string, colour?: MapTextColour): void {
        // Apply range checks
        if (coord.y < 0 || this.rows <= coord.y) return;
        if (coord.x < 0 || this.cols <= coord.x) return;

        // Update the canvas
        const cell = this.canvas[coord.y]?.[coord.x];
        assertIsDefined(cell);
        if (glyph?.length) cell.glyph = glyph;
        if (colour?.bg !== undefined) cell.colour.bg = colour.bg;
        if (colour?.fg !== undefined) cell.colour.fg = colour.fg;
    }

    // Render the canvas as lines of text
    render(): string[] {
        return this.canvas.map(row =>
            row.reduce<{ line: string, colour: MapTextColour }>(({ line, colour }, cell) => {
                if (cell.colour.bg !== colour.bg) line += colour.bg = cell.colour.bg;
                if (cell.colour.fg !== colour.fg) line += colour.fg = cell.colour.fg;
                line += cell.glyph;
                return { line, colour };
            }, { line: '', colour: {} }).line + this.config.eol);
    }
}