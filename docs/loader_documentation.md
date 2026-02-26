Loader Documentation
=========

# TGXMLoader

TGXMLoader is a Three.js loader for Bungie.net API 3D models. It supports Destiny and Destiny 2. 

## Import

To use TGXMLoader, you need to import the class from the package:
```  
import { TGXMLoader } from "tgxm-loader"  
```

## Methods

### Constructor(config)

A loader instance is created using the constructor with a configuration object:

```
new TGXMLoader(config)
```

#### Arguments 

- `config` (`object`) — supports a variety of options. If a passed configuration option is invalid, the constructor **will throw an error.**

> Following two pairs of options share similar source options, so they will be described here:

  - **`source: "none"` [*default*]** 

    Loader will not be able to load item definitions and create 3D models.
    ```
    <option>: {
        source: "none"
    }  
    ```
  - **`source: "syncHandler"`** 

    Requires a function to be provided under `syncHandler` property. The only argument is item hash. If functions succeeds it should return `DestinyInventoryDefinition` or throw error.

    Example: 
    ```
    <option>: {
        source: "syncHandler",
        syncHandler: (itemHash) => {
            // obtaining inventory definition
            // ....
            if (ok)
                return DestinyInventoryItemDefinition;
            else
                throw new Error("An error occurred");
        }
    }
    ```

  - **`source: "asyncHandler"`** 

    This option is similar to **`syncHandler`** but requires an async function to be provided under `asyncHandler` property as it will be called with `await`.

    Example: 
    ```
    <option>: {
        source: "asyncHandler",
        asyncHandler: async (itemHash) => {
            // some async operations
            // ....
            if (ok)
                return DestinyInventoryItemDefinition;
            else
                throw new Error("An error occurred");
        }
    }
    ```

**List of options:**

> **Important** Following settings are required. For Destiny 2 items required options are `Destiny2GearAssetDefinition` and `Destiny2InventoryDefinition`, for original Destiny items required options are `DestinyGearAssetDefinition` and `DestinyInventoryDefinition`. Without them loader will not be able to load 3D models.

- **`Destiny2InventoryDefinition`** and **`DestinyInventoryDefinition`** (`object`) — define how loader will get `DestinyInventoryItemDefinition` for Destiny 2 and original Destiny respectively.

  - **`source: "none"` [*default*]** 

  - **`source: "syncHandler"`** 

  - **`source: "asyncHandler"`** 

- **`Destiny2GearAssetDefinition`** and **`DestinyGearAssetDefinition`** (`object`) — define how loader will get `GearAssetDefinitions` for Destiny 2 and original Destiny respectively. 

  - **`source: "none"` [*default*]** 

  - **`source: "syncHandler"`** 

  - **`source: "asyncHandler"`** 

> **NOTE:** Following settings are not required for every usage case.

- **`shaders`** (`object`) — defines shader files source. 

  *This setting only needs to be configured if shaders will be applied to the models.*

  Possible values:

  - **`source: "none"` [*default*]**
 
    Loader will not be able to load shaders.
    ```
    shaders: {
        source: "none"
    }  
    ```
  - **`source: "api"`**

    If this option is selected, the loader will utilize options `Destiny2InventoryDefinition` and `Destiny2GearAssetDefinition` to get shader description and will download shader's asset files from Bungie.net API.

    ```
    shaders: {
        source: "api"
    }
    ```

- **`iridescenceLookupPath`** (`string`, **`required for proper materials display`**) — URL to iridescence lookup texture, essential for Destiny 2 materials proper display.

- **`specularTintPath`** (`string`, **`required for proper materials display`**) — URL to specular tint lookup texture, essential for Destiny 1 materials proper display.

- **`specularLobePath`** (`string`, **`required for proper materials display`**) — URL to specular lobe lookup texture, essential for Destiny 1 materials proper display.

- **`cubemapPaths`** (`Array<string>`, **`required for proper materials display`**) — Array of URLs to cubemap texture parts (512x512 px), essential for Destiny 1 materials proper display.
- **`lod`** (`0|1|2|3`, default: **`0`**) — Level of Detail to be used, a number from 0 (most detailed) to 3 (least detailed). Can be used to improve performance at a cost of quality.

    This option can be overridden for certain model by model-specific config.
    
