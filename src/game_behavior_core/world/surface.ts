import * as og from "omegga";
import { BrickLoader } from "src/brick functions/brick_loader";
import {
    Block,
    ChunkData,
    ChunkVector,
    MineableBlock,
    NaturalBlock,
    Section,
    SectionVector,
    SpatialVector,
    TerrainGeneratorData,
} from "src/typescript_definitions/plugin";
import ChunkGenerator from "./chunk_generator";
import mtGenerator from "mersenne-twister";
import * as structure_data from "../../data/startup/object_sources/structures/structures.json";
import OmeggaImprovements from "src/omegga_improvements";
import { OmeggaHandler } from "../core_handlers/omegga_handler";
import { LoadManager, SaveManager } from "src/file_saver/save";
import { Game } from "../core_handlers/game_handler";

export class SurfaceHandler {
    public surfacesModifiedSinceLastSave: { [key: string]: boolean } = {};
    public surfaces: { [key: string]: Surface } = {};

    constructor() {}

    public async initializeSurface(
        name: string,
        properties?: {
            seed?: number;
            block_size?: og.Vector;
            chunk_size?: og.Vector;
            section_size?: og.Vector;
            offset?: og.Vector;
            owner_index?: number;
        }
    ) {
        try {
            await LoadManager.loadSurface(name, properties);
        } catch (error) {
            this.addSurface(name, properties);
        }
    }

    /**
     * Adds a surface to the handler
     * @param name String to look up/create the surface by.
     * @param properties Whenever the surface cannot be found, these properties will be used when creating a new surface.
     */
    private addSurface(
        name: string,
        properties?: {
            seed?: number;
            block_size?: og.Vector;
            chunk_size?: og.Vector;
            section_size?: og.Vector;
            offset?: og.Vector;
            owner_index?: number;
        }
    ) {
        this.surfaces[name] = new Surface(name, properties);
        this.surfacesModifiedSinceLastSave[name] = true;
    }

    /**
     * Loads the entire surface in chunks of bricks
     * @param name String to look up the surface by.
     */
    public async renderSurface(name: string, bufferSize: number) {
        Game.broadcast(`<size="14">Loading surface <color="00ff00">${name}</></>...`);
        console.info(`Loading surface '${name}'...`);

        LoadManager.loadSurfaceMask(name);
    }
}

/**
 * Handles the properties of the physical game space.
 */
export class Spatial {
    public block_size: og.Vector = [32, 32, 32];
    public offset: og.Vector = [0, 0, 0];
    public owner_index: number = 0;

    constructor(properties?: { block_size?: og.Vector; offset?: og.Vector; owner_index?: number }) {
        if (properties.block_size) this.block_size = properties.block_size;
        if (properties.offset) this.offset = properties.offset;
        if (properties.owner_index) this.owner_index = properties.owner_index;
    }

    /**
     * Returns the spatial position from world coordinates, this method loses some vector precision
     * @param world_position
     * @param spatial
     */
    public worldToSpatial(world_position: og.Vector): og.Vector {
        let spatialPosition: og.Vector = [
            Math.floor((world_position[0] - this.offset[0]) / this.block_size[0]),
            Math.floor((world_position[1] - this.offset[1]) / this.block_size[1]),
            Math.floor((world_position[2] - this.offset[2]) / this.block_size[2]),
        ];
        return spatialPosition;
    }

    /**
     * Returns the world position from spatial coordinates, be aware that position is locked to the blocks world position
     * @param spatial_position
     * @param spatial
     */
    public spatialToWorld(spatial_position: og.Vector): og.Vector {
        let worldPosition: og.Vector = [
            Math.floor(spatial_position[0] * this.block_size[0] + this.block_size[0] / 2 + this.offset[0]),
            Math.floor(spatial_position[1] * this.block_size[1] + this.block_size[1] / 2 + this.offset[1]),
            Math.floor(spatial_position[2] * this.block_size[2] + this.block_size[2] / 2 + this.offset[2]),
        ];
        return worldPosition;
    }
}

/**
 * Extension of Spatial, Handles terrain generation and game logic involving different spatials.
 */
export class Surface extends Spatial {
    public name: string;

    public seed: number = 0;
    public chunk_size: og.Vector = [16, 16, 16];
    public section_size: og.Vector = [8, 8, 8];
    public sectionsModifiedSinceLastSave: { [key: string]: boolean } = {};
    public sections: { [key: string]: Section } = {};
    public chunk_generator: ChunkGenerator;

