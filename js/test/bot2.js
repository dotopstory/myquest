// Bot

// Bot class used for testing purposes. This class listens for orders from a test framework

console.log(`Bot Spawned: I am ${process.pid}`);
const filepath = require('path'),
    requirejs  = require('requirejs');

global.__dirname = __dirname; // FIXME: For some reason ErrorReporter  require('path').dirname('')  returns an empty string
const parentDirectory = filepath.dirname(__dirname);

let debugURL = null;

requirejs.config({
    nodeRequire: require,
    baseUrl: parentDirectory,
    paths: {
        lodash: "https://cdn.jsdelivr.net/lodash/4.14.1/lodash.min.js"
    }
});

const exitingGame = () => {
    process.exit();
};

let botName = null;


GLOBAL.DEBUGGER = (msg) => {
    if (!msg) msg = 'Debug: ' + (new Error()).stack.split('\n')[2];
    console.log(msg);
    waitForInspector();
};

const waitForInspector = () => {

    const inspector = require('inspector');
    Log(chalk.red.bold("Waiting for inspector.."));
    inspector.open(9229, "127.0.0.1", true); // port, host, block
    debugger;
};

const errorInGame = (e) => {

    console.error("Error in game");

    console.log(e);
    if (e) {
        waitForInspector();
    }

    if (global['DumpLog']) DumpLog();

    if (botName) {
        console.log(`  I am ${botName}: Entity ${The.player.id}`);
    }

    if (console.trace) console.trace();


    // Error Reporting
    // Report as much as possible
    if (global.ErrorReporter && e) {

        global.ErrorReporter.printStack(e);

        // FIXME: There should be an array or object of items we intend to dump
        const dump = {
            'area': The.area
        };

        global.ErrorReporter.report(e, dump);
    } else {
        console.error("No error reporter yet!");
    }

    //debugger;

    // Just in case the above promises take too long
    setTimeout(() => {
        //process.exit(e);
        Bot.tellMaster('error');
    }, 3000);

    /*
    if (debugURL) {
        const exec = require('child_process').exec;
        const result = exec('/usr/bin/chromium --app ' + debugURL, (error, stdout, stderr) => {
            if (error) {
                console.error(`exec error: ${error}`);
                return;
            }
            console.log(`stdout: ${stdout}`);
            console.log(`stderr: ${stderr}`);
        });

        console.log(result);

        debugger;
    }
    */
};

global.errorInGame = errorInGame;

// If anything happens make sure we go through the common error/exit routine
process.on('exit', exitingGame);
process.on('SIGTERM', exitingGame);
process.on('SIGINT', exitingGame);
process.on('uncaughtException', errorInGame);





const util          = require('util'),
    _               = require('lodash'),
    fs              = require('fs'),        // TODO: Promisify this
    Promise         = require('bluebird'),
    http            = require('http'),
    WebSocket       = require('ws'),
    chalk           = require('chalk'),
    prettyjson      = require('prettyjson'),
    assert          = require('assert'),    // TODO: Disable in production
    SourceMap       = require('source-map');

GLOBAL.util = util;
GLOBAL._ = _;
GLOBAL.Promise = Promise;
GLOBAL.chalk = chalk;
GLOBAL.prettyjson = prettyjson;
GLOBAL.assert = assert;
GLOBAL.WebSocket = WebSocket;
GLOBAL.fs = fs;

GLOBAL.localStorage = (new function(){
    this.setItem = () => {};
    this.getItem = () => undefined;
}());

const Bot = (new function(){

    this.tellMaster = (msg, args) => {
        // NOTE: Its possible that we've lost our connection with the master
        try {
            process.send({msg, args});
        } catch(e) { }
    };

    this.onCommand = (command, callback) => {
        commands[command] = new Command(command, callback);
    };

    const Command = function(cmd, callback) {
        this.cmd = cmd;
        this.callback = callback;
    };

    const commands = {

    };

    process.on('message', (msg) => {
        console.log(msg);
        commands[msg.command].callback(msg);
    });

}());


