/*
These are responsible for taking game data and allowing easy access for loading bricks.
Note: Bricks should not contain any game information, and are only used as an input/output device for data.
*/


import * as og from "omegga";
import OmeggaImprovements from "../omegga_improvements/index";
import { Surface } from "src/game_behavior_core/world/surface";
import { SpatialVector } from "src/typescript_definitions/plugin";

/**
 * This class is responsible for loading bricks from world data.
 */

export class BrickLoader{
    
    /**
     * The standard object the plugin references to load bricks, This allows easy setting/getting 
     */
    public static writeSaveObjectStandard : Partial<og.WriteSaveObject> = {
        brick_assets:["PB_DefaultMicroBrick","PB_DefaultBrick","PB_DefaultTile"],
        materials:[
            'BMC_Plastic',
            'BMC_Metallic',
            'BMC_Glow',
            'BMC_Glass',
            'BMC_Hologram'
        ],
        physical_materials:[], //Physical Materials do not exist in brickadia at the time of making this.
        brick_owners:[
            {
                id: '44444444-0001-ffff-dddd-444444444444',
                name: 'Mercury'
            },
            {
                id: '44444444-0002-ffff-dddd-444444444444',
                name: 'Venus'
            },
            {
                id: '44444444-0003-ffff-dddd-444444444444',
                name: 'Earth'
            },
            {
                id: '44444444-0004-ffff-dddd-444444444444',
                name: 'Mars'
            },
            {
                id: '44444444-0005-ffff-dddd-444444444444',
                name: 'Titan'
            },
            {
                //While developing, I found out that owner index of 0 is silently assigned to PUBLIC and everything else is shifted, so to call the last valid index, a placeholder is present.
                id: 'ffffffff-ffff-ffff-ffff-ffffffffffff',
                name: 'Placeholder' 
            }

        ]
    };

