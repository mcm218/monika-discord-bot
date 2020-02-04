const playback = require("./music/playback");
const display = require("./music/display");
const queueController = require("./music/queue_control");
const validUrl = require("./validUrl");
const printCommands = require("./printCommands");
const Discord = require("discord.js");
const logger = require("winston");
const auth = require("./auth.json");
const config = require("./config.json");
const ytdl = require("ytdl-core");
var { google } = require("googleapis");
// Firebase App (the core Firebase SDK) is always required and
// must be listed before other Firebase SDKs
var firebase = require("firebase/app");

// Add the Firebase products that you want to use
require("firebase/firestore");

// Initialize Firebase
var firebaseConfig = auth.firebaseConfig;
firebase.initializeApp(firebaseConfig);

let db = firebase.firestore();

const queue = new Map();
var searchList = [];
const loop = [];
// 0 - no looping
// 1 - queue looping
// 2 - song looping
const shuffleMode = [];
var serverVolumes = new Map();
const youtubeKey = auth.youtubeKey;

// Configure logger settings
logger.remove(logger.transports.Console);
logger.add(new logger.transports.Console(), {
  colorize: true
});

logger.level = "debug";
// Initialize Discord Bot
var bot = new Discord.Client();

// When bot is ready, print to console
bot.on("ready", () => {
  logger.info("Connected");
  logger.info("Logged in as: ");
  logger.info(bot.user.tag);
  loop.push(0);
  shuffleMode.push(false);
});

// Log bot in using token
bot.login(auth.token);

bot.on("message", (message) => {
  if (message.author.bot) return; // Prevents bot from activating its self
  try {
    const serverQueue = queue.get(message.guild.id);
    var volume = serverVolumes.get(message.guild.id);
    if (!volume) {
      serverVolumes.set(message.guild.id, 7);
      volume = 7;
    }
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
          addSong(message, serverQueue);
          break;
        case "remove":
          queueController.remove(message, serverQueue);
          break;
        case "shift":
          queueController.shift(message, serverQueue);
          break;
        case "shuffle":
          if (args[1] && args[1] === "mode") {
            queueController.toggleShuffle(shuffleMode, message);
          } else {
            queueController.shuffle(message, serverQueue);
          }
          break;
        case "pause":
          playback.pause(message, serverQueue);
          break;
        case "search":
          searchSong(message, serverQueue);
          break;
        case "select":
          selectSong(message, serverQueue);
          break;
        case "play":
          playback.resume(message, serverQueue);
          break;
        case "skip":
          playback.skip(loop[0], volume, message, serverQueue);
          break;
        case "stop":
          playback.stop(loop[0], message, serverQueue);
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
          playback.changeVolume(serverVolumes, message, serverQueue);
          break;
        case "loop":
          playback.toggleLoop(loop, message);
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
      }
    }
  } catch (err) {
    console.error(err);
  }
});

async function searchSong(message, serverQueue) {
  const args = message.content.split(" ");
  var maxResults = 5;
  try {
    if (!args[1]) {
      return message.channel.send("```!search name```");
    }
    var service = google.youtube("v3");
    var search = args[1];
    for (var i = 2; i < args.length; i++) {
      search += "+";
      search += args[i];
    }
    var id;
    var docs;
    await db
      .collection("searches/videos/" + search)
      .get()
      .then((snapshots) => {
        docs = snapshots.docs;
        if (snapshots.docs[0]) id = snapshots.docs[0].data().id.videoId;
      });
    if (id) {
      console.log("Skipped search!");
      var songs = [];
      for (let doc of docs) {
        const url = "https://www.youtube.com/watch?v=" + doc.data().id.videoId;
        const songInfo = await ytdl.getInfo(url);
        songs.push({
          title: songInfo.title,
          url: songInfo.video_url
        });
      }
      searchList = songs;
      display.displaySearchList(searchList, message);
    } else {
      // Search Youtube for video
      service.search.list(
        {
          auth: youtubeKey,
          part: "snippet",
          type: "video",
          maxResults: maxResults,
          q: search
        },
        async function(err, response) {
          if (err) {
            console.log(err);
            if (err.code == 403 || err.code == 429) {
              youtubeKey = auth.backupKey;
              message.channel.send(
                "Quota reached, switching to backup key...\n Try again!"
              );
            }
            return;
          }
          var results = response.data.items;
          var songs = [];
          for (let i = 0; i < results.length; i++) {
            db.collection("searches/videos/" + search)
              .doc(i.toString())
              .set(results[i]);
            const url =
              "https://www.youtube.com/watch?v=" + results[i].id.videoId;
            const songInfo = await ytdl.getInfo(url);
            songs.push({
              title: songInfo.title,
              url: songInfo.video_url
            });
          }
          searchList = songs;
          display.displaySearchList(searchList, message);
        }
      );
    }
  } catch (err) {
    console.error(err);
  }
}

