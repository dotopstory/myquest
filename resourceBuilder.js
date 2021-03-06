// TODO:
//  - Would be cool to adopt a transaction type system, where we only save all files at the very end (so that we don't save an asset when something ends up crashing the builder later)
//  - Avoid reading raw asset twice (once for hash, once for cache)
//  - Remove stale resource files (those which are no longer referenced)


const requirejs = require('requirejs');
requirejs.config({
    nodeRequire: require,
    baseUrl: __dirname,
    paths: {
        lodash: "https://cdn.jsdelivr.net/lodash/4.14.1/lodash.min.js"
    }
});

const util          = require('util'),
    _               = require('lodash'),
    fs              = require('fs'),        // TODO: Promisify this
    path            = require('path'),
    Promise         = require('bluebird'),
    chalk           = require('chalk'),
    prettyjson      = require('prettyjson'),
    assert          = require('assert'),    // TODO: Disable in production
    crypto          = require('crypto'),
    openpgp         = require('openpgp'),
    exec            = require('child_process').exec,
    execSync        = require('child_process').execSync,
    xml2js          = require('xml2js');


const Settings = {
    forceRebuild: false,
    checkNeedsRebuild: false,
    verbose: false
}

// Process Server arguments
for (let i=0; i<process.argv.length; ++i) {

    const arg = process.argv[i];

    if (arg === "--force-rebuild") {
        console.log("Recaching all resources");
        Settings.forceRebuild = true;
    }

    if (arg === "--needs-rebuild") {
        console.log("Checking if resources need rebuilding");
        Settings.checkNeedsRebuild = true;
    }

    if (arg === "--package") {
        const filterPackage = process.argv[++i];
        console.log(`Filtering package: "${filterPackage}"`);
        Settings.filterPackage = filterPackage;
    }

    if (arg === "--asset") {
        const filterAsset = process.argv[++i];
        console.log(`Filtering asset: "${filterAsset}"`);
        Settings.filterAsset = filterAsset;
    }

    if (arg === "--verbose") {
        Settings.verbose = true;
    }
}

if (Settings.filterAsset && !Settings.filterPackage) {
    console.error("Attempting to filter by asset, but didn't specifiy --package to filter");
    process.exit(1);
}

// Prepare openpgp stuff
openpgp.initWorker({ path: 'node_modules/openpgp/dist/openpgp.worker.js' }) // set the relative web worker path
openpgp.config.aead_protect = true // activate fast AES-GCM mode (not yet OpenPGP standard)

// TODO: Need a way to read from all resources, and handle similarly
//
//  - resources, sheets, icons, sounds, maps
//  - need a list of raw resources and their hashes
//  - go through each resource to see if hash different
//  - if hash is different then mark asset in some way
//  - go through marked asssets, process accordingly (need a way to classify assets so we know how to process them -- sheets w/ options (encrypt?), data (validate?), maps, sounds, images)
//  - update asset hashes along the way
//  - for all marked assets, update their parent package (sounds.json, resources.json, world.json, etc.)
//  - NOTE: Need ordering to be available (resources.json last!)
//  - Need an easy way to skip processing and only find changed assets (for --check-needs-rebuild)
//  - Need an easy way to limit search to specific package (resources.json, sounds.json, etc.) in case this comes from Gruntfile/watch
//  - Need an easy way to limit to specific asset in case this comes from Gruntfile/watch again
//
//
//   - Single package: read through resources and only add the specified package asset; add that package
//   - Single resource: go through all packages to find asset, and only add the package/asset that matches the specified resource file
//   - Resources should be the top most package, other packages are under that
//      Resources:
//          - sheets, avatars, npcs, world, items, buffs, interactables, quests, interactions, scripts, ...
//
//      Resources: {
//        file: resources.json
//        type: data
//        rawHash: asdf
//        processedhash: kljf
//        options: { validate: true },
//        data: ....
//
//        assets: [{
//          file: sheets.json
//          type: data
//          rawHash: 123abc
//          processedHash: abc123
//          options: { validate: true },
//          data: ....   (specific to data only -- store JSON)
//
//          assets: [
//            {
//              file: sprite.png
//              type, rawhash, processedHash, options: { encrypt: true }
//            }
//          ]
//        }, ....]
//      }
//
//
// -- get rid of areahashes and just use world.json for hash (would need 2 types of hashes stored here)
// 8) Filter asset if necessary (specified package or resource) --- if we update an asset does that mean we'll always update the package? If so then we should only filter packages in Grunt. Can Grunt listen for changes and wait X seconds before recompiling? (exceptions: npcs.json or other pure data files?), could store a list of files that have changed and pass them all into here
//      - what if we have nested packages, and change one of those packages -- might need a delay?
//      - delay: what if we change a package (automated) and continue processing w/ intention of changing another package or the same one again -- delay is dependent on that process finishing
//      - we could ONLY watch certain packages, and expect other packages (eg. sheets) to rebuild via exporter -- but what if we touch it manually?
//      - some files we want to reload immediately (eg. npcs, buffs, testing)
//
//      -- Watch/Rebuild immediately: list of packages (npcs, buffs, etc.)
//      -- Watch/Rebuild after delay (careful w/ delay time): list of packages (sheets, media, avatars, world)
// 10) Integrate w/ Grunt & Server
//      - Grunt: Watch Resource packages; list of those w/ rebuild delay/immediate
//      - Grunt: Rebuild when necessary -- read exit code for indicator of failure
//      - Server: --needs-rebuild  ; read exit code to determine, then exit if needed
// -- move this to tools/
// -- nicer output (colours n shiz)
// -- clean this file up
// -- get rid of references to old caching system in js
// -- hash -> processedHash; rawHash -> hash
// -- get rid of cache.json

let Resources = null;