    /**
     * Loads Bricks from a pair of vectors
     */
    public static loadSegment( surface : Surface, spatial_pairs : [SpatialVector, SpatialVector], options?: {
		offX?: number;
		offY?: number;
		offZ?: number;
		quiet?: boolean;
		correctPalette?: boolean;
		correctCustom?: boolean;}
    )
    {

        let spatial_difference = [
            spatial_pairs[0][0] - spatial_pairs[1][0],
            spatial_pairs[0][1] - spatial_pairs[1][1],
            spatial_pairs[0][2] - spatial_pairs[1][2]
        ]

        let spatialMin = [
            Math.min(spatial_pairs[0][0],spatial_pairs[1][0]),
            Math.min(spatial_pairs[0][1],spatial_pairs[1][1]),
            Math.min(spatial_pairs[0][2],spatial_pairs[1][2]),
        ]

        let bricks : og.Brick[] = []
        for (let x = 0; x < Math.abs(spatial_difference[0])+1; x++) {
            for (let y = 0; y < Math.abs(spatial_difference[1])+1; y++) {
                for (let z = 0; z < Math.abs(spatial_difference[2])+1; z++) {
                    let spatialPosition : og.Vector = [spatialMin[0]+x,spatialMin[1]+y,spatialMin[2]+z]
                    let block = surface.getBlockAtPosition(spatialPosition)
                    if(!block || block.name === "Air") continue;
                    
                    let neighbours : og.Vector[] = [
                        [spatialPosition[0]+1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0]-1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]+1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]-1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]+1],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]-1]
                    ]

                    let foundBlock = false
                    
                    for (let i = 0; i < neighbours.length; i++) {
                        const neighbourPosition : og.Vector = neighbours[i];
                        let neighbourBlock = surface.getBlockAtPosition(neighbourPosition)
                        if(!neighbourBlock || neighbourBlock.name !== "Air") continue;
                        foundBlock = true
                    }

                    if(!foundBlock) continue;

                    bricks.push({
                        asset_name_index: 0,
                        visibility: block.visibility,
                        owner_index: surface.owner_index+1,
                        size: [surface.block_size[0]/2,surface.block_size[1]/2,surface.block_size[2]/2],
                        position: surface.spatialToWorld([spatialPosition[0],spatialPosition[1],spatialPosition[2]]),
                        material_index: block.material_index,
                        material_intensity: block.material_intensity,
                        components: block.components,
                        color: block.color
                    })
                }
            }
        }

        //Load the Bricks.
        if(bricks.length === 0) return;

        let save : og.WriteSaveObject = {
            ...this.writeSaveObjectStandard,
            bricks:bricks
        };
        
        OmeggaImprovements.loadSaveData(save, options);
    }

    /**
     * Loads Bricks from a pair of vectors, including any neighbouring ones.
     */
    public static neighbourLoadSegment( surface : Surface, spatial_pairs : [SpatialVector, SpatialVector], options?: {
		offX?: number;
		offY?: number;
		offZ?: number;
		quiet?: boolean;
		correctPalette?: boolean;
		correctCustom?: boolean;}
    )
    {

        let spatial_difference = [
            spatial_pairs[0][0] - spatial_pairs[1][0],
            spatial_pairs[0][1] - spatial_pairs[1][1],
            spatial_pairs[0][2] - spatial_pairs[1][2]
        ]

        let spatialMin = [
            Math.min(spatial_pairs[0][0],spatial_pairs[1][0]),
            Math.min(spatial_pairs[0][1],spatial_pairs[1][1]),
            Math.min(spatial_pairs[0][2],spatial_pairs[1][2]),
        ]

        let bricks : og.Brick[] = []
        for (let x = -1; x < Math.abs(spatial_difference[0])+2; x++) {
            for (let y = -1; y < Math.abs(spatial_difference[1])+2; y++) {
                for (let z = -1; z < Math.abs(spatial_difference[2])+2; z++) {
                    if(
                        (x == -1 || x == Math.abs(spatial_difference[0])+1) && (y == -1 || y == Math.abs(spatial_difference[1])+1) ||
                        (y == -1 || y == Math.abs(spatial_difference[1])+1) && (z == -1 || z == Math.abs(spatial_difference[2])+1) ||
                        (z == -1 || z == Math.abs(spatial_difference[2])+1) && (x == -1 || x == Math.abs(spatial_difference[0])+1) 
                    ) continue;
                    

                    let spatialPosition : og.Vector = [spatialMin[0]+x,spatialMin[1]+y,spatialMin[2]+z]
                    let block = surface.getBlockAtPosition(spatialPosition)
                    if(!block || block.name === "Air") continue;
                    
                    let neighbours : og.Vector[] = [
                        [spatialPosition[0]+1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0]-1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]+1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]-1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]+1],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]-1]
                    ]

                    let foundBlock = false
                    
                    for (let i = 0; i < neighbours.length; i++) {
                        const neighbourPosition : og.Vector = neighbours[i];
                        let neighbourBlock = surface.getBlockAtPosition(neighbourPosition)
                        if(!neighbourBlock || neighbourBlock.name !== "Air") continue;
                        foundBlock = true
                    }

                    if(!foundBlock) continue;

                    bricks.push({
                        visibility: block.visibility,
                        asset_name_index: 0,
                        owner_index: surface.owner_index+1,
                        size: [surface.block_size[0]/2,surface.block_size[1]/2,surface.block_size[2]/2],
                        position: surface.spatialToWorld([spatialPosition[0],spatialPosition[1],spatialPosition[2]]),
                        material_index: block.material_index,
                        material_intensity: block.material_intensity,
                        components: block.components,
                        color: block.color
                    })
                }
            }
        }

        //Load the Bricks.
        if(bricks.length === 0) return;

        let save : og.WriteSaveObject = {
            ...this.writeSaveObjectStandard,
            bricks:bricks
        };
        
        OmeggaImprovements.loadSaveData(save, options);
    }

    /**
    * Clears, then Loads Bricks from a pair of vectors
    */
    public static async updateSegment( surface : Surface, spatial_pairs : [SpatialVector, SpatialVector], options?: {
        offX?: number;
        offY?: number;
        offZ?: number;
        quiet?: boolean;
        correctPalette?: boolean;
        correctCustom?: boolean;}
    )
    {

        let worldMidpoint : og.Vector = surface.spatialToWorld([
            (spatial_pairs[0][0] + spatial_pairs[1][0])/2,
            (spatial_pairs[0][1] + spatial_pairs[1][1])/2,
            (spatial_pairs[0][2] + spatial_pairs[1][2])/2
        ])

        let worldExtent : og.Vector = [
            (Math.abs(spatial_pairs[0][0] - spatial_pairs[1][0])+1)*surface.block_size[0]/2,
            (Math.abs(spatial_pairs[0][1] - spatial_pairs[1][1])+1)*surface.block_size[1]/2,
            (Math.abs(spatial_pairs[0][2] - spatial_pairs[1][2])+1)*surface.block_size[2]/2
        ]

        let spatial_difference = [
            spatial_pairs[0][0] - spatial_pairs[1][0],
            spatial_pairs[0][1] - spatial_pairs[1][1],
            spatial_pairs[0][2] - spatial_pairs[1][2]
        ]

        let spatialMin = [
            Math.min(spatial_pairs[0][0],spatial_pairs[1][0]),
            Math.min(spatial_pairs[0][1],spatial_pairs[1][1]),
            Math.min(spatial_pairs[0][2],spatial_pairs[1][2]),
        ]

        let bricks : og.Brick[] = []
        for (let x = 0; x < Math.abs(spatial_difference[0])+1; x++) {
            for (let y = 0; y < Math.abs(spatial_difference[1])+1; y++) {
                for (let z = 0; z < Math.abs(spatial_difference[2])+1; z++) {
                    let spatialPosition : og.Vector = [spatialMin[0]+x,spatialMin[1]+y,spatialMin[2]+z]
                    let block = surface.getBlockAtPosition(spatialPosition)
                    if(!block || block.name === "Air") continue;
                    
                    let neighbours : og.Vector[] = [
                        [spatialPosition[0]+1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0]-1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]+1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]-1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]+1],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]-1]
                    ]

                    let foundBlock = false
                    
                    for (let i = 0; i < neighbours.length; i++) {
                        const neighbourPosition : og.Vector = neighbours[i];
                        let neighbourBlock = surface.getBlockAtPosition(neighbourPosition)
                        if(!neighbourBlock || neighbourBlock.name !== "Air") continue;
                        foundBlock = true
                    }

                    if(!foundBlock) continue;

                    bricks.push({
                        asset_name_index: 0,
                        visibility: block.visibility,
                        owner_index: surface.owner_index+1,
                        size: [surface.block_size[0]/2,surface.block_size[1]/2,surface.block_size[2]/2],
                        position: surface.spatialToWorld([spatialPosition[0],spatialPosition[1],spatialPosition[2]]),
                        material_index: block.material_index,
                        material_intensity: block.material_intensity,
                        components: block.components,
                        color: block.color
                    })
                }
            }
        }

        //Load the Bricks.
        if(bricks.length === 0) {
            Omegga.clearRegion({center : worldMidpoint, extent : worldExtent})
            return;
        }

        let save : og.WriteSaveObject = {
            ...this.writeSaveObjectStandard,
            bricks:bricks
        };
        
        await OmeggaImprovements.bakeSaveData(save).then((fileName)=>{
            Omegga.clearRegion({center : worldMidpoint, extent : worldExtent})
            OmeggaImprovements.loadBricks(fileName, options).then
            (()=>OmeggaImprovements.removeSaveFile(fileName))
        })
    }

    /**
    * Clears, then Loads Bricks from a pair of vectors, including any neighbouring ones.
    */
    public static async neighbourUpdateSegment(surface : Surface, spatial_pairs : [SpatialVector, SpatialVector], options?: {
        offX?: number;
        offY?: number;
        offZ?: number;
        quiet?: boolean;
        correctPalette?: boolean;
        correctCustom?: boolean;}
    )
    {

        let worldMidpoint : og.Vector = surface.spatialToWorld([
            (spatial_pairs[0][0] + spatial_pairs[1][0])/2,
            (spatial_pairs[0][1] + spatial_pairs[1][1])/2,
            (spatial_pairs[0][2] + spatial_pairs[1][2])/2
        ])

        let worldExtent : og.Vector = [
            (Math.abs(spatial_pairs[0][0] - spatial_pairs[1][0])+1)*surface.block_size[0]/2,
            (Math.abs(spatial_pairs[0][1] - spatial_pairs[1][1])+1)*surface.block_size[1]/2,
            (Math.abs(spatial_pairs[0][2] - spatial_pairs[1][2])+1)*surface.block_size[2]/2
        ]
        
        let spatial_difference = [
            spatial_pairs[0][0] - spatial_pairs[1][0],
            spatial_pairs[0][1] - spatial_pairs[1][1],
            spatial_pairs[0][2] - spatial_pairs[1][2]
        ]

        let spatialMin = [
            Math.min(spatial_pairs[0][0],spatial_pairs[1][0]),
            Math.min(spatial_pairs[0][1],spatial_pairs[1][1]),
            Math.min(spatial_pairs[0][2],spatial_pairs[1][2]),
        ]

        let bricks : og.Brick[] = []
        for (let x = -1; x < Math.abs(spatial_difference[0])+2; x++) {
            for (let y = -1; y < Math.abs(spatial_difference[1])+2; y++) {
                for (let z = -1; z < Math.abs(spatial_difference[2])+2; z++) {
                    if(
                        (x == -1 || x == Math.abs(spatial_difference[0])+1) && (y == -1 || y == Math.abs(spatial_difference[1])+1) ||
                        (y == -1 || y == Math.abs(spatial_difference[1])+1) && (z == -1 || z == Math.abs(spatial_difference[2])+1) ||
                        (z == -1 || z == Math.abs(spatial_difference[2])+1) && (x == -1 || x == Math.abs(spatial_difference[0])+1) 
                    ) continue;
                    

                    let spatialPosition : og.Vector = [spatialMin[0]+x,spatialMin[1]+y,spatialMin[2]+z]
                    let block = surface.getBlockAtPosition(spatialPosition)
                    if(!block || block.name === "Air") continue;
                    
                    let neighbours : og.Vector[] = [
                        [spatialPosition[0]+1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0]-1,spatialPosition[1],spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]+1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1]-1,spatialPosition[2]],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]+1],
                        [spatialPosition[0],spatialPosition[1],spatialPosition[2]-1]
                    ]

                    let foundBlock = false
                    
                    for (let i = 0; i < neighbours.length; i++) {
                        const neighbourPosition : og.Vector = neighbours[i];
                        let neighbourBlock = surface.getBlockAtPosition(neighbourPosition)
                        if(!neighbourBlock || neighbourBlock.name !== "Air") continue;
                        foundBlock = true
                    }

                    if(!foundBlock) continue;

                    bricks.push({
                        asset_name_index: 0,
                        visibility: block.visibility,
                        owner_index: surface.owner_index+1,
                        size: [surface.block_size[0]/2,surface.block_size[1]/2,surface.block_size[2]/2],
                        position: surface.spatialToWorld([spatialPosition[0],spatialPosition[1],spatialPosition[2]]),
                        material_index: block.material_index,
                        material_intensity: block.material_intensity,
                        components: block.components,
                        color: block.color
                    })
                }
            }
        }
        //Load the Bricks.
        if(bricks.length === 0) {
            Omegga.clearRegion({center : worldMidpoint, extent : worldExtent})
            return;
        }

        let save : og.WriteSaveObject = {
            ...this.writeSaveObjectStandard,
            bricks:bricks
        };
        
        await OmeggaImprovements.bakeSaveData(save).then((fileName)=>{
            
            Omegga.writeln(
                `Bricks.ClearRegion ${worldMidpoint.join(' ')} ${worldExtent.join(' ')} ${save.brick_owners[surface.owner_index].id}`
              );
            OmeggaImprovements.loadBricks(fileName, options).then
                (()=>OmeggaImprovements.removeSaveFile(fileName))
        })
    }


    public static spatial2ArrayFunction(position: og.Vector, spatial : Surface) : number {
        let chunkSize = spatial.chunk_size
        let [x,y,z] = [position[0],position[1],position[2]]

        if(x < 0 || chunkSize[0] < x) throw new RangeError(`Argument 'x' can only be within range 0 and ${chunkSize[0]}, as set by the spatial provided.`);
        if(y < 0 || chunkSize[1] < y) throw new RangeError(`Argument 'y' can only be within range 0 and ${chunkSize[1]}, as set by the spatial provided.`);
        if(z < 0 || chunkSize[2] < z) throw new RangeError(`Argument 'z' can only be within range 0 and ${chunkSize[2]}, as set by the spatial provided.`);

        return x + y*chunkSize[1] + z*(chunkSize[2]**2)
    }

    public static array2SpatialFunction(index : number, spatial : Surface) : og.Vector {
        let chunkSize = spatial.chunk_size

        if(index < 0 || chunkSize[0]*chunkSize[1]*chunkSize[2] < index) throw new RangeError(`Argument 'index' can only be within range 0 and ${chunkSize[0]*chunkSize[1]*chunkSize[2]-1}, as set by the spatial provided. Argument provided: ${index}`);

        let x = (index%chunkSize[0])
        let y = (Math.floor(index/chunkSize[1])%chunkSize[1])
        let z = (Math.floor(index/(chunkSize[2]**2)))

        return [x,y,z]
    }
}
