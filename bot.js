const playback = require("./music/playback");
const display = require("./music/display");
const queueController = require("./music/queue_control");
const admin = require("./music/admin");
const search = require("./music/search");
const select = require("./music/select");
const add = require("./music/add");
const play = require("./music/play");
const db = require("./music/database");
const printCommands = require("./printCommands");
const copypastas = require("./copypastas");
const Discord = require("discord.js");
const logger = require("winston");
const auth = require("./auth.json");
const config = require("./config.json");
// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");
// Add the Firebase products that you want to use
require("firebase/firestore");

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});

logger.level = "debug";
// Initialize Discord Bot
var bot = new Discord.Client();
// Update DB whenever user joins/leaves VC
bot.on("voiceStateUpdate", (oldMember, newMember) => {
  if (newMember.user.bot) return;
  if (
    newMember.voiceChannel &&
    newMember.voiceChannel != oldMember.voiceChannel
  ) {
    console.log(newMember.displayName + " has joined the VC!");
    db.pushUser(newMember.guild.id, newMember);
  } else if (
    oldMember.voiceChannel &&
    newMember.voiceChannel != oldMember.voiceChannel
  ) {
    console.log(oldMember.displayName + " has left the VC...");
    db.popUser(oldMember.guild.id, oldMember.id);
  } else {
    db.pushUser(newMember.guild.id, newMember);
  }
});

// When bot is ready, print to console
bot.on("ready", () => {
  admin.youtubeKey.push(auth.youtubeKey);
  bot.guilds.forEach((guild) => {
    const queueRef = db.getQueueRef(guild.id);
    const controllerRef = db.getControllerRef(guild.id);
    var queueObserver = admin.queueObservers.get(guild.id);
    admin.loop.set(guild.id, 0);
    admin.shuffleMode.set(guild.id, false);
    admin.pauseState.set(guild.id, false);
    var musicChannel;
    var voiceChannel;
    guild.channels.forEach((channel) => {
      if (channel.name == "music" && channel.type == "text") {
        musicChannel = channel;
      }
      if (channel.type == "voice") {
        voiceChannel = channel;
      }
    });

    if (!queueObserver) {
      queueObserver = queueRef.onSnapshot(async (doc) => {
        try {
          var serverQueue = admin.queue.get(guild.id);
          var init = false;
          if (!serverQueue) {
            init = true;
            const queueContruct = {
              textChannel: musicChannel,
              voiceChannel: voiceChannel,
              connection: null,
              songs: [],
              volume: 5,
              playing: true
            };
            // Setting the queue using our contract
            serverQueue = queueContruct;
            try {
              // Here we try to join the voicechat and save our connection into our object.
              var connection = await voiceChannel.join();
              queueContruct.connection = connection;
            } catch (err) {
              // Printing the error message if the bot fails to join the voicechat
              console.log(err);
            }
            admin.queue.set(guild.id, serverQueue);
          }
          const dbQueue = doc.data() ? doc.data().queue : [];
          var songShift = true;
          var i = 0;
          // checks if song is missing from db (need to remove)
          for (let a of serverQueue.songs) {
            var found = false;
            for (let b of dbQueue) {
              if (a.id == b.id) {
                found = true;
                break;
              }
            }
            if (!found) {
              if (i == 0) {
                if (serverQueue) {
                  if (admin.loop.get(guild.id) == 2) {
                    admin.loop.set(guild.id, 1);
                  }
                  serverQueue.connection.dispatcher.end();
                  if (serverQueue.connection.dispatcher) {
                    serverQueue.connection.dispatcher.setVolumeLogarithmic(
                      admin.serverVolumes.get(guild.id) / 50
                    );
                  }
                }
              } else {
                var removed = serverQueue.songs.splice(i, 1)[0];
                console.log(removed);
              }
              songShift = false;
            } else {
              i++;
            }
          }
          //checks if song is missing from server (need to add)
          for (let b of dbQueue) {
            i = 0;
            var found = false;
            for (let a of serverQueue.songs) {
              if (a.id == b.id) {
                found = true;
                break;
              }
              i++;
            }
            if (!found) {
              serverQueue.songs.splice(i, 0, b);
              songShift = false;
            }
          }
          if (songShift) {
            serverQueue.songs = dbQueue;
          }
          if (init) {
            // Calling the play function to start a song
            admin.queue.set(guild.id, serverQueue);
            play.dbPlaySong(musicChannel, serverQueue);
          }
        } catch (err) {
          console.error(err);
        }
      });
      admin.queueObservers.set(guild.id, queueObserver);
    }

    var volume = admin.serverVolumes.get(guild.id);
    if (!volume) {
      admin.serverVolumes.set(guild.id, 7);
      volume = 7;
    }

    var controllerObserver = admin.controllerObservers.get(guild.id);
    if (!controllerObserver) {
      controllerObserver = controllerRef.onSnapshot((doc) => {
        try {
          const dbController = doc.data();
          const id = guild.id;
          const serverQueue = admin.queue.get(id);
          var volume = admin.serverVolumes.get(id);
          if (dbController) {
            //check for differences
            if (dbController.volume != volume) {
              volume = dbController.volume;
              admin.serverVolumes.set(guild.id, volume);
              if (serverQueue && serverQueue.connection) {
                const dispatcher = serverQueue.connection.dispatcher;
                dispatcher.setVolumeLogarithmic(volume / 50);
                musicChannel.send("Volume: " + volume);
              }
            }
            if (dbController.shuffleMode != admin.shuffleMode.get(guild.id)) {
              admin.shuffleMode.set(guild.id, dbController.shuffleMode);
              if (admin.shuffleMode.get(guild.id)) {
                musicChannel.send("Now in shuffle mode!");
              } else {
                musicChannel.send("No longer in shuffle mode.... :frowning:");
              }
            }
            if (dbController.loop != admin.loop.get(guild.id)) {
              var loop = dbController.loop;
              admin.loop.set(guild.id, loop);
              switch (loop) {
                case 0:
                  musicChannel.send("No longer looping!");
                  break;
                case 1:
                  musicChannel.send("Now looping queue!");
                  break;
                case 2:
                  musicChannel.send("Now looping song!");
                  break;
              }
            }
            if (dbController.pauseState != admin.pauseState.get(guild.id)) {
              if (!serverQueue || !serverQueue.connection) {
                admin.pauseState.set(guild.id, dbController.pauseState);
              } else {
                if (dbController.pauseState) {
                  if (serverQueue.connection) {
                    admin.pauseState.set(guild.id, true);
                    serverQueue.connection.dispatcher.pause();
                    musicChannel.send("Paused!");
                  }
                } else {
                  if (serverQueue.connection) {
                    admin.pauseState.set(guild.id, false);
                    serverQueue.connection.dispatcher.resume();
                    musicChannel.send("Resuming!");
                  }
                }
              }
            }
          } else {
            //upload controller
            controllerRef.set({
              volume: admin.serverVolumes.get(guild.id),
              shuffleMode: admin.shuffleMode.get(guild.id),
              loop: admin.loop.get(guild.id),
              pauseState: false
            });
          }
        } catch (err) {
          console.error(err);
        }
      });
      admin.controllerObservers.set(guild.id, controllerObserver);
    }
  });

  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.user.tag);
});

