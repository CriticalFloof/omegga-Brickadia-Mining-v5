import { Spatial } from 'src/game_behavior_core/world/surface';
import * as og from 'omegga';

export default class Raycast{
    public static getVectorAtDistance(start_point : og.Vector, rotation_deg : og.Vector, distance : number){

        let rotation_rad = [
            rotation_deg[0] * (Math.PI/180),
            rotation_deg[1] * (Math.PI/180),
            rotation_deg[2] * (Math.PI/180)
        ]
        
        let vectorNormal = [
            Math.cos(rotation_rad[1])*Math.cos(rotation_rad[0]),
            Math.sin(rotation_rad[1])*Math.cos(rotation_rad[0]),
            Math.sin(rotation_rad[0])
        ]
        
        let resultPosition : og.Vector = [
            vectorNormal[0]*distance+start_point[0],
            vectorNormal[1]*distance+start_point[1],
            vectorNormal[2]*distance+start_point[2]
        ]
        return resultPosition  
        
    }

    public static getRaycastPositions(start_point : og.Vector, rotation_deg : og.Vector, distance : number, step : number){
        //Step approach
        if(1 > step) throw RangeError("step cannot be less than 1")
        let resultPositions : og.Vector[] = []
        
        for (let i = 0; i < step; i++) {
            let stepInverse = (i+1)/step
            resultPositions[i] = this.getVectorAtDistance(start_point, rotation_deg, Math.floor(stepInverse*distance))
            
        }
        return resultPositions 
    }

    public static spatialDDARaycast(start_point_parameter : og.Vector, rotation_deg : og.Vector, max_distance : number, spatial: Spatial){

        const maxBlockSize = Math.max(...spatial.block_size)
        
        let start_point = [
            (start_point_parameter[0])%spatial.block_size[0]/spatial.block_size[0],
            (start_point_parameter[1])%spatial.block_size[1]/spatial.block_size[1],
            (start_point_parameter[2])%spatial.block_size[2]/spatial.block_size[2]
        ]
        let mapCheck : og.Vector = [
            Math.floor(start_point[0]),
            Math.floor(start_point[1]),
            Math.floor(start_point[2])
        ]
        //DDA implementation
        const rotation_rad = [
            rotation_deg[0] * (Math.PI/180),
            rotation_deg[1] * (Math.PI/180),
            rotation_deg[2] * (Math.PI/180)
        ]
        
        const rayDirection = [
            (Math.cos(rotation_rad[1])*Math.cos(rotation_rad[0]))/spatial.block_size[0]/maxBlockSize,
            (Math.sin(rotation_rad[1])*Math.cos(rotation_rad[0]))/spatial.block_size[1]/maxBlockSize,
            (Math.sin(rotation_rad[0])/spatial.block_size[2]/maxBlockSize)
        ]


        let RayLength1D : og.Vector = [0,0,0]
        const rayUnitStepSize = [
            Math.abs(Math.sqrt(1 + (rayDirection[1]/rayDirection[0])**2 + (rayDirection[2]/rayDirection[0])**2)),
            Math.abs(Math.sqrt((rayDirection[0]/rayDirection[1])**2 + 1 + (rayDirection[2]/rayDirection[1])**2)),
            Math.abs(Math.sqrt((rayDirection[0]/rayDirection[2])**2 + (rayDirection[1]/rayDirection[2])**2 + 1))
        ]

        if(Number.isNaN(rayUnitStepSize[0])) rayUnitStepSize[0] = Infinity
        if(Number.isNaN(rayUnitStepSize[1])) rayUnitStepSize[1] = Infinity
        if(Number.isNaN(rayUnitStepSize[2])) rayUnitStepSize[2] = Infinity

        let step : og.Vector = [0,0,0]

        if(rayDirection[0] < 0) {
            step[0] = -1;
            RayLength1D[0] = (start_point[0] - mapCheck[0]) * rayUnitStepSize[0]
        } else {
            step[0] = 1;
            RayLength1D[0] = (mapCheck[0] + 1 - start_point[0]) * rayUnitStepSize[0]
        }

        if(rayDirection[1] < 0) {
            step[1] = -1;
            RayLength1D[1] = (start_point[1] - mapCheck[1]) * rayUnitStepSize[1]
        } else {
            step[1] = 1;
            RayLength1D[1] = (mapCheck[1] + 1 - start_point[1]) * rayUnitStepSize[1]
        }

        if(rayDirection[2] < 0) {
            step[2] = -1;
            RayLength1D[2] = (start_point[2] - mapCheck[2]) * rayUnitStepSize[2]
        } else {
            step[2] = 1;
            RayLength1D[2] = (mapCheck[2] + 1 - start_point[2]) * rayUnitStepSize[2]
        }

        let distance = 0
        let positionArray : og.Vector[] = []

        while(distance < max_distance){

            positionArray.push([
                mapCheck[0]*spatial.block_size[0]+spatial.block_size[0]/2+Math.trunc(start_point_parameter[0]/spatial.block_size[0])*spatial.block_size[0],
                mapCheck[1]*spatial.block_size[1]+spatial.block_size[1]/2+Math.trunc(start_point_parameter[1]/spatial.block_size[1])*spatial.block_size[1],
                mapCheck[2]*spatial.block_size[2]+spatial.block_size[2]/2+Math.trunc(start_point_parameter[2]/spatial.block_size[2])*spatial.block_size[2]
            ])
            
            let minLength = Math.min(RayLength1D[0],RayLength1D[1],RayLength1D[2])
            if(minLength === RayLength1D[0]){
                mapCheck[0] += step[0]
                distance = RayLength1D[0]
                RayLength1D[0] += rayUnitStepSize[0]
            } else if(minLength === RayLength1D[1]) {
                mapCheck[1] += step[1]
                distance = RayLength1D[1]
                RayLength1D[1] += rayUnitStepSize[1]
            } else {
                mapCheck[2] += step[2]
                distance = RayLength1D[2]
                RayLength1D[2] += rayUnitStepSize[2]
            }

        }
        return positionArray
        
    }

} 