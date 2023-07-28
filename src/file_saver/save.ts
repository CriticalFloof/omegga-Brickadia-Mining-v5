import * as fs from "fs";
import * as fsp from "fs/promises";
import * as zlib from "zlib";
import * as og from "omegga";
import { pipeline } from "stream";
import { Game } from "src/game_behavior_core/core_handlers/game_handler";
import { Surface } from "src/game_behavior_core/world/surface";
import { Section } from "src/typescript_definitions/plugin";
import { promisify } from "util";
import { OmeggaHandler } from "src/game_behavior_core/core_handlers/omegga_handler";
import { performance } from "perf_hooks";
import OmeggaImprovements from "src/omegga_improvements";
import { BrickLoader } from "src/brick functions/brick_loader";
import { Player } from "src/game_behavior_core/player/player";

const pipe = promisify(pipeline);

export class SaveManager {
    public static savePath: string = "";

    private static isCurrentlySaving = false;
    private static isBuilt = false;

    constructor(game: Game) {
        SaveManager.savePath = `${game.pluginRootPath}/Saved`;
        SaveManager.isBuilt = true;
        SaveManager.saveGame(game);
    }

    public static async saveGame(game: Game): Promise<void | Error> {
        if (!this.isBuilt) return;
        if (this.isCurrentlySaving) return;
        this.isCurrentlySaving = true;
        //surfaces
        const surfacesPath = `${this.savePath}/Surfaces`;
        await fsp.mkdir(surfacesPath, { recursive: true });

        const surfacesAll = game.surfaceHandler.surfaces;
        const surfacesToBeSaved = game.surfaceHandler.surfacesModifiedSinceLastSave;

        const surfacesKeys = Object.keys(surfacesToBeSaved);
        for (let i = 0; i < surfacesKeys.length; i++) {
            const surface = surfacesAll[surfacesKeys[i]];
            this.saveSurface(surface, surfacesPath);
            this.saveSurfaceMask(surface.name);
        }
        game.surfaceHandler.surfacesModifiedSinceLastSave = {};
        //players
        const playersPath = `${this.savePath}/Players`;
        await fsp.mkdir(playersPath, { recursive: true });

        const playersAll = game.playerHandler.players;
        const playersToBeSaved = game.playerHandler.playersModifiedSinceLastSave;

        const playersKeys = Object.keys(playersToBeSaved);
        for (let i = 0; i < playersKeys.length; i++) {
            const player = playersAll[playersKeys[i]];
            this.savePlayer(player, `${playersPath}/${player.player_object.name}`);
        }
        game.playerHandler.playersModifiedSinceLastSave = {};

        //cleanup
        this.isCurrentlySaving = false;
    }

    private static async saveSurfaceMask(name: string) {
        const brickOwners = BrickLoader.writeSaveObjectStandard.brick_owners;
        for (let i = 0; i < brickOwners.length; i++) {
            const owner = brickOwners[i];
            if (owner.name === name) {
                Omegga.writeln(`Bricks.Save Mine-Test/Surfaces/${name} false ${owner.id}`);
            }
        }
    }

    private static async saveSurface(surface: Surface, filePath: string) {
        //surfaces are subfolders.
        const surfacePath = `${filePath}/${surface.name}`;
        await fsp.mkdir(surfacePath, { recursive: true });
        const sections = surface.sections;
        const sectionsToBeSaved = surface.sectionsModifiedSinceLastSave;
        const sectionsKeys = Object.keys(sectionsToBeSaved);
        for (let i = 0; i < sectionsKeys.length; i++) {
            const section = sections[sectionsKeys[i]];
            this.saveSection(section, `${surfacePath}/${sectionsKeys[i]}`);
        }
        surface.sectionsModifiedSinceLastSave = {};
    }

    private static async saveSection(section: Section, filePath: string) {
        //sections are saved as individual files.
        let fileContents = ``;

        fileContents += "structures{";
        const structureKeys = Object.keys(section.structures);
        for (let i = 0; i < structureKeys.length; i++) {
            //no saving structures yet.
        }
        fileContents += "}";

        fileContents += "chunks{";
        const chunkKeys = Object.keys(section.chunks);
        for (let i = 0; i < chunkKeys.length; i++) {
            const chunk = section.chunks[chunkKeys[i]];
            fileContents += `${chunkKeys[i]}{`;
            fileContents += "block_palette{";

            fileContents += chunk.block_palette.toString();

            fileContents += "}";
            fileContents += "block_data{";

            fileContents += chunk.block_data.toString();

            fileContents += "}";
            fileContents += "block_states{";

            const blockStateKeys = Object.keys(chunk.block_states);
            for (let j = 0; j < blockStateKeys.length; j++) {
                const state = chunk.block_states[blockStateKeys[j]];
                fileContents += `${blockStateKeys[j]}{`;
                if (state.health) fileContents += `health{${state.health}}`;
                fileContents += "}";
            }

            fileContents += "}";
            fileContents += "}";
        }
        fileContents += "}";

        await fsp.writeFile(`${filePath}.txt`, fileContents);
        //compression
        const gzip = zlib.createGzip();
        const source = fs.createReadStream(`${filePath}.txt`);
        const destination = fs.createWriteStream(`${filePath}.txt.gz`);
        await pipe(source, gzip, destination);
        await fsp.unlink(`${filePath}.txt`);
    }

