Inside the folders of each data type, you'll notice some files are split, 
this is for organizational reasons and has no impact on how they are loaded.

Block files are responsible for physical representation when loaded into the world, as well as how they generate for various surfaces.
    *Blocks which are layers usually don't have components because they are guaranteed to generate and therefore extremely numerous if not careful.

Item files are responsible for tracking data related to player inventories and tools.

Structure files are responsible for storing block types in a 3D array, with optional masking. 
    *Only apply masking if the structure is unbreakable.