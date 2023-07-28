//These functions are meant to be referenced by './data/startup/scriptFunctions' files

export function inputGuard(parameterObject:{[key:string]:any}, ...wantedParameters: string[]){
    if(!parameterObject) throw new Error('parameters object was not provided.')
    for (let i = 0; i < wantedParameters.length; i++) {
        const wantedParameter = wantedParameters[i];
        if(parameterObject[wantedParameter] == undefined) throw new Error(`parameter '${wantedParameter}' was not provided in parameters object.`)
    }
}