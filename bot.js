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
    db.getQueue(guild.id, voiceChannel);
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
          message.channel.send("I'll break your nico-nico knees");
          // printCommands.printCommands(message);
          break;
        case "add":
          message.channel.send("I'll break your nico-nico knees");
          // add.addSong(message, serverQueue);
          break;
        case "remove":
          message.channel.send("I'll break your nico-nico knees");
          // queueController.remove(message, serverQueue);
          break;
        case "shift":
          message.channel.send("I'll break your nico-nico knees");
          // queueController.shift(message, serverQueue);
          break;
        case "shuffle":
          message.channel.send("I'll break your nico-nico knees");
          // queueController.shuffle(message, serverQueue);
          break;
        case "pause":
          message.channel.send("I'll break your nico-nico knees");
          // playback.pause(message, serverQueue);
          break;
        case "search":
          message.channel.send("I'll break your nico-nico knees");
          // search.searchSong(message);
          break;
        case "select":
          message.channel.send("I'll break your nico-nico knees");
          // select.selectSong(message, serverQueue);
          break;
        case "play":
        case "resume":
          message.channel.send("I'll break your nico-nico knees");
          // playback.resume(message, serverQueue);
          break;
        case "skip":
          message.channel.send("I'll break your nico-nico knees");
          // playback.skip(
          //   admin.loop.get(message.guild.id),
          //   admin.serverVolumes.get(message.guild.id),
          //   message,
          //   serverQueue
          // );
          break;
        case "stop":
          message.channel.send("I'll break your nico-nico knees");
          // playback.stop(admin.loop.get(message.guild.id), message, serverQueue);
          break;
        case "now":
        case "current":
        case "song":
          message.channel.send("I'll break your nico-nico knees");
          // display.current(message, serverQueue);
          break;
        case "next":
        case "nextsong":
          message.channel.send("I'll break your nico-nico knees");
          // display.next(message, serverQueue);
          break;
        case "list":
          // display.list(message, serverQueue);
          break;
        case "volume":
          message.channel.send("I'll break your nico-nico knees");
          // playback.changeVolume(admin.serverVolumes, message, serverQueue);
          break;
        case "loop":
          message.channel.send("I'll break your nico-nico knees");
          // playback.toggleLoop(message);
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
        const index = Math.floor(Math.random() * 6);
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
          case 4:
            message.channel.send(copypastas.brap);
            break;
          case 5:
            message.channel.send(undefined, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
        }
      } else if (message.content.match(/ankles/i)) {
        message.channel.send(copypastas.ankles);
      } else if (message.content.match(/dva/i)) {
        message.channel.send(copypastas.dva);
      } else if (message.content.match(/delete/i)) {
        message.channel.send(copypastas.delete);
      } else if (message.content.match(/milk/i)) {
        message.channel.send(copypastas.milk);
      } else if (message.content.match(/girl/i)) {
        message.channel.send("<:alexiscoming:677231662173519873>");
      } else if (message.content.match(/smell/i)) {
        message.channel.send(copypastas.brap, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
      } else if (message.content.match(/brap/i) || message.content.match(/fart/i)) {
        message.channel.send(copypastas.brap, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
      }
    }
  } catch (err) {
    console.error(err);
  }
});