    public layer_generator_data: { [key: string]: TerrainGeneratorData[] } = {};
    public ore_generator_data: { [key: string]: TerrainGeneratorData[] } = {};
    public prng: mtGenerator;

    constructor(
        name: string,
        properties?: {
            block_size?: og.Vector;
            chunk_size?: og.Vector;
            section_size?: og.Vector;
            offset?: og.Vector;
            owner_index?: number;
            seed?: number;
        }
    ) {
        super(properties);

        this.name = name;
        if (properties.chunk_size) this.chunk_size = properties.chunk_size;
        if (properties.section_size) this.section_size = properties.section_size;
        if (properties.seed) this.seed = properties.seed;

        this.prng = new mtGenerator(this.seed);

        if (!OmeggaHandler.game.block_source.blocks) {
            throw new Error(`SourceBlocks doesn't exist.`);
        }
        let blockKeys = Object.keys(OmeggaHandler.game.block_source.blocks);
        for (let i = 0; i < blockKeys.length; i++) {
            const block = OmeggaHandler.game.block_source.blocks[blockKeys[i]];
            if (!("generator_data" in block)) continue;
            let layerData: TerrainGeneratorData[] = [];
            let oreData: TerrainGeneratorData[] = [];
            for (let j = 0; j < block.generator_data.length; j++) {
                const terrainData = block.generator_data[j];
                if (terrainData.flags.includes("gas")) continue;
                if (terrainData.surfaces[0] === "*" || terrainData.surfaces.includes(this.name)) {
                    if (terrainData.flags.includes("layer")) {
                        layerData.push(terrainData);
                    } else {
                        oreData.push(terrainData);
                    }
                }
            }
            this.layer_generator_data[block.name] = layerData;
            this.ore_generator_data[block.name] = oreData;
        }
        this.chunk_generator = new ChunkGenerator(this);
    }

    public addSection(section_position: SectionVector): void {
        this.sections[`${section_position}`] = {
            chunks: {},
            structures: {},
        };
        this.sectionsModifiedSinceLastSave[`${section_position}`] = true;
        OmeggaHandler.game.surfaceHandler.surfacesModifiedSinceLastSave[this.name] = true;
    }

    public removeSection(section_position: SectionVector): void {
        delete this.sections[`${section_position}`];
        this.sectionsModifiedSinceLastSave[`${section_position}`] = false;
        OmeggaHandler.game.surfaceHandler.surfacesModifiedSinceLastSave[this.name] = true;
    }

