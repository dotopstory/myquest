define(['SCRIPTINJECT'], (SCRIPTINJECT) => {

    /* SCRIPTINJECT */

    const Commands = [
        {
            typedCommand: 'admin',
            command: CMD_ADMIN,
            requiresAdmin: false,
            description: "/admin [password] : gives admin permissions",
            args: [
                {
                    name: 'password',
                    sanitize: (p) => p,
                    test: (p) => _.isString(p),
                    error: "Token expected to be a string"
                }
            ],
            client: {
                succeeded: (self) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);
                    self.admin = true;
                    UI.setAdminUI();
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            },
            server: (evt, data, self, player) => {

                let success = false;
                if (_.isObject(data) && data.password === "42") {
                    success = true;
                    self.admin = true;
                    self.setupAdmin(player);
                }

                player.respond(evt.id, success, {

                });
            }
        },
        {
            typedCommand: 'crash',
            command: CMD_CRASH,
            requiresAdmin: false,
            description: "/crash : crashes locally",
            args: [],
            client: () => {

                try {
                    throw Err("Crashing the game from script");
                } catch(e) {
                    errorInGame(e);
                }
            }
        },
        {
            typedCommand: 'admin_crash',
            command: CMD_ADMIN_CRASH,
            requiresAdmin: true,
            description: "/admin_crash : sends a crash to the server",
            args: [],
            server: (evt, data, self) => {
                try {
                    throw Err("Crashing the game from script");
                } catch(e) {
                    errorInGame(e);
                }
            },
            client: {
                succeeded: (self) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'gain_xp',
            command: CMD_ADMIN_GAIN_XP,
            requiresAdmin: true,
            description: "/gain_xp [amount] : gives some amount of XP",
            args: [
                {
                    name: 'XP',
                    sanitize: (p) => parseInt(p, 10),
                    test: (p) => _.isFinite(p),
                    error: "Token should be a valid number"
                }
            ],
            server: (evt, data, self, player) => {

                let success = false;
                if (_.isObject(data) && _.isFinite(data.XP)) {
                    success = true;
                    // FIXME: Should check XP amount is reasonable -- cannot level more than once
                    this.Log(`Giving you some XP: ${data.XP}`);
                    player.movable.character.doHook('GainedXP').post({ XP: data.XP });
                }

                player.respond(evt.id, success, {

                });
            },
            client: {
                pre: () => {
                    UI.postMessage("So you think you can login eh?");
                },
                succeeded: (self) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'suicide',
            command: CMD_ADMIN_SUICIDE,
            requiresAdmin: true,
            description: "/suicide : kills yourself",
            args: [],
            server: (evt, data, self, player) => {

                let success = true;
                // FIXME: Check if we can die (currently alive)
                this.Log(`Committing suicide`);
                player.movable.character.die(null);

                player.respond(evt.id, success, {

                });
            },
            client: {
                succeeded: (self) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'give_buff',
            command: CMD_ADMIN_GIVE_BUFF,
            requiresAdmin: true,
            description: "/give_buff [buff] : give yourself a specified buff",
            args: [
                {
                    name: 'buffres',
                    sanitize: (p) => p,
                    test: (p) => p in Buffs,
                    error: "BuffRes not valid"
                }
            ],
            server: (evt, data, self, player) => {

                let success = false;
                if
                (
                    _.isObject(data) &&
                    _.isString(data.buffres) &&
                    data.buffres in Buffs
                )
                {
                    success = true;
                    this.Log(`Giving you a buff: ${data.buffres}`);
                    player.movable.character.doHook('BuffEvt').post({
                        buff: Buffs[data.buffres]
                    });
                }

                player.respond(evt.id, success, {

                });
            },
            client: {
                succeeded: (self) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'give_item',
            command: CMD_ADMIN_GIVE_ITEM,
            requiresAdmin: true,
            description: "/give_item [item] : give yourself a specified item",
            args: [
                {
                    name: 'itemres',
                    sanitize: (p) => p,
                    test: (p) => p in Items,
                    error: "ItemRes not valid"
                }
            ],
            server: (evt, data, self, player) => {

                if
                (
                    _.isObject(data) &&
                    _.isString(data.itemres) &&
                    data.itemres in Items
                )
                {
                    this.Log(`Giving you an item: ${data.itemres}`);

                    // Add item to inventory
                    const itmRef  = Items[data.itemres],
                        inventory = player.movable.character.inventory,
                        result    = inventory.addItem(itmRef);

                    if (result !== false) {
                        player.respond(evt.id, true, {
                            itmres: data.itemres,
                            slot: result
                        });
                    }
                }

                player.respond(evt.id, false, { });
            },
            client: {
                succeeded: (self, data) => {
                    UI.postMessage("Success in sending message! ", MESSAGE_GOOD);

                    const itmRef = Resources.items.list[data.itmres];
                    player.character.inventory.addItem(itmRef, data.slot);
                },
                failed: () => {
                    UI.postMessage("Fail in sending message! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'clear_buffs',
            command: CMD_ADMIN_CLEAR_BUFFS,
            requiresAdmin: true,
            description: "/clear_buffs : clear yourself of all buffs",
            args: [],
            server: (evt, data, self, player) => {

                let success = true;
                this.Log(`Clearing your buffs`);
                player.movable.character.charComponent('buffmgr').clearBuffs();
                player.respond(evt.id, success, {});
            },
            client: {
                succeeded: (self) => {
                    UI.postMessage("Successfully clearing buffs", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Failed to clear buffs ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'teleport',
            command: CMD_ADMIN_TELEPORT,
            requiresAdmin: true,
            description: "/teleport [x] [y] : teleport to a given location",
            args: [
                {
                    name: 'x',
                    sanitize: (p) => parseInt(p),
                    test: (p) => _.isFinite(p),
                    error: "coordinate X is not a number"
                },
                {
                    name: 'y',
                    sanitize: (p) => parseInt(p),
                    test: (p) => _.isFinite(p),
                    error: "coordinate Y is not a number"
                }
            ],
            server: (evt, data, self, player) => {

                let success = false;
                if
                (
                    _.isObject(data) &&
                    _.isFinite(data.x) &&
                    _.isFinite(data.y)
                )
                {

                    this.Log(`User wants to teleport: (${data.x}, ${data.y})`);
                    success = player.movable.teleport(data.x, data.y);
                }

                player.respond(evt.id, success, { });
            },
            client: {
                pre: (self) => {
                    The.player.cancelPath();
                },
                succeeded: (self) => {
                    UI.postMessage("Success in teleporting! ", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Fail in teleport! ", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'character_template',
            command: CMD_ADMIN_CHARACTER_TEMPLATE,
            requiresAdmin: true,
            description: "/character_template [template_name] : Loads into a specified character template",
            args: [
                {
                    name: 'charTemplate',
                    sanitize: (p) => p,
                    test: (p) => p in TestingData.charTemplates,
                    error: "Invalid character template"
                }
            ],
            server: (evt, data, self, player) => {

                let success = false;
                if
                (
                    _.isObject(data) &&
                    _.isString(data.charTemplate) &&
                    data.charTemplate in TestingData.charTemplates
                )
                {
                    this.Log(`User loading into character template: (${data.charTemplate})`);
                    results = player.setCharacterTemplate(TestingData.charTemplates[data.charTemplate]);
                    player.respond(evt.id, true, results);
                }

                player.respond(evt.id, success, { });
            },
            client: {
                pre: (self) => {
                    The.player.cancelPath();
                },
                succeeded: (self, data) => {
                    UI.postMessage("Successfully loaded into character template", MESSAGE_GOOD);

                    if (data.items) {
                        const inventory = player.character.inventory;
                        inventory.clearInventory();
                        data.items.forEach((item) => {
                            const itmRef = Resources.items.list[item.itmres];
                            inventory.addItem(itmRef, item.slot);
                        });
                    }
                },
                failed: () => {
                    UI.postMessage("Failed to load into character template", MESSAGE_BAD);
                }
            }
        },
        {
            typedCommand: 'disable_xp',
            command: CMD_ADMIN_DISABLE_XP,
            requiresAdmin: true,
            description: "/disable_xp : Disable levelling component for player",
            args: [],
            server: (evt, data, self, player) => {
                this.Log(`User disabling levelling component.. What a fool`);
                player.movable.character.charComponent('levelling').enabled = false;
                player.respond(evt.id, true, {});
            },
            client: {
                succeeded: (self, data) => {
                    UI.postMessage("Successfully disabled levelling", MESSAGE_GOOD);
                },
                failed: () => {
                    UI.postMessage("Failed to disabled levelling", MESSAGE_BAD);
                }
            }
        }
    ];

    Resources.commands = Commands;
    return Commands;
});