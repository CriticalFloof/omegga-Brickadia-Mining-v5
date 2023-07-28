import * as og from "omegga";
import { unlinkSync, writeFileSync } from 'fs';
import { join } from "path";
import writeBrs from "./brs-js_write";


  let _tempCounter = { save: 0, environment: 0 };
  let _tempSavePrefix = 'omegga_temp_';

export async function loadSaveData(
    saveData: og.WriteSaveObject,
    {
      offX = 0,
      offY = 0,
      offZ = 0,
      quiet = false,
      correctPalette = false,
      correctCustom = false
    } = {}
  ) {
    const saveFile =
      _tempSavePrefix + Date.now() + '_' + _tempCounter.save++;
    // write savedata to file
    writeSaveData(saveFile, saveData);

    // wait for the server to finish reading the save
    await Omegga.watchLogChunk(
      `Bricks.Load "${saveFile}" ${offX} ${offY} ${offZ} ${quiet ? 1 : 0} ${
        correctPalette ? 1 : 0
      } ${correctCustom ? 1 : 0}`,
      /^LogBrickSerializer: (.+)$/,
      {
        first: match => match[0].endsWith(saveFile + '.brs...'),
        last: match => Boolean(match[1].match(/Read .+ bricks/)),
        afterMatchDelay: 0,
        timeoutDelay: 30000,
      }
    );

    // delete the save file after we're done
    const savePath = Omegga.getSavePath(saveFile);
    if (savePath) {
      unlinkSync(savePath);
    }
}


export async function writeSaveData(saveName: string, saveData: og.WriteSaveObject) {
  if (typeof saveName !== 'string') throw 'expected name argument for writeSaveData';
  
  const file = join(Omegga.savePath, saveName + '.brs');
  if (!file.startsWith(Omegga.savePath)) throw 'save file not in Saved/Builds directory';

  let brsData = writeBrs(saveData); 
  let brsString = ""
  for (let i = 0; i < brsData.length; i++) {
    brsString += brsData[i]>15 ? brsData[i].toString(16) : `0${brsData[i].toString(16)}`
  }
  writeFileSync(file, Buffer.alloc(brsData.byteLength, brsString, 'hex'));
}