    public addChunk(chunk_position: ChunkVector): void {
        let sectionPosition = this.chunkToSection(chunk_position);
        let relChunkPosition = this.chunkToRelative(chunk_position);
        this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`] = {
            block_states: {},
            block_palette: ["Air"],
            block_data: new Uint8Array(this.chunk_size[0] * this.chunk_size[1] * this.chunk_size[2]),
        };
        this.sectionsModifiedSinceLastSave[`${sectionPosition}`] = true;
        OmeggaHandler.game.surfaceHandler.surfacesModifiedSinceLastSave[this.name] = true;
    }

    public removeChunk(chunk_position: ChunkVector): void {
        let sectionPosition = this.chunkToSection(chunk_position);
        let relChunkPosition = this.chunkToRelative(chunk_position);
        delete this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`];
        this.sectionsModifiedSinceLastSave[`${sectionPosition}`] = true;
        OmeggaHandler.game.surfaceHandler.surfacesModifiedSinceLastSave[this.name] = true;
    }

    /**
     * Sets the block at a spatial position
     * @param spatialPositions
     * @returns
     */
    public setBlockAtPosition(blockName: string, absolute_position: SpatialVector): void {
        if (!OmeggaHandler.game.block_source.blocks) {
            throw new Error(`SourceBlocks doesn't exist.`);
        }
        if (!(blockName in OmeggaHandler.game.block_source.blocks)) {
            throw new Error(`Block '${blockName}' doesn't exist!`);
        }

        //Initalize position variables and check if chunks exist.
        let chunk: ChunkData;
        let sectionPosition: SectionVector = this.spatialToSection(absolute_position);
        let relChunkPosition: ChunkVector = this.chunkToRelative(this.spatialToChunk(absolute_position));
        let relSpatial: SpatialVector = this.spatialToRelative(absolute_position);

        try {
            chunk = this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`];
        } catch (error) {
            // Throw a more helpful error.
            throw new Error(`Chunk [${relChunkPosition}] doesn't exist in section [${sectionPosition}] in surface, '${this.name}'`);
        }

        let blockFoundIndex: number = -1;
        for (let i = 0; i < chunk.block_palette.length; i++) {
            const chunkElement = chunk.block_palette[i];
            if (chunkElement === blockName) {
                blockFoundIndex = i;
                break;
            }
        }
        if (blockFoundIndex === -1) {
            chunk.block_palette.push(blockName);
            blockFoundIndex = chunk.block_palette.length;
            chunk.block_palette[blockFoundIndex] = blockName;
        }
        chunk.block_data[BrickLoader.spatial2ArrayFunction(relSpatial, this)] = blockFoundIndex;
        this.sectionsModifiedSinceLastSave[`${sectionPosition}`] = true;
        OmeggaHandler.game.surfaceHandler.surfacesModifiedSinceLastSave[this.name] = true;
    }

    /**
     * Gets the block at a spatial position
     * @param spatialPositions
     * @returns
     */
    public getBlockAtPosition(absolute_position: SpatialVector): Block | NaturalBlock | MineableBlock | void {
        const chunkPosition = this.spatialToChunk(absolute_position);
        const relSpatialPosition = this.spatialToRelative(absolute_position);
        const relChunkPosition = this.chunkToRelative(chunkPosition);
        const sectionPosition = this.chunkToSection(chunkPosition);

        let block: Block | void;
        try {
            let chunk = this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`];
            block =
                OmeggaHandler.game.block_source.blocks[
                    chunk.block_palette[chunk.block_data[BrickLoader.spatial2ArrayFunction(relSpatialPosition, this)]]
                ];
        } catch (error) {
            //An error can only be thrown as a result of a chunk not existing.
            block = undefined;
        }

        return block;
    }

    public realizeStructure(): void {
        //Planned function that handles generating structures that aren't explicitly defined, ie mineshafts/villages/dungeons/strongholds
        throw new Error("Function not implemented.");
    }

    public generateStructure(name: string, absolute_position: SpatialVector): void {
        if (!(name in structure_data)) {
            throw Error(`No such Structure named ${name}`);
        }
        const bounds = structure_data[name].bounds;
        const palette = structure_data[name].palette;

        const minChunkPosition = this.spatialToChunk([
            absolute_position[0] - this.chunk_size[0],
            absolute_position[1] - this.chunk_size[1],
            absolute_position[2] - this.chunk_size[2],
        ]);
        const maxChunkPosition = this.spatialToChunk([
            absolute_position[0] + bounds[0] + this.chunk_size[0],
            absolute_position[1] + bounds[1] + this.chunk_size[1],
            absolute_position[2] + bounds[2] + this.chunk_size[2],
        ]);
        for (let x = minChunkPosition[0]; x < maxChunkPosition[0]; x++) {
            for (let y = minChunkPosition[1]; y < maxChunkPosition[1]; y++) {
                for (let z = minChunkPosition[2]; z < maxChunkPosition[2]; z++) {
                    this.chunk_generator.generateNewChunk([x, y, z], this);
                }
            }
        }

        for (let z = 0; z < structure_data[name].bounds[0]; z++) {
            for (let y = 0; y < structure_data[name].bounds[0]; y++) {
                for (let x = 0; x < structure_data[name].bounds[0]; x++) {
                    let blockName = palette[structure_data[name].data[z][y][x]];
                    this.setBlockAtPosition(blockName, [absolute_position[0] + x, absolute_position[1] + y, absolute_position[2] + z]);
                }
            }
        }
        if (structure_data[name].mask !== false) {
            //Load the mask
            //Offload this functionality to brickloader?
            let offset: og.Vector = [
                Math.floor(absolute_position[0] * this.block_size[0] + this.offset[0]),
                Math.floor(absolute_position[1] * this.block_size[1] + this.offset[1]),
                Math.floor(absolute_position[2] * this.block_size[2] + this.offset[2]),
            ];
            let worldMidpoint: og.Vector = [
                offset[0] + (bounds[0] / 2) * this.block_size[0],
                offset[1] + (bounds[1] / 2) * this.block_size[1],
                offset[2] + (bounds[2] / 2) * this.block_size[2],
            ];
            let worldExtent: og.Vector = [
                (bounds[0] * this.block_size[0]) / 2,
                (bounds[1] * this.block_size[1]) / 2,
                (bounds[2] * this.block_size[2]) / 2,
            ];
            BrickLoader.neighbourUpdateSegment(
                this,
                [absolute_position, [absolute_position[0] + bounds[0], absolute_position[1] + bounds[1], absolute_position[2] + bounds[2]]],
                { quiet: true }
            ).then(() => {
                Omegga.clearRegion({ center: worldMidpoint, extent: worldExtent });
                OmeggaImprovements.loadBricks(`Mine-Test/Structures/${structure_data[name].mask}`, {
                    quiet: true,
                    offX: offset[0],
                    offY: offset[1],
                    offZ: offset[2],
                });
            });
        } else {
            //Load the pure brick representation

            BrickLoader.neighbourUpdateSegment(
                this,
                [absolute_position, [absolute_position[0] + bounds[0], absolute_position[1] + bounds[1], absolute_position[2] + bounds[2]]],
                { quiet: true }
            );
        }
    }

    public spatialToSection(spatial_position: SpatialVector): SectionVector {
        return this.chunkToSection(this.spatialToChunk(spatial_position));
    }

    public spatialToChunk(spatial_position: SpatialVector): ChunkVector {
        let chunkPosition: og.Vector = [
            Math.floor(spatial_position[0] / this.chunk_size[0]),
            Math.floor(spatial_position[1] / this.chunk_size[1]),
            Math.floor(spatial_position[2] / this.chunk_size[2]),
        ];
        return chunkPosition;
    }

    public chunkToSection(chunk_position: ChunkVector): SectionVector {
        let sectionPosition: og.Vector = [
            Math.floor(chunk_position[0] / this.section_size[0]),
            Math.floor(chunk_position[1] / this.section_size[1]),
            Math.floor(chunk_position[2] / this.section_size[2]),
        ];
        return sectionPosition;
    }

    public chunkToRelative(chunk_position: ChunkVector): ChunkVector {
        //positions Relative to a Section
        let relChunkPosition: og.Vector = [
            chunk_position[0] % this.section_size[0],
            chunk_position[1] % this.section_size[1],
            chunk_position[2] % this.section_size[2],
        ];

        if (relChunkPosition[0] < 0) {
            relChunkPosition[0] += this.section_size[0];
        }
        if (relChunkPosition[1] < 0) {
            relChunkPosition[1] += this.section_size[1];
        }
        if (relChunkPosition[2] < 0) {
            relChunkPosition[2] += this.section_size[2];
        }

        return relChunkPosition;
    }

    public spatialToRelative(spatial_position: SpatialVector): SpatialVector {
        //positions Relative to a Chunk
        let relSpatialPosition: og.Vector = [
            spatial_position[0] % this.chunk_size[0],
            spatial_position[1] % this.chunk_size[1],
            spatial_position[2] % this.chunk_size[2],
        ];

        if (relSpatialPosition[0] < 0) {
            relSpatialPosition[0] += this.chunk_size[0];
        }
        if (relSpatialPosition[1] < 0) {
            relSpatialPosition[1] += this.chunk_size[1];
        }
        if (relSpatialPosition[2] < 0) {
            relSpatialPosition[2] += this.chunk_size[2];
        }

        return relSpatialPosition;
    }

    /**
     * Returns the first position found in an array containing a solid.
     * @param spatialPositions
     * @returns An object containing absolute spatial position, and another object containing relative spatial, chunk, and sector.
     */
    public findSolidPosition(
        worldPositions: og.Vector[]
    ): { absolutePosition: og.Vector; memoryPosition: { relativeSpatial: og.Vector; relativeChunk: og.Vector; section: og.Vector } } | void {
        for (let i = 0; i < worldPositions.length; i++) {
            const spatialPosition = this.worldToSpatial(worldPositions[i]);
            const chunkPosition = this.spatialToChunk(spatialPosition);

            const relSpatialPosition = this.spatialToRelative(spatialPosition);
            const relChunkPosition = this.chunkToRelative(chunkPosition);
            const sectionPosition = this.chunkToSection(chunkPosition);
            //if no section found.
            if (!this.sections[`${sectionPosition}`]) continue;
            //if no chunk found.
            if (!this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`]) continue;
            const chunk = this.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`];

            let no_generate = false;

            let block: Block =
                OmeggaHandler.game.block_source.blocks[
                    chunk.block_palette[chunk.block_data[BrickLoader.spatial2ArrayFunction(relSpatialPosition, this)]]
                ];
            if (block == undefined) block = OmeggaHandler.game.block_source.blocks["Dirt"]; // Classic Dirt as fallback

            for (let j = 0; j < block.flags.length; j++) {
                const flag = block.flags[j];

                if (flag === "no_generate") {
                    no_generate = true;
                }
            }

            //if no solid block found.
            if (no_generate) continue;

            //return position
            return {
                absolutePosition: spatialPosition,
                memoryPosition: { relativeSpatial: relSpatialPosition, relativeChunk: relChunkPosition, section: sectionPosition },
            };
        }
    }
}