requirejs(['keys', 'environment'], (Keys, Environment) => {

    // Initialize our environment as the server
    const Env = (new Environment());
    Env.isBot = true;
    GLOBAL.Env = Env;

    requirejs(
        [
            'objectmgr', 'utilities', 'extensions', 'event', 'errors', 'fsm', 'profiler'
        ],
        (
            The, Utils, Ext, Events, Errors, FSM, Profiler
        ) => {

            GLOBAL.Ext = Ext;
            GLOBAL.The = The;
            GLOBAL.Profiler = Profiler;

            GLOBAL.window = GLOBAL;

            // TODO: use Object.assign (when you can upgrade node)
            _.assign(GLOBAL, Utils);
            _.assign(GLOBAL, Events);
            _.assign(GLOBAL, Errors);
            _.assign(GLOBAL, FSM);

            // FIXME: Necessary?
            for(let i = 0; i < FSM['states'].length; ++i) {
                GLOBAL[FSM.states[i]] = i;
            }



            // Load extensions
            // This is our environment context, used to extend loaded classes with their client/server counterpart
            Ext.ready(Ext.CLIENT | Ext.TEST | Ext.CLIENT_TEST).then(() => {


                // Main module
                // This is the starting point for the client. Main is responsible for initializing core modules, loading resources,
                // establishing a connection with the server, and initializing the game
                requirejs(
                    [
                        'errorReporter',
                        'resources', 'loggable', 'profiler',
                        'client/serverHandler', 'client/user', 'client/game'
                    ],
                    (
                        ErrorReporter,
                        Resources, Loggable, Profiler,
                        ServerHandler, User, GameClient
                    ) => {

                        try {

                            extendClass(window).with(Loggable);
                            Log = Log.bind(window);
                            SuppressLogs(true);
                            window.setLogPrefix('Main');


                            /*
                            const errorInGame = (e) => {

                                Log(e, LOG_ERROR);
                                debugger;
                                console.error(e.stack);
                                if (console.trace) console.trace();

                                // FIXME: stop game! unexpected and uncaught error..
                                exitingGame();
                            };
                            */


                            // Assertion
                            // TODO: Find a better way to coordinate with node assertion
                            // TODO: Setup option to disable in production
                            const assert = (expr, message) => {
                                if (!expr) throw Err(message);
                            };


                            window.errorInGame = errorInGame;
                            window.assert      = assert;
                            window.Profiler    = Profiler;


                            // ------------------------------------------------------------------------------------------------------ //
                            // ------------------------------------------------------------------------------------------------------ //



                            const Game = new GameClient();


                            // Module Loading
                            // The game depends on certain modules being loaded and initialized before the game can run.
                            //
                            // Core: Core scripts which need to be initialized before we can begin loading resources. In particular the
                            //          extensions need to be initialized to the local environment (client vs. server). When resources
                            //          begin loading/initializing and are extended with their client/server specific counterpart, they
                            //          depend on the extensions being ready to determine which counterpart to load and extend
                            //
                            // Resources: Scripts and content
                            //
                            // Connection: Setup the server handler and connect to the server
                            //
                            // Initialize: Our core/context is defined, resources have been loaded, a connection has been established,
                            //              we are now free to initialize the game
                            //
                            //
                            // All of this works by keeping track of our loading phase and executing `loading('moduleToLoad')`, then
                            // when the module is ready run `loaded('moduleToLoad')`. This way we can have multiple things loading and
                            // not move to the next phase until we've completed loading everything.
                            //
                            //
                            // TODO: Restructure the module loading to utilize promises
                            // TODO: This code is (mostly) duplicated for both client/server; find a way to better abstract this
                            const modulesToLoad        = {},
                                LOADING_CORE           = 1,
                                LOADING_RESOURCES      = 2,
                                LOADING_CONNECTION     = 3,
                                LOADING_INITIALIZATION = 4;

                            let ready                  = false,
                                loadingPhase           = LOADING_CORE,
                                initializeGame         = null,
                                server                 = null,
                                loadResources          = null,
                                connectToServer        = null,
                                retryConnection        = null,
                                startBot               = null;

                            // Loading a module
                            // Add to the list of modules currently being loaded
                            const loading = (module) => {
                                modulesToLoad[module] = false;
                            };

                            // Loaded a module
                            // Remove from the list of modules currently being loaded. If we have no more modules that we're waiting on
                            // then go to to the next loading phase
                            const loaded = (module) => {
                                if (module) {
                                    if (module in modulesToLoad) {
                                        Log(`Loaded module: ${module}`);
                                        delete modulesToLoad[module];
                                    } else {
                                        Log(`Loaded module which was not previously being loaded: ${module}`, LOG_ERROR);
                                    }
                                }

                                if (ready && _.size(modulesToLoad) === 0) {
                                    ++loadingPhase;
                                    if (loadingPhase === LOADING_RESOURCES) loadResources();
                                    else if (loadingPhase === LOADING_CONNECTION) connectToServer();
                                    else if (loadingPhase === LOADING_INITIALIZATION) initializeGame();
                                }
                            };

                            // Retry loading to the server
                            // FIXME: Currently this isn't working at all
                            retryConnection = () => {

                                loadingPhase = LOADING_RESOURCES;
                                loaded();
                            };

                            // Connection Initialization
                            // Create our server handler and attempt to establish a connection with the server
                            connectToServer = () => {

                                server = new ServerHandler();

                                const link = Env.connection.websocket;

                                server.onDisconnect = () => {
                                    Log("Disconnected from server..");

                                    if (window.hasConnected) {
                                        // Server D/C'd
                                        Disconnected("Server has disconnected", "Please try refreshing the page and starting again", "NOTE: it may take a moment for the server to come back online");
                                    } else {
                                        Disconnected("Server is not online", "Please try coming back later when the server is back online (it usually takes a few seconds)");
                                    }

                                    // TODO: Make a better cleanup routine. It might be worth it to keep a list of modules which need to
                                    // be unhooked and unloaded here. They could be "Registered" to the list when instantiating them
                                    if (The.user) {
                                        The.user.unhookAllHooks();

                                        The.user.unload();
                                        The.area.unload();

                                        Game.disconnected();
                                    }

                                    server.websocket.close();
                                    delete server.websocket; // FIXME: anything else to do for cleanup?

                                    $('.movable-ui').remove();
                                    The.UI.unload();
                                    delete The.UI;

                                    delete The.renderer;

                                    process.exit();
                                };

                                let postLoginCallback = function() {};

                                server.onLogin = (player) => {

                                    Log(`Logged in as player ${player.id}`);

                                    ready = false;

                                    postLoginCallback();
                                    Game.loadedPlayer(player);

                                    Log("Requesting area..");
                                    server.requestArea();
                                    loading('area');
                                    ready = true;
                                };

                                server.onLoginFailed = (evt) => {
                                    postLoginCallback(evt);
                                };

                                server.onInitialization = (evt) => {

                                    Game.initialize(evt, server);
                                    loaded('area');
                                };

                                server.connect(link).then(() => {
                                    // Connected

                                    window.Login = function(username, password, callback) {
                                        server.login(username, password);
                                        postLoginCallback = callback;
                                    };

                                    if (window.hasConnected) {
                                        Login(hasConnected.username, hasConnected.password, (err) => {
                                            hideDisconnected();
                                        });
                                    }

                                    startBot();
                                })
                                .catch((e) => { errorInGame(e); });

                            };

                            // Load game resources
                            loadResources = () => {
                                loading('resources');

                                Resources = (new Resources());
                                window.Resources = Resources;
                                Resources.initialize(['media', 'sheets', 'npcs', 'rules', 'items', 'buffs', 'quests', 'interactions', 'interactables', 'scripts', 'components', 'fx', 'testing']).then((assets) => {
                                    loaded('resources');
                                })
                                .catch((e) => { errorInGame(e); });
                            };

                            // We've begun loading all of our necessary initial modules
                            ready = true;
                            loaded(); // In case initial module somehow loaded INSTANTLY fast


                            // ------------------------------------------------------------------------------------------------------ //
                            // ------------------------------------------------------------------------------------------------------ //

                            // Game Initialization
                            initializeGame = () => {

                                User.initialize();
                                The.user = User;
                                The.bot  = User;

                                Game.onStarted = onGameStarted;
                                Game.start();
                            };

                            let onDied = function(){};

                            const onGameStarted = () => {
                                The.player.character.hook('die', this).after(() => {
                                    onDied();
                                });

                                botIsReady();

                                // FIXME: Game extension (need to run _init)
                                Game.oink();
                            };

                            let whenReadySucceeded = function(){},
                                botHasFailed       = function(){};

                            const botIsReady = function(){
                                    whenReadySucceeded();
                                };

                            const whenReady = function(finished, failed){
                                whenReadySucceeded = finished;
                                botHasFailed = failed;
                            };



                            // Bot Message System
                            startBot = () => {

                                let bot = null,
                                    username = null,
                                    password = null;

                                Bot.onCommand(BOT_CONNECT, ({username, password}) => {

                                    Login(username, password, function(err){
                                        if (err) {
                                            Bot.tellMaster('nologin');
                                        } else {
                                            whenReady(() => {
                                                Bot.tellMaster('started');
                                            }, () => {
                                                Bot.tellMaster('nostart');
                                            });
                                            Bot.tellMaster('connected');
                                        }
                                    });

                                    botName = username;
                                });
                                
                                Bot.onCommand(BOT_SIGNUP, ({username, password, email, spawn}) => {

                                        var options = {
                                            hostname: '127.0.0.1',
                                            port: 8124,
                                            path: '/?request='+REQ_REGISTER+'&username='+username+'&password='+password+'&email='+email
                                        };

                                        if (spawn) {
                                            options.path += '&spawnArea='+spawn.area;
                                            options.path += '&spawnPosition=x:'+spawn.position.x+',y:'+spawn.position.y;
                                        }

                                        var req = http.request(options, function(res){

                                            var response = '';
                                            res.on('data', function(data){
                                                response += data;
                                            });

                                            res.on('end', function(){
                                                var reply = JSON.parse(response);

                                                if (!reply || !_.isObject(reply)) {
                                                    Bot.tellMaster('nosignup');
                                                    return;
                                                }

                                                if (reply.success != true) {
                                                    Bot.tellMaster('nosignup');
                                                    return;
                                                }

                                                Bot.tellMaster('signedup', {username, password});
                                            });

                                        }).end();

                                });
                                
                                Bot.onCommand(BOT_MOVE, ({tile}) => {
                                    Log(`I've been ordered to move to ${tile.x}, ${tile.y}`);
                                        The.bot.clickedTile(new Tile(tile.x, tile.y));

                                        setTimeout(function(){
                                            if (The.player.path) {
                                                The.player.path.onFinished = function(){
                                                    Bot.tellMaster('finished');
                                                };
                                                The.player.path.onFailed = function(){
                                                    Bot.tellMaster('failedpath');
                                                };
                                            } else {
                                                Bot.tellMaster('badpath');
                                            }
                                        }, 100);
                                });

                                Bot.onCommand(BOT_INQUIRE, ({detail}) => {

                                    if (detail === INQUIRE_MAP) {
                                        let map = Game.getMapName();
                                        Bot.tellMaster('response', { map });
                                    }
                                });

                                Bot.onCommand(BOT_SET_DEBUGURL, ({detail}) => {
                                    debugURL = detail.debugURL;
                                    Log(`My debugURL is now: ${debugURL}`);
                                });


                                Bot.tellMaster('ready');

                                onDied = () => {
                                    Bot.tellMaster('ondied');
                                };
                            };


                        } catch (e) {
                            console.log("TEST TEST HERE");
                            console.error(e.stack);
                        }
                    });

            })
            .catch((e) => { errorInGame(e); });
        });
});