const packageRoutines = {
    "resources": {
        "prepare": (data) => {},
        "read": (data) => {
            const assets = [];

            _.forEach(data, (packageDetails, packageName) => {

                const package = {
                    name: packageName,
                    file: 'resources/data/' + packageDetails.file,
                    output: 'dist/resources/data/' + packageDetails.file,
                    type: "data",
                    rawHash: packageDetails.rawHash,
                    processedHash: packageDetails.hash,
                    options: packageDetails.options
                };

                if (Settings.filterPackage) {
                    package.skipProcess = (Settings.filterPackage !== packageName);
                }

                assets.push(package);
            });

            return assets;
        },
        "validate": (data) => {
            // FIXME: Validate the data
            return true;
        },
        "updateAsset": (data, assetName, asset) => {
            data[assetName].hash = asset.processedHash;
            data[assetName].rawHash = asset.hash;
        },
        "finalize": (package) => { }
    },

    "media": {
        "prepare": (data) => {},
        "read": (data) => {
            const assets = [];
            data.list.forEach((assetDetails) => {
                assets.push({
                    name: assetDetails.name,
                    file: 'resources/' + assetDetails.file,
                    output: 'dist/resources/' + assetDetails.output,
                    type: assetDetails.type,
                    rawHash: assetDetails.rawHash,
                    processedHash: assetDetails.hash,
                    options: assetDetails.options
                });
            });

            return assets;
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {
            console.log(`Updating an asset in media: ${assetName}`);

            let media = data.list.find((media) => media.name === assetName);
            media.hash = asset.processedHash;
            media.rawHash = asset.hash;
        },
        "finalize": (package) => { }
    },
	"sheets": {
        "prepare": (data) => {

            // Find all tilesheets that have some sprites which need to be extracted into a separate, autogenerated
            // sheet. Update these autogenerated sheets

            const generatedSheets = {};
            data.tilesheets.list.forEach((sheet) => {

                // Find all sheets w/ sprites to be extracted
                if (sheet.data.extractGroups && Object.keys(sheet.data.extractGroups).length > 0) {
                    _.forEach(sheet.data.extractGroups, (extractGroup, groupId) => {
                        const sheetId = extractGroup.sheetId,
                            extractSprites = [];

                        // Find all sprites belonging to this group
                        _.forEach(sheet.data.extracts, (spriteGroup, sprite) => {
                            if (spriteGroup === groupId) extractSprites.push(parseInt(sprite, 10));
                        });

                        // Create generated sheet if doesn't exist yet. Don't worry if it does exist, we'll just mark it
                        // as exists when we come across the generated asset
                        if (!generatedSheets[sheetId]) {
                            generatedSheets[sheetId] = {
                                exists: false,
                                list: null,
                                currentList: []
                            }
                        }

                        const generatedSheet = generatedSheets[sheetId];
                        generatedSheet.currentList.push({
                            assetId: sheet.id,
                            asset: sheet,
                            sprites: extractSprites
                        });
                    });
                }

                // Auto generated sheet
                if (sheet.generated) {

                    if (!generatedSheets[sheet.id]) {
                        generatedSheets[sheet.id] = {
                            currentList: null
                        };
                    }

                    const generatedSheet = generatedSheets[sheet.id];
                    generatedSheet.exists = true;
                    generatedSheet.list = sheet.dependencies;
                    generatedSheet.sprites = sheet.sprites;
                    generatedSheet.dirty = sheet.dirty;
                    generatedSheet.columns = sheet.columns;
                    generatedSheet.rows = sheet.rows;

                    // Image dependencies are separate from extraction groups, but still go on the currentList
                    sheet.dependencies.forEach((dep) => {
                        if (dep.imageSrc) {
                            if (!generatedSheet.currentList) generatedSheet.currentList = [];
                            generatedSheet.currentList.push(dep);
                        }
                    });
                }
            });

            // Mark generated sheets as dirty if lists differ
            _.forEach(generatedSheets, (sheet, sheetId) => {

                if (!sheet.dirty && sheet.list && sheet.currentList && (sheet.currentList.length === sheet.list.length)) {
                    for (let i = 0; i < sheet.currentList.length; ++i) {


                        const item = sheet.currentList[i];
                        if (item.imageSrc) {
                            // Image dependency
                            // Has the image changed?
                            const imageSrcHash = item.imageSrcHash; // FIXME
                            if (imageSrcHash !== item.imageSrcHash) {
                                sheet.dirty = true;
                            }
                        } else {
                            // Extraction group
                            // Have any of the assets changed amongst this group?
                            const newAsset = item,
                                oldAsset   = sheet.list.find((a) => a.assetId === newAsset.assetId);

                            if (!oldAsset || !_.isEqual(newAsset.sprites, oldAsset.sprites)) {
                                sheet.dirty = true;
                                break;
                            }
                        }
                    }
                } else {
                    sheet.dirty = true;
                }

                if (sheet.dirty) {
                    if (sheet.exists) {
                        const tilesheet = data.tilesheets.list.find((tilesheet) => tilesheet.id === sheetId);
                        tilesheet.dirty = true;
                        tilesheet.newDependencies = sheet.currentList;
                        tilesheet.sprites = sheet.sprites;

                        // This may be an image-based dep generated tilesheet, so already exists but output wasn't setup
                        if (!tilesheet.output) {
                            tilesheet.output = `sprites/${sheetId}.png`;
                        }

                    } else {
                        data.tilesheets.list.push({
                            id: sheetId,
                            generated: true,
                            output: `sprites/${sheetId}.png`,
                            options: {
                                cached: false,
                                encrypted: false,
                                packed: false,
                                preprocess: false
                            },
                            data: {},
                            gid: {        // FIXME:
                                first: 0,
                                last: 0
                            },
                            dirty: true,
                            dependencies: null,
                            newDependencies: sheet.currentList,
                            sprites: [],
                            tilesize: 16, // FIXME: hardcoded tilesize
                            sheet_offset: { x: 0, y: 0 }
                        });
                    }
                }
            });
        },
        "read": (data) => {
            const assets = [],
                generatedAssets = [];
            data.tilesheets.list.forEach((sheet) => {

                // Generated sheets to be added last
                if (sheet.generated) {
                    generatedAssets.push({
                        name: sheet.id,
                        type: "generatedTilesheet",
                        generated: true,
                        dirty: sheet.dirty,
                        options: sheet.options,
                        output: 'dist/resources/' + sheet.output,
                        dependencies: sheet.dependencies,
                        newDependencies: sheet.newDependencies,
                        oldSprites: sheet.oldSprites,
                        sprites: sheet.sprites,
                        spriteGroups: sheet.spriteGroups,
                        tilesize: sheet.tilesize,
                        sheetType: 'generatedTilesheet',
                        columns: sheet.columns,
                        rows: sheet.rows,
                        data: sheet.data
                    });

                    return;
                }

                assets.push({
                    name: sheet.id,
                    type: "image",
                    file: 'resources/' + sheet.image,
                    rawHash: sheet.rawHash,
                    processedHash: sheet.hash,
                    options: sheet.options,
                    output: 'dist/resources/' + sheet.output,
                    sheetType: 'tilesheet'
                });
            });

            data.spritesheets.list.forEach((sheet) => {
                assets.push({
                    name: sheet.id,
                    type: "image",
                    file: 'resources/' + sheet.image,
                    rawHash: sheet.rawHash,
                    processedHash: sheet.hash,
                    options: sheet.options,
                    output: 'dist/resources/' + sheet.output,
                    sheetType: 'spritesheet'
                });
            });

            generatedAssets.forEach((generatedAsset) => {
                assets.push(generatedAsset);
            });

            return assets;
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {
            console.log(`Updating an asset in sheets: ${assetName}`);
            
            let list = null;
            if (asset.sheetType === 'tilesheet') {
                list = data.tilesheets.list;
            } else if (asset.sheetType === 'spritesheet') {
                list = data.spritesheets.list;
            } else if (asset.sheetType === 'generatedTilesheet') {
                list = data.tilesheets.list;

                const sheet = list.find((sheet) => sheet.id === assetName);
                sheet.dependencies = asset.dependencies;
                sheet.sprites = asset.sprites;
                sheet.columns = asset.columns;
                sheet.rows = asset.rows;
                sheet.spriteGroups = asset.spriteGroups;

                delete sheet.dirty;
                delete sheet.newDependencies;
                delete sheet.oldSprites;

                // NOTE: This part may not be necessary because we create spriteGroup again
                //sheet.spriteGroups.forEach((spriteGroup) => {
                //    if (spriteGroup.oldSpriteGroup) {
                //        delete spriteGroup.oldSpriteGroup;
                //    }
                //});

                if (sheet.sprites && sheet.sprites.length === 0) {
                    delete sheet.sprites;
                }

                return;
            } else {
                console.error("Unexpected sheetType! " + asset.sheetType);
            }

            let sheet = list.find((sheet) => sheet.id === assetName);
            sheet.hash = asset.processedHash;
            sheet.rawHash = asset.hash;
        },
        "finalize": (package) => {

            // Update GID for tilesheets
            let gidCursor = 0;
            package.data.tilesheets.list.forEach((tilesheet) => {
                const totalTiles = parseInt(tilesheet.rows, 10) * parseInt(tilesheet.columns, 10);
                tilesheet.gid.first = gidCursor;
                gidCursor += totalTiles - 1;
                tilesheet.gid.last = gidCursor;
                ++gidCursor;
            });
        }
    },
	"avatars": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
	"npcs": {
        "prepare": (data) => data,
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
	"world": {
        "prepare": (data) => {},
        "read": (data) => {
            const assets = [];
            _.forEach(data.areas, (assetDetails, assetID) => {
                assets.push({
                    name: assetID,
                    file: 'resources/' + assetDetails.file,
                    output: 'dist/resources/' + assetDetails.file,
                    type: "map",
                    rawHash: assetDetails.rawHash,
                    processedHash: assetDetails.hash
                });
            });

            return assets;
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {
            console.log(`Updating an asset in world: ${assetName}`);

            let area = data.areas[assetName];
            area.hash = asset.processedHash;
            area.rawHash = asset.hash;
        },
        "finalize": (package) => { }
    },
	"items": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
	"buffs": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
	"interactables": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "quests": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "interactions": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
	"scripts": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "components": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "rules": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "fx": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    },
    "testing": {
        "prepare": (data) => {},
        "read": (data) => {
            return {};
        },
        "validate": (data) => {
            return true;
        },
        "updateAsset": (data, assetName, asset) => {

        },
        "finalize": (package) => { }
    }
};

let fileHash = (file) => {
    let hash = execSync('cksum ' + file + ' | awk \'{printf \"%s\", $1}\' ');
    return hash.toString('utf8');
};

let readPackage = (package, file) => {
    return new Promise((success, fail) => {
        fs.readFile(file, (err, bufferData) => {

            if (err) {
                console.error(`Error reading package (${package}): ${err}`);
                fail(err);
                return;
            }

            const data         = JSON.parse(bufferData),
                packageRoutine = packageRoutines[package];

            packageRoutine.prepare(data);
            const assets = packageRoutine.read(data);

            success({data, assets});
        });
    });
};

// Load all resources and their list of assets
readPackage('resources', 'resources/data/resources.json').then((details) => {
    
    const { data, assets, hash } = details;

    const packages   = [],
        readPackages = [];

    assets.forEach((packageDetails) => {

        let readPackagePromise = new Promise((success, fail) => {
            readPackage(packageDetails.name, packageDetails.file).then((details) => {
                
                const { data, assets } = details;
                const package = {
                    name: packageDetails.name,
                    file: packageDetails.file,
                    output: packageDetails.output,
                    type: "data",
                    rawHash: packageDetails.rawHash,
                    processedHash: packageDetails.processedHash,
                    options: packageDetails.options,
                    data: data,
                    assets: assets
                }; 

                if (packageDetails.skipProcess) {
                    package.skipProcess = true;
                }

                packages.push(package);
                success();
            }).catch((e) => {
                console.error("There was an error reading a package from Resources");
                fail(e);
            });
        });

        readPackages.push(readPackagePromise);
    });

    Promise.all(readPackages).then(() => {
        Resources = {
            name: "resources",
            file: 'resources/data/resources.json',
            type: "data",
            processedHash: null,
            options: {},
            rawHash: hash,
            data: data,
            assets: packages
        };

        processResources(Resources).then(() => {
            console.log("Successfully saved packages");

            const output = 'dist/' + Resources.file;
            unlink(output);
            fs.copyFile(Resources.file, output, (err) => {

                if (err) {
                    console.error("Error copying package to output");
                    console.error(err);
                    process.exit(1);
                }

                fs.chmodSync(output, 0777);
                console.log("Saved resources to " + output);
            });
        }).catch((err) => {
            console.error("Error saving packages");
            process.exit(1);
        });
    }, () => {
        console.error("There was an error reading from Resources");
        process.exit(1);
    });
});


// Process the given resources/assets
// Any differing hashes will be processed to dist
let processResources = (package) => {
    return new Promise((success, fail) => {

        if (package.skipProcess) {
            success();
            return;
        }

        // Need to process assets in here?
        // This package may or may not contain assets (NOTE: It could be an asset itself without any assets yet).
        // FIXME: Confirm assets is an array (assert)
        let processingAssetsPromises = [];
        let updatedPackage = false;
        if (package.assets && package.assets.length) {
            package.assets.forEach((asset) => {

                let processAsset = () => {
                    return new Promise((success, fail) => {

                        // Process asset if the hash has changed
                        // NOTE: We need to get the hash here, in case we've changed the asset somewhere along the way to here
                        let rebuildAsset = false,
                            hash         = null,
                            distHash     = null;

                        // Is this asset being filtered out?
                        const assetFilteredOut = Settings.filterAsset && (Settings.filterAsset !== asset.name);

                        if (!assetFilteredOut) {
                            if (Settings.forceRebuild) {
                                console.log(`Asset to process: ${package.name}: ${asset.name}`);
                                rebuildAsset = true;
                            } else if (asset.generated) {

                                // Generated assets need dirty flag explicitly set
                                if (asset.dirty) {
                                    console.log(`Asset to process (dirty): ${package.name}: ${asset.name}`);
                                    rebuildAsset = true;
                                }
                            } else {
                                hash     = fileHash(asset.file);
                                distHash = fs.existsSync(asset.output) ? fileHash(asset.output) : "";

                                if (asset.processedHash !== distHash || asset.rawHash !== hash) {
                                    console.log(`Asset to process (hash has changed)! ${package.name}: ${asset.name}`);
                                    console.log("Output: " + asset.processedHash + " !== " + distHash + " ?  (has the output file changed since last time?) ");
                                    console.log("Raw Asset: " + asset.rawHash + " !== " + hash + " ?  (has the source file changed?) ");
                                    rebuildAsset = true;
                                }
                            }
                        }


                        if (rebuildAsset) {

                            if (Settings.checkNeedsRebuild) {
                                process.exit(2);
                            }

                            updatedPackage = true;
                            if (asset.type === "image") {

                                processImage(asset).then(() => {
                                    asset.hash = hash;
                                    let processedHash = fileHash(asset.output);
                                    asset.processedHash = processedHash;
                                    console.log("Asset hashes: " + hash + " " + processedHash);
                                    const packageRoutine = packageRoutines[package.name],
                                        assets           = packageRoutine.updateAsset(package.data, asset.name, asset);

                                    success();
                                }, (err) => {
                                    console.error("Error processing image: " + err);
                                    fail(err);
                                });
                            } else if (asset.type === "generatedTilesheet") {

                                processGeneratedTilesheet(asset).then(() => {
                                    const packageRoutine = packageRoutines[package.name],
                                        assets           = packageRoutine.updateAsset(package.data, asset.name, asset);

                                    success();
                                }, (err) => {
                                    console.error("Error processing generated tilesheet: " + err);
                                    fail(err);
                                });
                            } else if (asset.type === "data") {

                                createDirectoriesFor(asset.output);
                                unlink(asset.output);
                                fs.copyFile(asset.file, asset.output, (err) => {

                                    if (err) {
                                        console.error(err);
                                        fail();
                                        return;
                                    }

                                    asset.hash = hash;
                                    let processedHash = fileHash(asset.output);
                                    asset.processedHash = processedHash;
                                    console.log("Processed output: " + asset.output + ": " + processedHash);
                                    const packageRoutine = packageRoutines[package.name],
                                        assets           = packageRoutine.updateAsset(package.data, asset.name, asset);

                                    fs.chmodSync(asset.output, 0777);
                                    success();
                                });
                            } else if (asset.type === "sound") {

                                createDirectoriesFor(asset.output);
                                unlink(asset.output);
                                fs.copyFile(asset.file, asset.output, (err) => {

                                    if (err) {
                                        console.error(err);
                                        fail();
                                        return;
                                    }

                                    asset.hash = hash;
                                    let processedHash = fileHash(asset.output);
                                    asset.processedHash = processedHash;
                                    const packageRoutine = packageRoutines[package.name],
                                        assets           = packageRoutine.updateAsset(package.data, asset.name, asset);

                                    fs.chmodSync(asset.output, 0777);
                                    success();
                                });
                            } else if (asset.type === "map") {

                                createDirectoriesFor(asset.output);
                                unlink(asset.output);
                                fs.copyFile(asset.file, asset.output, (err) => {

                                    if (err) {
                                        console.error(err);
                                        fail();
                                        return;
                                    }

                                    asset.hash = hash;
                                    let processedHash = fileHash(asset.output);
                                    asset.processedHash = processedHash;
                                    const packageRoutine = packageRoutines[package.name],
                                        assets           = packageRoutine.updateAsset(package.data, asset.name, asset);

                                    fs.chmodSync(asset.output, 0777);
                                    success();
                                });
                            } else {
                                success();
                            }
                        } else {
                            success();
                        }
                    });
                };


                // If this asset itself is a package, then we need to attempt to process it as a package before we
                // process it as an asset. eg. data files in resources (sheets.json is both an asset and a package)
                // FIXME: This promise shit is a mess, clean up this slop
                if (asset.assets) {
                    let bothPromises = new Promise((success, fail) => {
                        processResources(asset).then(processAsset).then(() => {
                            success();
                        }, (err) => {
                            fail(err);
                        });
                    });
                    processingAssetsPromises.push(bothPromises);
                } else {
                    processingAssetsPromises.push(processAsset());
                }
            });


            // Do we have any assets processing? Wait on these first
            if (processingAssetsPromises.length > 0) {
                Promise.all(processingAssetsPromises).then(() => {

                    // Could be that nothing has changed
                    if (!updatedPackage) {
                        success();
                        return;
                    }

                    // Finalize any changes in the package
                    const packageRoutine = packageRoutines[package.name];
                    packageRoutine.finalize(package);

                    console.log("Saving package changes: " + package.name + " ==> " + package.file);

                    // Save package JSON (save .data)
                    const prettyCache = JSON.stringify(package.data, null, 2); // TODO Prettify cache json?
                    unlink(package.file);
                    fs.writeFile(package.file, prettyCache, {
                        mode: 0777
                    }, (err, bufferData) => {
                        if (err) {
                            console.error(err);
                            return;
                        }

                        fs.chmodSync(package.file, 0777);
                        console.log("Saved to " + package.file);
                        success();
                    });
                }).catch((err) => {
                    console.error("Fail in processing assets");
                    fail(err);
                });
            } else {
                success();
            }
        } else {
            success();
        }
    });
};

let readResourcesPromise = new Promise((success, fail) => {

    fs.readFile('resources/data/resources.json', (err, bufferData) => {
        if (err) {
            failed(err);
            return;
        }

        const data = JSON.parse(bufferData);
        success(data);
    });
});

const unlink = (path) => {
    try {
        fs.unlinkSync(path);
    } catch(e) { }
};

const createDirectoriesFor = (dest) => {

    // Is the destination directory available? If not we need to create those directories
    let destFolders = [path.dirname(dest)];
    while (!fs.existsSync(destFolders[destFolders.length-1])) {
        destFolders.push(path.dirname(destFolders[destFolders.length-1]));
    }

    // The last item is destFolders is a directory that exists
    for (let i=destFolders.length-2; i>=0; --i) {
        console.log(`Making directory: ${destFolders[i]}`);
        fs.mkdirSync(destFolders[i])
    }
};

const processImage = (package) => {

    return new Promise((success, fail) => {

        // Do we need to encrypt the image?
        if (package.options.encrypted) {

            const buffer = new Uint8Array();
            fs.readFile(package.file, (err, buffer) => {

                // Prepare our write buffer (eg. encrypted file if necessary)
                const readyToWritePromise = new Promise((bufferFetchSuccess, bufferFetchFail) => {

                    // Are we encrypting this file?
                    if (package.options.encrypted) {
                        const options = {
                            data: buffer,
                            passwords: ['secret stuff'],
                            armor: false
                        };

                        openpgp.encrypt(options).then((ciphertext) => {
                            const encrypted = ciphertext.message.packets.write(); // get raw encrypted packets as Uint8Array
                            bufferFetchSuccess(encrypted);
                        }, bufferFetchFail);
                    } else {
                        bufferFetchSuccess(buffer);
                    }
                });

                // Write our cached file
                readyToWritePromise.then((writeBuffer) => {

                    createDirectoriesFor(package.output);
                    unlink(package.output);
                    fs.writeFile(package.output, writeBuffer, {
                        encoding: 'binary',
                        flag: 'w',
                        mode: 0777
                    }, (err) => {
                        fs.chmodSync(package.output, 0777);
                        console.log(`Wrote/Encrypted ${package.output}`);
                        success();
                    });
                }, (err) => {
                    console.error(`Error preparing write buffer for ${package.file}`);
                    fail(err);
                });
            });

        } else {

            // Preprocessing raw asset -> asset, without any internal reformatting (eg. packing, encrypting)
            if (!package.options.preprocess) {
                console.log(`Copying raw asset ${package.file} -> ${package.output}`);
                createDirectoriesFor(package.output);
                unlink(package.output);
                fs.copyFile(package.file, package.output, (err) => {

                    if (err) {
                        console.error(err);
                        fail();
                        return;
                    }

                    fs.chmodSync(package.output, 0777);
                    success();
                });
            } else {

                // Preprocess raw asset
                if (package.options.preprocess === "convert") {

                    createDirectoriesFor(package.output);
                    unlink(package.output);
                    exec(`convert "${package.file}" "${package.output}"`, (err, stdout, stderr) => {

                        if (err) {
                            // node couldn't execute the command
                            console.error(`Error converting asset ${package.file}`);
                            fail();
                            return;
                        }

                        success();
                    });
                } else {
                    console.error(`Unknown preprocess option (${package.options.preprocess}) for asset ${package.file}`);
                    fail();
                }
            }
        }

    });
};

const processGeneratedTilesheet = (package) => {

    return new Promise((success, fail) => {

        const oldDependencies = package.dependencies,
            newDependencies   = package.newDependencies || [];

        const oldSprites = package.oldSprites,
            modifiedSprites = package.sprites;

        const oldSpriteGroups = package.spriteGroups;

        package.dependencies = [];
        package.sprites = [];

        let spritesToExtract = [],
            imagesToExtract = [],
            yOffset = 0,
            genMaxX = 0,
            genMaxY = 0,
            spriteGroups = [];

        const extractionDeps = [],
            imageDeps = [];

        newDependencies.forEach((dep) => {
            if (dep.imageSrc) {
                imageDeps.push(dep);
            } else {
                extractionDeps.push(dep);
            }
        });

        
        extractionDeps.forEach((dependency) => {

            const source = dependency.asset.image,
                columns = parseInt(dependency.asset.columns, 10),
                rows = parseInt(dependency.asset.rows, 10),
                tilesize = parseInt(dependency.asset.tilesize, 10),
                spriteIslands = [];

            let minY = Number.MAX_SAFE_INTEGER, 
                minX = Number.MAX_SAFE_INTEGER, 
                maxY = 0,
                maxX = 0;

            // min/max bounds for sprites from dependency sheet
            dependency.sprites.forEach((sprite) => {
                let x = sprite % columns,
                    y = Math.floor(sprite / columns);

                minY = Math.min(minY, y);
                minX = Math.min(minX, x);
                maxY = Math.max(maxY, y);
                maxX = Math.max(maxX, x);
            });

            dependency.sprites.forEach((sprite) => {
                let x = sprite % columns,
                    y = Math.floor(sprite / columns),
                    dstX = (x - minX),
                    dstY = (y - minY + yOffset);

                const existingSprite = modifiedSprites.find((s) => s.source === source && s.sprite === sprite);

                if (existingSprite) {
                    dstX = existingSprite.dstX / package.tilesize;
                    dstY = existingSprite.dstY / package.tilesize;
                }

                spritesToExtract.push({
                    source,
                    srcX: x * tilesize,
                    srcY: y * tilesize,
                    srcW: tilesize,
                    srcH: tilesize,
                    dstX: dstX * package.tilesize,
                    dstY: dstY * package.tilesize
                });

                package.sprites.push({
                    source, sprite,
                    dstX: dstX * package.tilesize,
                    dstY: dstY * package.tilesize
                });

                // Check sprite islands to see if this sprite is touching any other sprite islands. This way we can keep
                // track of groups of sprites that should stick together
                let touchingSpriteIslands = [];
                spriteIslands.forEach((island) => {
                    // Sprite touching any other sprites in this island?
                    for (let i = 0; i < island.length; ++i) {
                        const islandSprite = island[i];
                        if
                        (
                            _.inRange(x, islandSprite.x - 1, islandSprite.x + 2) &&
                            _.inRange(y, islandSprite.y - 1, islandSprite.y + 2)
                        )
                        {
                            touchingSpriteIslands.push(island);
                            break;
                        }
                    }
                });

                if (touchingSpriteIslands.length === 0) {
                    // Starting a new island w/ this sprite
                    spriteIslands.push([{
                        sprite, x, y, dstX, dstY
                    }]);
                } else {
                    // Add sprite to first island, and merge the islands since they're each connected via this sprite
                    touchingSpriteIslands[0].push({
                        sprite, x, y, dstX, dstY
                    });

                    // Merge other islands to the first one, and remove the other islands
                    for (let i = 1; i < touchingSpriteIslands.length; ++i) {
                        touchingSpriteIslands[i].forEach((island) => {
                            touchingSpriteIslands[0] = touchingSpriteIslands[0].concat(island);
                        });

                        // Remove island from list
                        for (let j = 0; j < spriteIslands.length; ++j) {
                            if (touchingSpriteIslands[i] === spriteIslands[j]) {
                                spriteIslands.splice(j, 1);
                                break;
                            }
                        }
                    }
                }
            });

            yOffset += (maxY - minY + 1);
            genMaxY += (maxY - minY + 1);
            genMaxX = Math.max(genMaxX, maxX - minX + 1);

            package.dependencies.push({
                assetId: dependency.asset.id,
                sprites: dependency.sprites
            });

            debugger; // FIXME: We want to copy spriteGroup over
            spriteIslands.forEach((spriteIsland) => {
                spriteGroups.push({
                    spriteIsland
                });
            });
        });

        const spriteGroupsToTranslate = [];

        // Append to package.sprites for image based deps
        imageDeps.forEach((dependency) => {
            package.dependencies.push(dependency);

            const spriteGroup = oldSpriteGroups.find((spriteGroup) => spriteGroup.imageSrc === dependency.imageSrc);

            const relSource = "../" + dependency.previewSrc;

            // Does relSource exist? If not then we need to create it first
            if (!fs.existsSync(dependency.previewSrc)) {
                unlink(dependency.previewSrc);
                const processedOutput = execSync(`convert "${dependency.imageSrc}" ${dependency.processing} "${dependency.previewSrc}"`);
                console.log(processedOutput.toString('utf8'));
            }

            let minY = Number.MAX_SAFE_INTEGER, 
                minX = Number.MAX_SAFE_INTEGER, 
                maxY = 0,
                maxX = 0;

            imagesToExtract.push({
                source: relSource,
                dstX: spriteGroup.dstX, 
                dstY: spriteGroup.dstY,
            });


            genMaxY += (maxY - minY + 1);
            genMaxX = Math.max(genMaxX, maxX - minX + 1);


            spriteGroups.push({
                imageSrc: spriteGroup.imageSrc,
                dstX: spriteGroup.dstX,
                dstY: spriteGroup.dstY,
                width: spriteGroup.width,
                height: spriteGroup.height
            });


            // If the spriteGroup has been modified (moved? scaled?) we need to translate individual sprites in the
            // spriteGroup (in the map and such)
            if (spriteGroup.oldSpriteGroup) {
                spriteGroupsToTranslate.push(spriteGroup);
            }
        });


        if (Settings.verbose) {
            console.log("Generated tilesheet:");
            console.log(`  Width: ${package.tilesize * genMaxX}`);
            console.log(`  Height: ${package.tilesize * genMaxY}`);
            console.log(`  Sprites:`);
            console.log(spritesToExtract);
            console.log(`  Images:`);
            console.log(imagesToExtract);

            console.log(oldDependencies);
            console.log(oldSprites);
            console.log(package.dependencies);
            console.log(package.sprites);
        }


        // Go through all sprites and find the min/max positions to determine our newColumns/newRows boundaries.
        // NOTE: genMaxX/Y are specific to the dependency positions, however this may have changed from the generated
        // sheet itself via. translating sprite islands
        // NOTE: This is important for when imagemagick automatically resizes the image to be more compact
        let minDstX = Number.MAX_SAFE_INTEGER, 
            minDstY = Number.MAX_SAFE_INTEGER, 
            maxDstX = 0,
            maxDstY = 0;


        const tilesize = parseInt(package.tilesize, 10);

        package.sprites.forEach((sprite) => {
            let x = sprite.dstX / tilesize,
                y = sprite.dstY / tilesize;

            minDstY = Math.min(minDstY, y);
            minDstX = Math.min(minDstX, x);
            maxDstY = Math.max(maxDstY, y + 1);
            maxDstX = Math.max(maxDstX, x + 1);
        });

        spriteGroups.forEach((spriteGroup) => {
            if (spriteGroup.imageSrc) {
                const width = Math.ceil(spriteGroup.width / tilesize),
                    height = Math.ceil(spriteGroup.height / tilesize),
                    x = spriteGroup.dstX / tilesize,
                    y = spriteGroup.dstY / tilesize;

                minDstY = Math.min(minDstY, y);
                minDstX = Math.min(minDstX, x);
                maxDstY = Math.max(maxDstY, y + height);
                maxDstX = Math.max(maxDstX, x + width);
            }
        });

        

        const newColumns = maxDstX - minDstX,
            newRows = maxDstY - minDstY;


        const spriteTranslations             = {},
              extendedSpriteGroups           = [],
              spriteGroupExtensionBoundaries = {}, // The right/bottom edges of a spriteGroup, so that we can point to the extendedSpriteGroup and append sprites
              oldColumns                     = parseInt(package.columns, 10),
              oldRows                        = parseInt(package.rows, 10);

        // Need to update our spriteIslands and data sprite id's
        const boundsHaveChanged = (oldColumns !== newColumns || oldRows !== newRows);
        if (boundsHaveChanged) {

            for (let i = 0; i < package.sprites.length; ++i) {
                package.sprites[i].dstX -= minDstX * tilesize;
                package.sprites[i].dstY -= minDstY * tilesize;
            }

            // Translate sprite in spriteIsland
            spriteGroups.forEach((sg) => {

                if (sg.spriteIsland) {
                    sg.spriteIsland.forEach((s) => {
                        s.dstX -= minDstX;
                        s.dstY -= minDstY;
                    });
                } else {
                    sg.dstX -= minDstX;
                    sg.dstY -= minDstY;
                }
            });
        }

        spriteGroupsToTranslate.forEach((spriteGroup) => {

            // FIXME: If package.tilesize changes then we need to take that into consideration
            const tw    = Math.ceil(spriteGroup.width / package.tilesize),
                th      = Math.ceil(spriteGroup.height / package.tilesize),
                twOld   = Math.ceil(spriteGroup.oldSpriteGroup.width / package.tilesize),
                thOld   = Math.ceil(spriteGroup.oldSpriteGroup.height / package.tilesize),
                dstX    = spriteGroup.dstX / package.tilesize,
                dstY    = spriteGroup.dstY / package.tilesize,
                dstXOld = spriteGroup.oldSpriteGroup.dstX / package.tilesize,
                dstYOld = spriteGroup.oldSpriteGroup.dstY / package.tilesize;

            // Translate oldSprites -> newSprites
            for (let y = 0; y < thOld; ++y) {
                for (let x = 0; x < twOld; ++x) {

                    const oldSprite = (dstYOld + y) * oldColumns + (dstXOld + x);

                    // Have we scaled the spriteGroup to smaller than before? We may have removed some sprites then,
                    // check that the newSprite position still belongs w/in the bounds of our spriteGroup
                    let newSprite = null;
                    if (y < th && x < tw) {
                        newSprite = (dstY + y) * newColumns + (dstX + x);
                    }

                    spriteTranslations[oldSprite] = newSprite;
                }
            }

            if (Settings.verbose) {
                console.log("Translations:");
                console.log(spriteGroup);
                console.log(spriteTranslations);
            }


            // Loop through extended boundaries (y/x starts from twOld and thOld), then introduce new
            // sprites
            // NOTE: We may have scaled AND moved the spriteGroup, so we need to search from local coordinates
            let extendedSpriteGroup = null;
            for (let y = 0; y < th; ++y) {
                for (let x = 0; x < tw; ++x) {

                    // If this sprite is w/in the boundaries of the old spriteGroup then its not a new sprite
                    //if (y < thOld && x < twOld) continue;

                    if (!extendedSpriteGroup) {
                        extendedSpriteGroup = {
                            newSprites: {}, // Local pos
                            width: tw,
                            height: th,
                            oldWidth: twOld,
                            oldHeight: thOld
                        }

                        extendedSpriteGroups.push(extendedSpriteGroup);
                    }

                    const localPos = y * tw + x,
                        sheetPos = (dstY + y) * newColumns + (dstX + x);
                    extendedSpriteGroup.newSprites[localPos] = sheetPos;
                }
            }

            // Find the boundaries of the spriteGroup (old sprite bottom/right boundaries)
            if (extendedSpriteGroup) {

                // NOTE: We only need the topleft boundary, since that's the first boundary point that we'll hit
                const oldSprite = dstYOld * oldColumns + dstXOld;
                spriteGroupExtensionBoundaries[oldSprite] = {
                    extendedSpriteGroup: extendedSpriteGroup
                };
            }
        });

        if (oldSprites) {
            oldSprites.forEach((sprite) => {
                const newSpriteInfo = package.sprites.find((s) => s.sprite === sprite.sprite && s.source === sprite.source),
                    oldSpriteX = sprite.dstX / tilesize,
                    oldSpriteY = sprite.dstY / tilesize,
                    oldSprite  = oldSpriteY * oldColumns + oldSpriteX;

                if (newSpriteInfo) {
                    const newSpriteX = newSpriteInfo.dstX / tilesize,
                        newSpriteY   = newSpriteInfo.dstY / tilesize,
                        newSprite    = newSpriteY * newColumns + newSpriteX;

                    spriteTranslations[oldSprite] = newSprite;

                } else {
                    spriteTranslations[oldSprite] = null; // Deleted
                }
            });
        }

        if (boundsHaveChanged) {

            // Translate data: collisions/floating/shootable
            for (let i = 0; i < package.data.collisions.length; ++i) {
                const untranslatedSprite = package.data.collisions[i],
                    oldY = parseInt(untranslatedSprite / oldColumns, 10),
                    oldX = untranslatedSprite % oldColumns;

                package.data.collisions[i] = (oldY - minDstY) * newColumns + (oldX - minDstX);
            }

            for (let i = 0; i < package.data.floating.length; ++i) {
                const untranslatedSprite = package.data.floating[i],
                    oldY = parseInt(untranslatedSprite / oldColumns, 10),
                    oldX = untranslatedSprite % oldColumns;

                package.data.floating[i] = (oldY - minDstY) * newColumns + (oldX - minDstX);
            }

            for (let i = 0; i < package.data.shootable.length; ++i) {
                const untranslatedSprite = package.data.shootable[i],
                    oldY = parseInt(untranslatedSprite / oldColumns, 10),
                    oldX = untranslatedSprite % oldColumns;

                package.data.shootable[i] = (oldY - minDstY) * newColumns + (oldX - minDstX);
            }
        }

        package.columns = newColumns;
        package.rows = newRows;
        package.spriteGroups = spriteGroups;

        // convert \( resources/sprites/tilesheet.png -crop 16x16+0+64 -repage +0+0 \) \( resources/sprites/tilesheet.png -crop 16x16+72+64 -repage +32+16 \) -background none -layers merge autogen.png
        let convertCmd = "convert ",
            curX = 0,
            curY = 0;
        spritesToExtract.forEach((sprite) => {
            curX = sprite.dstX; // FIXME: I think we can get away w/ just using dst?
            curY = sprite.dstY;
            convertCmd += `\\( "resources/${sprite.source}" -crop ${sprite.srcW}x${sprite.srcH}+${sprite.srcX}+${sprite.srcY}  -filter box -resize ${package.tilesize}x${package.tilesize} -repage ${curX >= 0 ? '+' : '-'}${curX}${curY >= 0 ? '+' : '-'}${curY} \\) `;
        });

        imagesToExtract.forEach((img) => {
            const dstX = img.dstX,
                dstY = img.dstY;
            convertCmd += `\\( "resources/${img.source}" -filter box -repage ${dstX >= 0 ? '+' : '-'}${dstX}${dstY >= 0 ? '+' : '-'}${dstY} \\) `;
        });

        convertCmd += `-background none -layers merge "${package.output}"`;

        if (Settings.verbose) {
            console.log(convertCmd);
        }


        let needToUpdateMap = false;
        if (!_.isEmpty(spriteTranslations) || !_.isEmpty(spriteGroupExtensionBoundaries)) {
            needToUpdateMap = true;
        }

        unlink(package.output);
        exec(convertCmd, (err, stdout, stderr) => {
            if (err) {
                console.error(`Error generating tilesheet ${package.id}`);
                console.error(err);
                console.error(stdout);
                console.error(stderr);
                fail();
                return;
            }

            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
            // FIXME: Map shits expensive
            if (!needToUpdateMap) {
                success();
                return;
            }
            // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!

            // Tilesheets are saved as .tsx files; find the .tsx file that refers to this tilesheet
            //const matchingTsxBuf = execSync(`grep -ir -H '${package.output}' resources/maps/\*.tsx | awk -F: '{ print $1 }' | xargs`),
            //    tilesetTsx = matchingTsxBuf.toString('utf8');


            // Update maps referencing this tilesheet
            // FIXME: We can simply store used tilesets in world/area json and read from there rather than having to
            // open and parse the entire fucking source file
            const parseString = xml2js.parseString,
                XmlBuilder    = xml2js.Builder;
                waitingOnMaps = [],
                worldAsset    = Resources.assets.find((a) => a.name === 'world');
            _.forEach(worldAsset.data.areas, (area) => {

                updateMapPromise = new Promise((success, failed) => {

                    // Fetch map from the source file (XML format)
                    fs.readFile(`resources/${area.file}.tmx`, (err, bufferData) => {
                        if (err) {
                            failed(err);
                            return;
                        }

                        // Parse XML
                        parseString(bufferData.toString(), (err, result) => {
                            if (err) {
                                failed(err);
                                return;
                            }

                            // Are any of the tilesets referencing this tileset?
                            const refTileset = result.map.tileset.find((tileset) => tileset.image && tileset.image[0].$.source.indexOf(package.output) > -1);

                            // Tileset not used in this map? Then finished w/ this one
                            if (!refTileset) {
                                success();
                                return;
                            }


                            // Go through each layer find any sprites that
                            const tilesetGid = parseInt(refTileset.$.firstgid, 10),
                                tilesetLastGid = parseInt(refTileset.$.tilecount, 10) + tilesetGid;

                            let updatedMap = false;
                            result.map.layer.forEach((layer) => {
                                const layerData = layer.data[0]._,
                                    layerWidth = parseInt(layer.$.width, 10),
                                    layerHeight = parseInt(layer.$.height, 10),
                                    layerDataSplit = layerData.split(',').map((g) => parseInt(g, 10));

                                let foundTilesetInLayer = false;
                                for (let i = 0; i < layerDataSplit.length; ++i) {
                                    const g = layerDataSplit[i];

                                    // A trick to flag that we've already processed this sprite (from scaled
                                    // spriteGroups). Just negate this sprite and continue to the next
                                    if (g < 0) {
                                        layerDataSplit[i] *= -1;
                                        continue;
                                    }

                                    if (g >= tilesetGid && g <= tilesetLastGid) {
                                        foundTilesetInLayer = true;

                                        const boundarySprite = spriteGroupExtensionBoundaries[g - tilesetGid];

                                        // Does the sprite have a new neighbour due to scaling the spriteGroup? We want
                                        // to add new neighbours here
                                        // NOTE: We must do this before translation, in case we've also moved the
                                        // spriteGroup
                                        if (boundarySprite) {

                                            console.log(`Found boundary edge of extended spriteGroup here`);

                                            const extendedSpriteGroup = boundarySprite.extendedSpriteGroup,
                                                updatedSprites = [];

                                            const mapY = Math.floor(i / layerWidth),
                                                mapX = (i % layerWidth);
                                            let collision = false;
                                            for (let localY = 0; localY < extendedSpriteGroup.height; ++localY) {
                                                for (let localX = 0; localX < extendedSpriteGroup.width; ++localX) {

                                                    // Old sprites from spriteGroup: need to check for translation
                                                    const isOldSprite = localY < extendedSpriteGroup.oldHeight && localX < extendedSpriteGroup.oldWidth;


                                                    // Extended sprite: will use new sheetPos
                                                    const mapPos = (localY + mapY) * layerWidth + (localX + mapX),
                                                        localPos = localY * extendedSpriteGroup.width + localX,
                                                        sheetPos = extendedSpriteGroup.newSprites[localPos];


                                                    if (!isOldSprite)
                                                    {
                                                        // Is there a collision here?
                                                        if (layerDataSplit[mapPos]) collision = true;

                                                        if (mapPos >= layerDataSplit.length) {
                                                            // The spriteGroup has been extended beyond the bounds of the
                                                            // map. Need to remove
                                                            collision = true;
                                                        }

                                                        if (collision) break;

                                                        console.log(`Extending sprite at pos ${mapPos}: ${sheetPos}`);
                                                        updatedSprites.push(mapPos);
                                                    }


                                                    // Since we're updating this from topleft -> botright, we will end
                                                    // up coming across these sprites again. In order to prevent any
                                                    // issues w/ updating the sprite twice, we can simply set it as a
                                                    // negative number and use that as a flag to indicate that we've
                                                    // already touched this. Then we just need to negate it again and
                                                    // continue on. This will work for all sprites except the topleft
                                                    // one
                                                    layerDataSplit[mapPos] = -1 * (tilesetGid + sheetPos);

                                                }

                                                if (collision) break;
                                            }


                                            // Collision? Clear spriteGroup from map
                                            if (collision) {
                                                console.log(`Collision on spriteGroup. Removing spriteGroup`);

                                                // Revert updated sprites
                                                updatedSprites.forEach((sprite) => {
                                                    layerDataSplit[sprite] = 0;
                                                });

                                                // Clear old region of spriteGroup
                                                // FIXME: Check if this sprite is part of the spriteGroup, just in case
                                                // we intentionally only had the partial spriteGroup
                                                for (let localY = 0; localY < extendedSpriteGroup.oldHeight; ++localY) {
                                                    for (let localX = 0; localX < extendedSpriteGroup.oldWidth; ++localX) {

                                                        const mapPos = (localY + mapY) * layerWidth + (localX + mapX);
                                                        layerDataSplit[mapPos] = 0;

                                                    }
                                                }
                                            } else {
                                                const topleftPos = mapY * layerWidth + mapX;
                                                layerDataSplit[topleftPos] *= -1;
                                            }
                                        } else {

                                            // Not a boundary group. Has this sprite been translated?
                                            const localSprite = layerDataSplit[i] - tilesetGid;
                                            let translatedSprite = spriteTranslations[localSprite];

                                            let translated = true;
                                            if (translatedSprite === undefined) {
                                                translated = false;
                                                translatedSprite = localSprite; // Hasn't moved? No sprite here?

                                            } else if (translatedSprite === null) {
                                                translated = false;
                                                translatedSprite = null;

                                                console.log(`Removing old sprite`);
                                                layerDataSplit[i] = 0;
                                                continue;
                                            } else {
                                                console.log(`Found tileset in area: ${area.file}: ${g} - ${tilesetGid} == ${localSprite} : ${localSprite} -> ${translatedSprite}  (translated: ${translatedSprite - localSprite}) ==> ${tilesetGid + translatedSprite}   ${ translated ? "" : "SPRITE NOT FOUND!" }`);
                                            }

                                            //console.log(`Found tileset in area: ${area.file}: ${g} - ${tilesetGid} == ${localSprite} : ${localSprite} -> ${translatedSprite}  (translated: ${translatedSprite - localSprite}) ==> ${tilesetGid + translatedSprite}   ${ translated ? "" : "SPRITE NOT FOUND!" }`);
                                            layerDataSplit[i] = tilesetGid + translatedSprite;
                                        }
                                    }
                                }

                                if (foundTilesetInLayer) {
                                    layer.data[0]._ = '\n' + layerDataSplit.join(',') + '\n';
                                    updatedMap = true;
                                }
                            });


                            // Build revised XML back into XML string and save changes
                            if (updatedMap) {

                                refTileset.$.tilecount = package.columns * package.rows;
                                refTileset.$.columns = package.columns;
                                refTileset.image[0].$.width = newColumns * tilesize;

                                const builder  = new XmlBuilder({
                                        xmldec: {
                                            'version': '1.0',
                                            'encoding': 'UTF-8',
                                            'standalone': null
                                        }
                                    }),
                                    revisedXml = builder.buildObject(result);

                                unlink(`resources/${area.file}.tmx`);
                                fs.writeFile(`resources/${area.file}.tmx`, revisedXml, {
                                    mode: 0777
                                }, (err) => {
                                    if (err) {
                                        console.error("Failed to write map");
                                        console.error(err);
                                        failed(err);
                                        return;
                                    }

                                    fs.chmodSync(`resources/${area.file}.tmx`, 0777);
                                    success();
                                });
                            } else {
                                success();
                            }
                        })
                    });
                });

                waitingOnMaps.push(updateMapPromise);
            });

            Promise.all(waitingOnMaps).then(() => {
                success();
            }).catch((err) => {
                fail(err);
            });
        });


        // FIXME: Find translation from old sprite positions ==> new position
        // NOTE: This probably isn't necessary if we don't modify sprite positions automatically, and require manual
        // handling for moving them
        //const spriteTranslations = [];
        //if (oldDependencies) {
        //    oldDependencies.forEach((oldDependency) => {

        //        // Does that dependency still exist w/ the new set of dependencies?
        //        const newDependency = package.dependencies.find((newD) => newD.source === oldDependency.source && newD.sprite === oldDependency.sprite);
        //        
        //    });

        //}
    });
};


/*
//readResourcesPromise.then(() => {

    fs.readFile('resources/data/cache.json', (err, bufferData) => {

        if (err) {
            console.error(`Error reading cache.json: ${err}`);
            return;
        }

        const data    = JSON.parse(bufferData),
            packedCacheNodes = {},
            waitingOn = [];

        let updatedCache = false;
        _.each(data.cacheList, (cacheNode) => {

            // All resources are built into /dist
            let dest = 'dist/resources/' + cacheNode.asset;

            // Is the destination directory available? If not we need to create those directories
            let destFolders = [path.dirname(dest)];
            while (!fs.existsSync(destFolders[destFolders.length-1])) {
                destFolders.push(path.dirname(destFolders[destFolders.length-1]));
            }

            // The last item is destFolders is a directory that exists
            for (let i=destFolders.length-2; i>=0; --i) {
                console.log(`Making directory: ${destFolders[i]}`);
                fs.mkdirSync(destFolders[i])
            }

            // Do we want to cache this asset into a binary format? (eg. packing, encrypting)
            if (cacheNode.options.cached) {

                if (cacheNode.options.packed) {
                    // Add to packed cache nodes list
                    if (!packedCacheNodes[cacheNode.asset]) packedCacheNodes[cacheNode.asset] = [];
                    packedCacheNodes[cacheNode.asset].push(cacheNode);
                    return;
                }

                let readRawAssetPromise = new Promise((success, fail) => {

                    // Load raw asset
                    // We want to check its hash in case it hasn't changed since the last time
                    const file     = cacheNode.rawAsset,
                        hash       = crypto.createHash('md5'),
                        rawAssetFd = fs.createReadStream(file);

                    rawAssetFd.on('end', () => {

                        // Finished piping raw asset into the hasher
                        hash.end();

                        const rawAssetHash = hash.read().toString('hex'),
                            cacheFile      = dest;

                        rawAssetFd.destroy();
                        hash.destroy();

                        // Has the raw asset changed?
                        if (!Settings.forceRebuild && rawAssetHash === cacheNode.rawAssetHash) {
                            // Asset hashes match (raw asset hasn't changed)
                            // Does the cache file still exist? It may have been intentinoally deleted for forceRebuild
                            if (fs.existsSync(cacheFile)) {
                                //console.log(`Asset ${cacheNode.rawAsset} hasn't changed since the last cache. Skipping`);
                                success();
                                return;
                            }
                        }

                        const buffer = new Uint8Array();
                        console.log(`Updating cache: ${cacheNode.name}`);
                        fs.readFile(file, (err, buffer) => {

                            // Prepare our write buffer (eg. encrypted file if necessary)
                            const readyToWritePromise = new Promise((bufferFetchSuccess, bufferFetchFail) => {

                                // Are we encrypting this file?
                                if (cacheNode.options.encrypted) {
                                    const options = {
                                        data: buffer,
                                        passwords: ['secret stuff'],
                                        armor: false
                                    };

                                    openpgp.encrypt(options).then((ciphertext) => {
                                        const encrypted = ciphertext.message.packets.write(); // get raw encrypted packets as Uint8Array
                                        bufferFetchSuccess(encrypted);
                                    }, bufferFetchFail);
                                } else {
                                    bufferFetchSuccess(buffer);
                                }
                            });

                            // Write our cached file
                            readyToWritePromise.then((writeBuffer) => {

                                fs.writeFile(cacheFile, writeBuffer, {
                                    encoding: 'binary',
                                    flag: 'w'
                                }, (err) => {
                                    console.log(`Wrote/Encrypted ${cacheFile}`);
                                    cacheNode.rawAssetHash = rawAssetHash;

                                    updatedCache = true;
                                    success();
                                });
                            }, (err) => {
                                console.error(`Error preparing write buffer for ${cacheFile}`);
                                fail(err);
                            });
                        });
                    });

                    rawAssetFd.pipe(hash);
                });

                waitingOn.push(readRawAssetPromise);

            } else {

                let processRawAssetPromise = new Promise((success, fail) => {

                    // Preprocessing raw asset -> asset, without any internal reformatting (eg. packing, encrypting)
                    if (!cacheNode.options.preprocess) {
                        console.log(`Copying raw asset ${cacheNode.rawAsset} -> ${dest}`);
                        fs.copyFile(cacheNode.rawAsset, dest, (err) => {

                            if (err) {
                                console.error(err);
                                fail();
                                return;
                            }

                            success();
                        });
                    } else {

                        // Preprocess raw asset
                        if (cacheNode.options.preprocess === "convert") {

                            exec(`convert ${cacheNode.rawAsset} ${dest}`, (err, stdout, stderr) => {

                                if (err) {
                                    // node couldn't execute the command
                                    console.error(`Error converting asset ${cacheNode.name}`);
                                    fail();
                                    return;
                                }

                                success();
                            });
                        } else {
                            console.error(`Unknown preprocess option (${cacheNode.options.preprocess}) for asset ${cacheNode.name}`);
                            fail();
                        }
                    }

                });

                waitingOn.push(processRawAssetPromise);
            }
        });

        //// Packed Cache Nodes: Each pack contains an array of cacheNodes
        //_.each(packedCacheNodes, (packList) => {
        //    // TODO: Convert full pack list into a single image
        //    // TODO: Check each raw asset hash against its asset's hash (in case it hasn't changed); if ANY of them in the
        //    // pack have changed, then we need to recache the entire pack
        //    // TODO: Encrypt shiz; Preprocess shiz (before/after packing)

        //});


        // Update our cache list file
        Promise.all(waitingOn).then(() => {

            if (!updatedCache) {
                console.log("Nothing to update");
                return;
            }

            // This was the last cache, write and close the cache file
            const prettyCache = JSON.stringify(data); // TODO Prettify cache json?
            fs.writeFile('resources/data/cache.json', prettyCache, function(err, bufferData){

                if (err) {
                    console.error(err);
                    return;
                }

                fs.copyFile('resources/data/cache.json', 'dist/resources/data/cache.json', (err) => {

                    if (err) {
                        console.error(`Error copying cache file`);
                        console.error(err);
                        return;
                    }

                    console.log("Successfully updated cache file");
                });
            });

        }, () => {
            console.error("There was an error building cache..");
        });
    });

//}).catch((err) => {
//    console.error(err);
//});
*/