// Log bot in using token
bot.login(auth.token);

bot.on("message", (message) => {
  if (message.author.bot) return; // Prevents bot from activating its self
  try {
    const serverQueue = admin.queue.get(message.guild.id);

    // If message starts with !
    if (
      message.content.substring(0, 1) == config.prefix ||
      message.content.substring(0, 1) === "!"
    ) {
      // Split message into parts, excluding prefix
      var args = message.content.substring(1).split(" ");
      var cmd = args[0].toLowerCase();

      switch (cmd) {
        case "sayori":
          message.channel.send("<:hangingsayori:665410228673839104>");
          break;
        case "commands":
          printCommands.printCommands(message);
          break;
        case "add":
          add.addSong(message, serverQueue);
          break;
        case "remove":
          queueController.remove(message, serverQueue);
          break;
        case "shift":
          queueController.shift(message, serverQueue);
          break;
        case "shuffle":
          if (args[1] && args[1] === "mode") {
            queueController.toggleShuffle(message);
          } else {
            queueController.shuffle(message, serverQueue);
          }
          break;
        case "pause":
          playback.pause(message, serverQueue);
          break;
        case "search":
          search.searchSong(message);
          break;
        case "select":
          select.selectSong(message, serverQueue);
          break;
        case "play":
        case "resume":
          playback.resume(message, serverQueue);
          break;
        case "skip":
          playback.skip(
            admin.loop.get(message.guild.id),
            admin.serverVolumes.get(message.guild.id),
            message,
            serverQueue
          );
          break;
        case "stop":
          playback.stop(admin.loop.get(message.guild.id), message, serverQueue);
          break;
        case "now":
        case "current":
        case "song":
          display.current(message, serverQueue);
          break;
        case "next":
        case "nextsong":
          display.next(message, serverQueue);
          break;
        case "list":
          display.list(message, serverQueue);
          break;
        case "volume":
          playback.changeVolume(admin.serverVolumes, message, serverQueue);
          break;
        case "loop":
          playback.toggleLoop(message);
          break;
        default:
          message.channel.send("Sorry, I don't know that command...");
          break;
      }
    } else {
      if (
        message.content.match(/sayori/i) &&
        message.content.search("hanging") == -1
      ) {
        message.channel.send("<:hangingsayori:665410228673839104>");
      } else if (
        (message.content.match(/best/i) && message.content.match(/girl/i)) ||
        message.content.match(/bestgirl/i)
      ) {
        message.channel.send("<:JustMonika:664559827342852101>");
      } else if (message.content.match(/dnd/i)) {
        const index = Math.floor(Math.random() * 4);
        switch (index) {
          case 0:
            message.channel.send(copypastas.ankles);
            break;
          case 1:
            message.channel.send(copypastas.dva);
            break;
          case 2:
            message.channel.send(copypastas.delete);
            break;
          case 3:
            message.channel.send(copypastas.milk);
            break;
        }
      } else if (message.content.match(/ankles/i)) {
        message.channel.send(copypastas.ankles);
      } else if (message.content.match(/dva|d.va/i)) {
        message.channel.send(copypastas.dva);
      } else if (message.content.match(/delete/i)) {
        message.channel.send(copypastas.delete);
      } else if (message.content.match(/milk/i)) {
        message.channel.send(copypastas.milk);
      } else if (message.content.match(/girl/i)) {
        message.channel.send("<:alexiscoming:677292205865566224>");
      }
    }
  } catch (err) {
    console.error(err);
  }
});