async function selectSong(message, serverQueue) {
  try {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voiceChannel;

    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to play music!"
      );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send(
        "I need permissions to join and speak in your voice channel!"
      );
    }
    if (!args[1]) {
      message.channel.send("```!select id```");
      return;
    }
    if (args[1] > searchList.length) {
      message.channel.send("Invalid selection");
      display.displaySearchList(searchList, message);
      return;
    }
    const song = searchList[args[1]];

    if (!serverQueue) {
      // Creating the contract for our queue
      const queueContruct = {
        textChannel: message.channel,
        voiceChannel: voiceChannel,
        connection: null,
        songs: [],
        volume: 5,
        playing: true
      };
      // Setting the queue using our contract
      queue.set(message.guild.id, queueContruct);
      // Pushing the song to our songs array
      queueContruct.songs.push(song);

      try {
        // Here we try to join the voicechat and save our connection into our object.
        var connection = await voiceChannel.join();
        queueContruct.connection = connection;
        // Calling the play function to start a song
        playSong(message, queueContruct.songs[0]);
      } catch (err) {
        // Printing the error message if the bot fails to join the voicechat
        console.log(err);
        queue.delete(message.guild.id);
        return message.channel.send(err);
      }
    } else {
      if (shuffleMode[0] && serverQueue.songs.length > 1) {
        const index =
          Math.floor(Math.random() * (serverQueue.songs.length - 2)) + 1;
        serverQueue.songs.splice(index, 0, song);
      } else {
        serverQueue.songs.push(song);
      }
      var num = !serverQueue ? 0 : serverQueue.songs.length - 1;
      return message.channel.send(
        `${num} - ${song.title} has been added to the queue!`
      );
    }
  } catch (err) {
    console.error(err);
  }
}

async function addSong(message, serverQueue) {
  try {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voiceChannel;

    if (!voiceChannel)
      return message.channel.send(
        "You need to be in a voice channel to play music!"
      );
    const permissions = voiceChannel.permissionsFor(message.client.user);
    if (!permissions.has("CONNECT") || !permissions.has("SPEAK")) {
      return message.channel.send(
        "I need permissions to join and speak in your voice channel!"
      );
    }
    if (!args[1]) {
      message.channel.send("```!add name```");
      return message.channel.send("```!add url```");
    }
    if (args[1].toLowerCase() === "playlist") {
      if (args.length < 3)
        return message.channel.send("```!add playlist [playlist name]```");
      var service = google.youtube("v3");
      var search = args[2];
      for (var i = 3; i < args.length; i++) {
        search += "+";
        search += args[i];
      }
      var id;
      await db
        .collection("searches/playlists/" + search)
        .get()
        .then((snapshots) => {
          if (snapshots.docs[0]) id = snapshots.docs[0].data().id.playlistId;
        });
      if (id) {
        console.log("Skipped search!");
        var service = google.youtube("v3");
        service.playlistItems.list(
          {
            auth: youtubeKey,
            maxResults: 50,
            part: "snippet",
            playlistId: id
          },
          async (err, response) => {
            if (err) {
              console.log(err);
              if (err.code == 403 || err.code == 429) {
                youtubeKey = auth.backupKey;
                message.channel.send(
                  "Quota reached, switching to backup key...\n Try again!"
                );
              }
              return;
            }
            var results = response.data.items;
            // Send songs in batches of 5
            var formattedMessage = "";
            let i = 0;
            for (let result of results) {
              serverQueue = queue.get(message.guild.id);
              var url =
                "https://www.youtube.com/watch?v=" +
                result.snippet.resourceId.videoId;
              formattedMessage += await addSongToQueue(
                url,
                message,
                serverQueue,
                voiceChannel
              );
              formattedMessage += "\n";
              i++;
              if (!shuffleMode[0] && i == 5) {
                i = 0;
                message.channel.send(formattedMessage);
                formattedMessage = "";
              }
            }
            if (!shuffleMode[0] && i != 0) {
              message.channel.send(formattedMessage);
            }
            if (shuffleMode[0]) {
              display.list(message, serverQueue);
            }
          }
        );
      } else {
        service.search.list(
          {
            auth: youtubeKey,
            type: "playlist",
            maxResults: 1,
            part: "snippet",
            q: search
          },
          (err, response) => {
            if (err) {
              console.log(err);
              if (err.code == 403 || err.code == 429) {
                youtubeKey = auth.backupKey;
                message.channel.send(
                  "Quota reached, switching to backup key...\n Try again!"
                );
              }
              return;
            }
            var results = response.data.items[0];
            db.collection("searches/playlists/" + search)
              .doc("0")
              .set(results);
            var service = google.youtube("v3");
            var id = results.id.playlistId;
            service.playlistItems.list(
              {
                auth: youtubeKey,
                maxResults: 50,
                part: "snippet",
                playlistId: id
              },
              async (err, response) => {
                if (err) {
                  console.log(err);
                  if (err.code == 403 || err.code == 429) {
                    youtubeKey = auth.backupKey;
                    message.channel.send(
                      "Quota reached, switching to backup key...\n Try again!"
                    );
                  }
                  return;
                }
                var results = response.data.items;
                // Send songs in batches of 5
                var formattedMessage = "";
                let i = 0;
                for (let result of results) {
                  serverQueue = queue.get(message.guild.id);
                  var url =
                    "https://www.youtube.com/watch?v=" +
                    result.snippet.resourceId.videoId;
                  formattedMessage += await addSongToQueue(
                    url,
                    message,
                    serverQueue,
                    voiceChannel
                  );
                  formattedMessage += "\n";
                  i++;
                  if (!shuffleMode[0] && i == 5) {
                    i = 0;
                    message.channel.send(formattedMessage);
                    formattedMessage = "";
                  }
                }
                if (!shuffleMode[0] && i != 0) {
                  message.channel.send(formattedMessage);
                }
                if (shuffleMode[0]) {
                  display.list(message, serverQueue);
                }
              }
            );
          }
        );
      }
    } else if (!validUrl.validURL(args[1])) {
      var service = google.youtube("v3");
      var search = args[1];
      for (var i = 2; i < args.length; i++) {
        search += "+";
        search += args[i];
      }
      var id;
      await db
        .collection("searches/videos/" + search)
        .get()
        .then((snapshots) => {
          if (snapshots.docs[0]) id = snapshots.docs[0].data().id.videoId;
        });
      if (id) {
        console.log("Skipped search!");
        var url = "https://www.youtube.com/watch?v=" + id;
        return message.channel.send(
          await addSongToQueue(url, message, serverQueue, voiceChannel)
        );
      } else {
        // Search Youtube for video
        service.search.list(
          {
            auth: youtubeKey,
            type: "video",
            maxResults: 5,
            part: "snippet",
            q: search
          },
          async (err, response) => {
            if (err) {
              console.log(err);
              if (err.code == 403 || err.code == 429) {
                youtubeKey = auth.backupKey;
                message.channel.send(
                  "Quota reached, switching to backup key...\n Try again!"
                );
              }
              return;
            }
            var results = response.data.items;
            var i = 0;
            for (let result of results) {
              db.collection("searches/videos/" + search)
                .doc(i.toString())
                .set(result);
              i++;
            }
            var url =
              "https://www.youtube.com/watch?v=" + results[0].id.videoId;
            return message.channel.send(
              await addSongToQueue(url, message, serverQueue, voiceChannel)
            );
          }
        );
      }
    } else {
      return message.channel.send(
        await addSongToQueue(args[1], message, serverQueue, voiceChannel)
      );
    }
  } catch (err) {
    console.log(err);
  }
}