- **`allowedRenderStages`** (`Array<number>`, default: **`[0, 1, 2, 6, 7]`**) — defines which parts of models to render, for more see: [3D Content Documentation. Render Stages](https://github.com/Bungie-net/api/wiki/3D-Content-Documentation#render-stages). This option is array of numbers.

  *Default value*: **`[0, 1, 2, 6, 7]`**
 
  - 0 — opaque geometry — most of non-transparent geometry
  - 1 — decals — regular decals
  - 2 — investment decals
  - 6 — additive decals
  - 7 — transparents

  Excluding `7` from the array (`[0, 1, 2, 6]`) will result in transparent parts being not included in 3D model and hence not rendered.

  This option can be overridden for certain model by model-specific config.

#### Example
```
try 
{
    const loader = new TGXMLoader(
        {
            Destiny2InventoryDefinition: {
                source: "syncHandler",
                syncHandler: (hash) => /* return DestinyInventoryDefinition  */
            },
            Destiny2GearAssetDefinition: {
                source: "syncHandler",
                syncHandler: (hash) => /* return GearAssetDefinition object here */
            },
            shaders: {
                souce: "api"
            },
            lod: 1
        }
    );
}
catch (err)
{
    console.log("An error has occurred:", err);
}
```

### async load(config, onProgress)

This method loads a 3D model specified in options.

#### Arguments

- `config` (`object`) — configuration object, includes a variety of options.

  **List of options:**

  - **`itemHash`** (`number|string`, **`required`**) — item hash found in `DestinyInventoryItemDefinition`.
  - **`game`** (`"destiny"|"destiny2"`, **`required`**) — the game the object is loaded for.
  - **`container`** (`TGXModelContainer|undefined`, default: **`undefined`**) — if no container provided loader will internally create a new one. If container is provided and it matches `itemId` internally constructed from **`itemHash`** and **`game`**, the model will be brought to the state defined by the `config` object.
  - **`skeleton`** (`THREE.Skeleton|null`, default: **`null`**) — skeleton that will be bound to 3D model. If value is `null` model will not be able to play animations. Skeleton can be loaded by `.loadSkeleton("guardian")` method. Currently only armor, hands and neck items can be used with skeleton.
  - **`shaderHash`** (`number|string|null`, default: **`null`**) — if not `null`, hash of a shader to be applied to the model.
  - **`isFemale`** (`boolean`, default: **`false`**) — if set to `true` armor pieces will use female body type. Other items are not affected by this setting.
  - **`useTrialsMetalness`** (`boolean`, default: **`false`**) — if set to `true` items will use Trials of Osiris metallic color specified by **`trialsColor`** option. 

    > **Important** It is recommended to use this only on items from Trials of Osiris, as using it on other items may result in unpredictable appearance. Works only for Destiny 2 items.
  - **`useTrialsGlow`** (`boolean`, default: **`false`**) — if set to `true` Trials of Osiris symmbols will glow in the color indicated in the **`trialsColor`** option. 
 
    > **Important** This option will take effect only if **`useTrialsMetalness`** is set to `true`.
  - **`trialsColor`** (`"gold"|"red"|"silver"`, default: **`"gold"`**) — color of glow for Trials of Osiris items.
    > **Important** This option will take effect only if **`useTrialsMetalness`** is set to `true`.
  - **`regionIndexOptions`** (`object`, default: **`{}`**) — specifies which variant should be loaded for specific region. Useful if there is a need to switch scopes/magazine options.

    Structure:
    ```
    regionIndexOptions: {
       [regionIndex<0>: number]: region<0>Option<M>: number
       .....
       [regionIndex<N>: number]: region<N>Option<K>: number
    }
    ```

    Example:
    ```
    {
        3: 4, // region 3 is for scope, 4th option
        17: 4, // region 17 is rear sights, 4 option to match scope
    }
    ```
  - **`lod`** (`0|1|2|3`, default: same value passed during loader creation) — Level of Detail to be used, a number from 0 (the most detailed) to 3 (the least detailed). Can be used to improve performance at a cost of quality.

    This option allows to override global **`lod`** value specified during loader creation, for this specific model.
  - **`allowedRenderStages`** (`Array<number>`, default: same value passed during loader creation) — defines which parts of models to render, for more see: [3D Content Documentation. Render Stages](https://github.com/Bungie-net/api/wiki/3D-Content-Documentation#render-stages).

    This option allows to override global **`allowedRenderStages`** value specified during loader creation, for this specific model.

- `onProgress` — progress callback function. Provides simple progress state.

  Signature:

  ```
  function (
      {
          loaded: number, 
          total: number, 
          text: string
      }
  )
  ```

#### Return value

`Promise<TGXModelContainer>` — `Promise` with model container if the loading process is successfull otherwise method will throw an `Error`.

#### Example

```
try
{
    const modelContainer = loader.load(
      {
          itemHash: 53126580, // Peacekeepers
          game: "destiny2",
          shaderHash: 2653012761, // Superblack
          isFemale: true,
          lod: 1,
          allowedRenderStages: [0] // only opaque geometry
        }
    );

    scene.add(modelContainer.groupObject);
}
catch (err)
{
    console.log("An error has occurred:", err);
}
```

### dispose(id)

This method can be used for two purposes:
1. If id is provided frees shared resources associated with certain `itemId`.
2. If no id is provided free all the resources when loader is no longer needed.

#### Arguments

**`id`** (`string|null`, default: **`null`**)

#### Return value

Returns nothing.

### reset()

This method is similar to `.dispose(null)`, but it will free shared resources for items where `game` == `"destiny"|"destiny2"`, but does not affect items where `game` == `global` (hands and neck container, as well as some internal resources). Essentially, this method clears the cache and allows you to start from scratch.

#### Arguments

Method has no arguments.

#### Return value

Returns nothing.

### async loadSkeleton(type)

This method constructs skeleton of specified type. Currently, only the player skeleton is supported.

#### Arguments

- **`type`** (`string|undefined`) — type of a skeleton to construct, currently only `"guardian"` option is supported.

#### Return value

If option `"guardian"` is provided, returns Promise with:

```
{
    skeleton: THREE.Skeleton, // skeleton to bind meshes to
    rootBone: THREE.Bone, // the root bone of the hierarchy
    boneNames: Array<string> // bone names where <boneIndex>: <boneName>
}
```

If there is an error during downloading process, method will throw an `Error`.

If no option is provided, returns `{}`.

### async loadAnimation(animationHash, animationFileName, boneNames)

This method loads animation data and creates animation clip.

> Note: method returns regular animation clip used by Three.js, hence it can be used with regular THREE.AnimationMixer.

#### Arguments

- **`animationHash`** (`number|string`, **`required`**) — item hash found in `DestinyInventoryItemDefinition`.
- **`animationFileName`** (`string`, **`required`**) — animation file name, can be found in `DestinyInventoryItemDefinition` for some Destiny 1 animations.
- **`boneNames`** (`Array<string>`, **`required`** ) — list of bone names returned by 
`.loadSkeleton("guardian")` method. 

#### Return value

`Promise<THREE.AnimationClip>` - `Promise` with animation clip if the loading process is successfull otherwise method will throw an `Error`.
 
# TGXModelContainer

A container that holds 3D model, its state and data about it.

## Properties

- **`itemId`** (`string`, **`readonly`**) — id of the item for which the 3D model was created. Has following format: `<game>:<itemhash>`, for example, for Peacekeepers it will be `destiny2:53126580`. **It is not unique per item instance.**

- **`groupObject`** (`THREE.Group`, **`readonly`**) — the 3D model itself, intended to be added to a `THREE.Scene`.

- **`isDisposed`** (`boolean`, **`readonly`**) — tells whether resources (textures, materials, etc.) used by this instance disposed.

## Methods

### dispose()

This method must be called after the current 3D model is no longer needed to free up the memory allocated for resources for that model. After this method is called `.isDisposed` property is set to `true` and this container must not be used.
