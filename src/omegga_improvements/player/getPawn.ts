    /// In the original codebase, whenever the watchLogChunk times out, it leads to an error. as you cannot read groups on undefined.
    /// Fixed by adding an undefined check.

export async function getPawn(controller): Promise<string | null> {
    // given a player controller, match the player's pawn
    const pawnRegExp = new RegExp(
      `^(?<index>\\d+)\\) BP_PlayerController_C .+?PersistentLevel\\.${controller}\\.Pawn = BP_FigureV2_C'.+?:PersistentLevel.(?<pawn>BP_FigureV2_C_\\d+)'`
    );

    // wait for the pawn watcher to return a pawn

    
    const [
      results
    ] = await Omegga.watchLogChunk<RegExpMatchArray>(
      'GetAll BP_PlayerController_C Pawn Name=' + controller,
      pawnRegExp,
      { first: 'index', timeoutDelay: 500 }
    );

    if(!results) return null; 

    return results.groups.pawn
  }