async function addSongToQueue(videoUrl, message, serverQueue, voiceChannel) {
  const songInfo = await ytdl.getInfo(videoUrl);
  const song = {
    title: songInfo.title,
    url: songInfo.video_url
  };
  if (!serverQueue) {
    // Creating the contract for our queue
    const queueContruct = {
      textChannel: message.channel,
      voiceChannel: voiceChannel,
      connection: null,
      songs: [],
      volume: 5,
      playing: true
    };
    // Setting the queue using our contract
    queue.set(message.guild.id, queueContruct);
    // Pushing the song to our songs array
    queueContruct.songs.push(song);

    try {
      // Here we try to join the voicechat and save our connection into our object.
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      // Calling the play function to start a song
      playSong(message, queueContruct.songs[0]);
    } catch (err) {
      // Printing the error message if the bot fails to join the voicechat
      console.log(err);
      queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    if (shuffleMode[0] && serverQueue.songs.length > 1) {
      const index =
        Math.floor(Math.random() * (serverQueue.songs.length - 2)) + 1;
      serverQueue.songs.splice(index, 0, song);
    } else {
      serverQueue.songs.push(song);
    }
  }
  var num = !serverQueue ? 0 : serverQueue.songs.length - 1;
  return `${num} - ${song.title} has been added to the queue!`;
}

function playSong(message, song) {
  const serverQueue = queue.get(message.guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    queue.delete(message.guild.id);
    return;
  }
  console.log(song.title);
  const dispatcher = serverQueue.connection
    .playStream(ytdl(song.url))
    .on("end", () => {
      console.log("Music ended!");
      switch (loop[0]) {
        case 0: // no looping
          serverQueue.songs.shift();
          break;
        case 1: // queue looping
          serverQueue.songs.push(serverQueue.songs[0]);
          serverQueue.songs.shift();
          break;
        case 2: // song looping
          break;
      }
      display.current(message, serverQueue);
      playSong(message, serverQueue.songs[0]);
    })
    .on("error", (error) => {
      console.error(error);
    });
  const volume = serverVolumes.get(message.guild.id);
  dispatcher.setVolumeLogarithmic(volume / 50);
}
