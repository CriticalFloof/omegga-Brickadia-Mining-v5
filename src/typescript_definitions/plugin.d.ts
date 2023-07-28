// This file declares all the types used by this plugin.

import * as og from "omegga";

export type SpatialVector = og.Vector
export type ChunkVector = og.Vector
export type SectionVector = og.Vector

export interface Item {
    name: string,
    id: number,
    baseBuyValue?: number,
    baseSellValue?: number,
    tags: string[]
}

export interface Tool extends Item {
    effectSize: SpatialVector,
    range: number,
    baseDamage: number,
    physicalRepresentation: og.WeaponClass
}

/**
 * Blocks That can be saved and loaded.
 */  
export interface Block {
    name: string,
    visibility: boolean,
    material_index: number,
    material_intensity: number,
    color: og.UnrealColor,
    flags: string[],
    components: og.Components<og.DefinedComponents>,
    size?: og.Vector,
    mask?: string
}

/**
 * Blocks that can be generated.
 */ 
export interface NaturalBlock extends Block {
    generator_data?: TerrainGeneratorData[]
}

/**
 * Blocks that can be mined into their item equivalent.
 */ 
export interface MineableBlock extends NaturalBlock {
    health: number,
    minimum_level: number,
    on_hit: Array<(parameters:{[key:string]:any})=>void> //Functions that are called whenever a block is hit. Like lava hurting the player.
    on_mine: Array<(parameters:{[key:string]:any})=>void> //Functions that are called whenever a block is mined. Like removing heatsuits, lowering hp, lotto block rng.
}

export interface MineableBlockJson extends NaturalBlock {
    health: number,
    minimum_level: number,
    on_hit: Object[] //Functions that are called whenever a block is hit. Like lava hurting the player.
    on_mine: Object[] //Functions that are called whenever a block is mined. Like removing heatsuits, lowering hp, lotto block rng.
}

export interface TerrainGeneratorData{
    surfaces: string[],
    abundance: number,
    depth: number,
    size: number,
    extent: number,
    flags: string[]
}



export interface Section {
    chunks: {[key:string]:ChunkData},
    structures: {[key:string]: Structure}
}

export interface Structure {
    nume: string,
    generate_radius: number
}

//An object that points to BlockObjects using an array.
export interface ChunkData {
    block_states: {[position:string]:{
        health?: number
    }},
    block_palette: string[],
    block_data: Uint8Array
}

export type BlockData = {
    block: string,
    position: og.Vector,
}