    public static async savePlayer(player: Player, filePath: string) {
        await fsp.writeFile(`${filePath}.txt`, JSON.stringify(player, null, 2));
    }
}

export class LoadManager {
    public static async loadPlayer(name: string) {
        let filePath = SaveManager.savePath;
        if (!filePath) return;
        filePath += `/Players/${name}`;
        let fileContents;

        fileContents = await fsp.readFile(`${filePath}.txt`, { encoding: "utf-8" }).catch((err) => {
            if ((err.code = "ENOENT")) {
                console.log("player doesn't exist");
            }
            return;
        });

        let player_literal: Player = JSON.parse(fileContents);
        //Get an instance of omeggaplayer from the omegga player object literal
        player_literal.player_object = Omegga.getPlayer(player_literal.player_object.name);
        //Turn the object literal into an instance of player.
        let player = Player.from(player_literal);
        OmeggaHandler.game.playerHandler.players[name] = player;
    }

    public static async loadSurfaceMask(name: string) {
        OmeggaImprovements.loadBricks(`Mine-Test/Surfaces/${name}`);
    }

    public static async loadSurface(
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
        const t0 = performance.now();
        let filePath = SaveManager.savePath;
        if (!filePath) return;
        filePath += `/Surfaces/${name}`;

        let savedSections = await fsp.readdir(filePath);

        const t1 = performance.now();

        let sections: { [position: string]: Section } = {};
        for (let i = 0; i < savedSections.length; i++) {
            sections[savedSections[i].replace(".txt.gz", "")] = await this.loadSection(`${filePath}/${savedSections[i]}`);
        }

        OmeggaHandler.game.surfaceHandler.surfaces[name] = new Surface(name, properties);
        OmeggaHandler.game.surfaceHandler.surfaces[name].sections = sections;

        const t2 = performance.now();

        console.log(`${t1 - t0}ms | ${t2 - t1}ms `);
    }

    private static async loadSection(filePath: string): Promise<Section> {
        //uncompression
        const gunzip = zlib.createGunzip();
        const source = fs.createReadStream(`${filePath}`);
        const destination = fs.createWriteStream(`${filePath}.txt`);
        await pipe(source, gunzip, destination);

        let fileContents = (await fsp.readFile(`${filePath}.txt`, { encoding: "utf-8" }).catch((err) => {
            if ((err.code = "ENOENT")) {
                console.log("file doesn't exist");
            }
            return;
        })) as string;

        if (fileContents == null) {
            fileContents = "";
        }

        let objectTree: Section;

        let currentID = 0;
        let valueData = {};
        for (let x = 0; x < 256; x++) {
            const valueMatches = fileContents.match(/(?<={)[^{}]*(?=})/g);
            if (valueMatches == null) {
                buildLayer([fileContents]);
                objectTree = valueData[currentID];
                break;
            }
            buildLayer(valueMatches);
        }

        function buildLayer(stringsToSearch: string[] | RegExpMatchArray) {
            for (let i = 0; i < stringsToSearch.length; i++) {
                valueData[currentID + i] = stringsToSearch[i];

                const containsChildren = new RegExp(/<.*?>/, "g").test(stringsToSearch[i]);
                if (containsChildren) {
                    //String data contains an id reference to another set of data, therefore is a parent branch.
                    let object = {};
                    let identifiers = stringsToSearch[i].match(/[^>]+(?=<.*?>)/g);
                    let referenceIDs = stringsToSearch[i].match(/(?<=<).*?(?=>)/g);
                    for (let a = 0; a < identifiers.length; a++) {
                        const identifier = identifiers[a];
                        const referenceID = referenceIDs[a];
                        object[identifier] = valueData[referenceID];
                    }
                    valueData[currentID + i] = object; //Dereference the references stored here.
                } else {
                    //String data is a leaf node in the object tree.
                    //The type could either be a number, or an array
                    const uint8ArrayCompatible = new RegExp(/(?:\d+,)+\d+/).test(stringsToSearch[i]); //This regexp doesn't cover cases where values are over 255, it's unlikely that will happen anyway.
                    if (uint8ArrayCompatible) {
                        valueData[currentID + i] = new Uint8Array(stringsToSearch[i].split(",").map((val) => parseInt(val)));
                        continue;
                    }
                    const arrayCompatible = new RegExp(/(?:.+,)+.+/).test(stringsToSearch[i]);
                    if (arrayCompatible) {
                        valueData[currentID + i] = stringsToSearch[i].split(",");
                        continue;
                    }
                    if (!Number.isNaN(parseFloat(stringsToSearch[i]))) {
                        valueData[currentID + i] = parseFloat(stringsToSearch[i]);
                        continue;
                    }
                    if (stringsToSearch[i] === "") {
                        valueData[currentID + i] = {};
                        continue;
                    }
                }
            }
            fileContents = fileContents.replace(/{[^{}]*}/g, () => {
                currentID++;
                return `<${currentID - 1}>`;
            });
        }
        await fsp.unlink(`${filePath}.txt`);
        return objectTree;
    }
}
