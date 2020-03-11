const admin = require("./music/admin");
const db = require("./music/database");
const printCommands = require("./printCommands");
const copypastas = require("./copypastas");
const Discord = require("discord.js");
const logger = require("winston");
const auth = require("./auth.json");
const key = require("./client_secret.json");
const config = require("./config.json");

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
bot.on("ready", async () => {
  await db.authBot(bot.user.id);

  console.log("Getting guild data...");
  admin.youtubeKey.push(auth.youtubeKey);
  bot.guilds.forEach((guild) => {
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
bot.login(auth.token).then();

bot.on("message", async (message) => {
  if (message.author.bot) return; // Prevents bot from activating its self
  try {
    const serverQueue = admin.queue.get(message.guild.id);

    // If message starts with !
    if (
      message.content.substring(0, 1) === config.prefix ||
      message.content.substring(0, 1) === "!"
    ) {
      // Split message into parts, excluding prefix
      let args = message.content.substring(1).split(" ");
      let cmd = args[0].toLowerCase();

      switch (cmd) {
        case "sayori":
          await message.channel.send("<:hangingsayori:665410228673839104>");
          break;
        case "commands":
          await message.channel.send("I'll break your nico-nico knees");
          // printCommands.printCommands(message);
          break;
        case "add":
          await message.channel.send("I'll break your nico-nico knees");
          // add.addSong(message, serverQueue);
          break;
        case "remove":
          await message.channel.send("I'll break your nico-nico knees");
          // queueController.remove(message, serverQueue);
          break;
        case "shift":
          await message.channel.send("I'll break your nico-nico knees");
          // queueController.shift(message, serverQueue);
          break;
        case "shuffle":
          await message.channel.send("I'll break your nico-nico knees");
          // queueController.shuffle(message, serverQueue);
          break;
        case "pause":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.pause(message, serverQueue);
          break;
        case "search":
          await message.channel.send("I'll break your nico-nico knees");
          // search.searchSong(message);
          break;
        case "select":
          await message.channel.send("I'll break your nico-nico knees");
          // select.selectSong(message, serverQueue);
          break;
        case "play":
        case "resume":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.resume(message, serverQueue);
          break;
        case "skip":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.skip(
          //   admin.loop.get(message.guild.id),
          //   admin.serverVolumes.get(message.guild.id),
          //   message,
          //   serverQueue
          // );
          break;
        case "stop":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.stop(admin.loop.get(message.guild.id), message, serverQueue);
          break;
        case "now":
        case "current":
        case "song":
          await message.channel.send("I'll break your nico-nico knees");
          // display.current(message, serverQueue);
          break;
        case "next":
        case "nextsong":
          await message.channel.send("I'll break your nico-nico knees");
          // display.next(message, serverQueue);
          break;
        case "list":
          // display.list(message, serverQueue);
          break;
        case "volume":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.changeVolume(admin.serverVolumes, message, serverQueue);
          break;
        case "loop":
          await message.channel.send("I'll break your nico-nico knees");
          // playback.toggleLoop(message);
          break;
        default:
          await message.channel.send("Sorry, I don't know that command...");
          break;
      }
    } else {
      if (
        message.content.match(/sayori/i) &&
        message.content.search("hanging") == -1
      ) {
        await message.channel.send("<:hangingsayori:665410228673839104>");
      } else if (
        (message.content.match(/best/i) && message.content.match(/girl/i)) ||
        await message.content.match(/bestgirl/i)
      ) {
        await message.channel.send("<:JustMonika:664559827342852101>");
      } else if (message.content.match(/dnd/i)) {
        const index = Math.floor(Math.random() * 6);
        switch (index) {
          case 0:
            await message.channel.send(copypastas.ankles);
            break;
          case 1:
            await message.channel.send(copypastas.dva);
            break;
          case 2:
            await message.channel.send(copypastas.delete);
            break;
          case 3:
            await message.channel.send(copypastas.milk);
            break;
          case 4:
            await message.channel.send(copypastas.brap);
            break;
          case 5:
            await message.channel.send(undefined, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
        }
      } else if (message.content.match(/ankles/i)) {
        await message.channel.send(copypastas.ankles);
      } else if (message.content.match(/dva/i)) {
        await message.channel.send(copypastas.dva);
      } else if (message.content.match(/delete/i)) {
        await message.channel.send(copypastas.delete);
      } else if (message.content.match(/milk/i)) {
        await message.channel.send(copypastas.milk);
      } else if (message.content.match(/girl/i)) {
        await message.channel.send("<:alexiscoming:677231662173519873>");
      } else if (message.content.match(/smell/i)) {
        await message.channel.send(copypastas.brap, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
      } else if (message.content.match(/brap/i) || message.content.match(/fart/i)) {
        await message.channel.send(copypastas.brap, { files: ["https://i.redd.it/kk51ksap2ye31.png"] })
      } else if (message.content.match(/mom/i)) {
        await message.channel.send("", { files: ["./gifs/mom.gif"] })
      }
    }
  } catch (err) {
    console.error(err);
  }
});
