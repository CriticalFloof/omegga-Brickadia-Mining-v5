import * as og from "omegga";
import { Surface } from "./surface";
import { TerrainGeneratorData } from "src/typescript_definitions/plugin";


export default class ChunkGenerator{

    public depthSortOreData: Array<TerrainGeneratorData & {name: string}> = []
    public depthSortLayerData: Array<TerrainGeneratorData & {name: string}> = []

    constructor(surface : Surface){
        const surfaceOreKeys = Object.keys(surface.ore_generator_data)
        for (let i = 0; i < surfaceOreKeys.length; i++) {
            const generatorList: TerrainGeneratorData[] = surface.ore_generator_data[surfaceOreKeys[i]]
            for (let j = 0; j < generatorList.length; j++) {
                const generatorData = generatorList[j];
                this.depthSortOreData.push({
                    ...generatorData,
                    name: surfaceOreKeys[i]
                })
            } 
        }
        this.depthSortOreData.sort((a, b) => a.depth - b.depth)

        const surfaceLayerKeys = Object.keys(surface.layer_generator_data)
        for (let i = 0; i < surfaceLayerKeys.length; i++) {
            const generatorList: TerrainGeneratorData[] = surface.layer_generator_data[surfaceLayerKeys[i]]
            for (let j = 0; j < generatorList.length; j++) {
                const generatorData = generatorList[j];
                this.depthSortLayerData.push({
                    ...generatorData,
                    name: surfaceLayerKeys[i]
                })
            } 
        }
        this.depthSortLayerData.sort((a, b) => a.depth - b.depth)
    }



    /**
     * Given a chunk position, generate it's corresponding terrain data and palette.
     * @param chunk_position 
     * @param surface
     * @param options safe: returns if generator attempts to overwrite existing chunks.
     */
    public generateNewChunk(chunk_position : og.Vector, surface : Surface, 
        options? : {
            safe? : boolean
        }
    ){
        if(!options) {
            options = {
                safe: true
            }
        }
        if(!("safe" in options)) options.safe = true

        try {
            this.allocateNewChunk(chunk_position, surface, options.safe)
        } catch (error) {
            return;
        }

        
        
        let sectionPosition = surface.chunkToSection(chunk_position)
        let relChunkPosition = surface.chunkToRelative(chunk_position)
        let chunk = surface.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`]
        
        chunk.block_palette = []

        const chunkSquared = surface.chunk_size[2]**2

        let localOreData: Array<TerrainGeneratorData & {name: string}> = []
        let localLayerData: Array<TerrainGeneratorData & {name: string}> = []
        let localOreKeys: string[] = []
        let localLayerKeys: string[] = []
        let generalAbundancy = 0
        let randWeightedOrePick = () => { return 0 }
        for (let i = 0; i < chunk.block_data.length; i++) {
            
            if(i % chunkSquared === 0) {
                let zDepth: number = (-(Math.floor(i/(chunkSquared))) + surface.chunk_size[2]) - (chunk_position[2]+1)*surface.chunk_size[2];
                let weightArray : number[] = []
                generalAbundancy = 0
                localOreData = []
                for (let j = 0; j < this.depthSortOreData.length; j++) {
                    if(this.depthSortOreData[j].depth-this.depthSortOreData[j].extent <= zDepth && this.depthSortOreData[j].depth+this.depthSortOreData[j].extent >= zDepth){
                        localOreData.push(this.depthSortOreData[j])
                        generalAbundancy += this.depthSortOreData[j].abundance
                        weightArray.push(this.depthSortOreData[j].abundance+(weightArray[weightArray.length-1] ? weightArray[weightArray.length-1] : 0))
                    }
                }
                randWeightedOrePick = () => {
                    let randomFloat = surface.prng.random()*generalAbundancy
                    let size = weightArray.length
                    let index = Math.floor(size/2)
                    while(size >= 1){
                        if(weightArray[index] > randomFloat && (weightArray[index-1] ? weightArray[index-1] : 0) <= randomFloat) {
                            return index
                        }
                        if(weightArray[index] > randomFloat) {
                            size = Math.ceil(size/2)
                            index -= Math.ceil(size/2)
                        } else if(weightArray[index-1] < randomFloat) {
                            size = Math.ceil(size/2)
                            index += Math.ceil(size/2)
                        }
                    }
                }
                localOreKeys = Object.keys(localOreData)

                localLayerData = []
                for (let j = 0; j < this.depthSortLayerData.length; j++) {
                    if(this.depthSortLayerData[j].depth > zDepth){
                        if(j == 0){
                            localLayerData.push(this.depthSortLayerData[j])
                        } else {
                            localLayerData.push(this.depthSortLayerData[j-1])
                        }
                    }
                }
                if(localLayerData.length === 0) localLayerData.push(this.depthSortLayerData[this.depthSortLayerData.length-1]);
                localLayerKeys = Object.keys(localLayerData)
            }
            

            let blockName: string;
            if(surface.prng.random() < generalAbundancy && localOreData.length > 0){
                // Assign a random non-base block based on depth
                let blockData: TerrainGeneratorData & {name: string} = localOreData[localOreKeys[randWeightedOrePick()]]
                blockName = blockData.name 
            } else {
                // Assign a base block based on depth
                let blockData: TerrainGeneratorData & {name: string} = localLayerData[localLayerKeys[0]]
                blockName = blockData.name
            }
            
            let blockFoundIndex: number = -1
            for (let i = 0; i < chunk.block_palette.length; i++) {
                const chunkElement = chunk.block_palette[i];
                if(chunkElement === blockName) {
                    blockFoundIndex = i;
                    break;
                }
            }
            if(blockFoundIndex === -1){
                console.log(`pushing ${blockName}`)
                chunk.block_palette.push(blockName)
                blockFoundIndex = chunk.block_palette.length
                chunk.block_palette[blockFoundIndex] = blockName
            }

            chunk.block_data[i] = blockFoundIndex;
        }
    }

    /**
     * Creates a chunk where data can be manipulated in the surface.
     * @param chunk_position 
     */
    private allocateNewChunk(chunk_position : og.Vector, surface : Surface, safe : boolean): void {
        if(safe){
            
        }
        let sectionPosition = surface.chunkToSection(chunk_position)
        let relChunkPosition = surface.chunkToRelative(chunk_position)
        if(!surface.sections[`${sectionPosition}`]) surface.addSection(sectionPosition);
        
        if(surface.sections[`${sectionPosition}`].chunks[`${relChunkPosition}`]) {
            if(safe){
                throw new Error("Attempted to overwrite existing chunks in safe mode.");
            } else {
                return;
            }
        }
        surface.addChunk(chunk_position)
        
    }

}