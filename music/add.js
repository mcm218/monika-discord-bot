const db = require("./database");
const auth = require("../auth.json");
const validUrl = require("../validUrl");
const admin = require("./admin");
const ytdl = require("ytdl-core");
const play = require("./play");
const display = require("./display");
var { google } = require("googleapis");

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

    // Playlist Add using Search
    if (args[1].toLowerCase() === "playlist" && !validUrl.validURL(args[2])) {
      if (args.length < 3)
        return message.channel.send("```!add playlist [playlist name]```");
      var service = google.youtube("v3");
      var search = args[2].toLowerCase();
      for (var i = 3; i < args.length; i++) {
        search += "+";
        search += args[i];
      }
      var id = await db.getSearchSingle(true, search);
      // Search Query already in DB
      if (id) {
        var service = google.youtube("v3");
        service.playlistItems.list(
          {
            auth: admin.youtubeKey[0],
            maxResults: 50,
            part: "snippet",
            playlistId: id
          },
          async (err, response) => {
            if (err) {
              console.log(err);
              quotaError(err, admin.youtubeKey);
              return;
            }
            var results = response.data.items;
            playlistAdd(results, message, serverQueue);
          }
        );
        // Search Query using Youtube
      } else {
        service.search.list(
          {
            auth: admin.youtubeKey[0],
            type: "playlist",
            maxResults: 5,
            part: "snippet",
            q: search
          },
          (err, response) => {
            if (err) {
              console.log(err);
              quotaError(err, admin.youtubeKey);
              return;
            }
            var results = response.data.items;
            db.pushSearch(true, search, results);

            var service = google.youtube("v3");
            var id = results[0].id.playlistId;
            service.playlistItems.list(
              {
                auth: admin.youtubeKey[0],
                maxResults: 50,
                part: "snippet",
                playlistId: id
              },
              async (err, response) => {
                if (err) {
                  console.log(err);
                  quotaError(err, admin.youtubeKey);
                  return;
                }
                var results = response.data.items;
                playlistAdd(results, message, serverQueue);
              }
            );
          }
        );
      }
      // Playlist Add using URL
    } else if (args[1].toLowerCase() === "playlist") {
      var service = google.youtube("v3");
      var id = args[2].split("https://www.youtube.com/playlist?list=")[1];
      service.playlistItems.list(
        {
          auth: admin.youtubeKey[0],
          maxResults: 50,
          part: "snippet",
          playlistId: id
        },
        async (err, response) => {
          if (err) {
            console.log(err);
            quotaError(err, admin.youtubeKey);
            return;
          }
          var results = response.data.items;
          playlistAdd(results, message, serverQueue);
        }
      );
      // Song Add using Search
    } else if (!validUrl.validURL(args[1])) {
      var service = google.youtube("v3");
      var search = args[1].toLowerCase();
      for (var i = 2; i < args.length; i++) {
        search += "+";
        search += args[i];
      }
      var id = await db.getSearchSingle(false, search);
      // Search Query already in DB
      if (id) {
        var url = "https://www.youtube.com/watch?v=" + id;
        return message.channel.send(
          await addSongToQueue(url, message, serverQueue, voiceChannel)
        );
        // Search Query using Youtube
      } else {
        service.search.list(
          {
            auth: admin.youtubeKey[0],
            type: "video",
            maxResults: 5,
            part: "snippet",
            q: search
          },
          async (err, response) => {
            if (err) {
              console.log(err);
              quotaError(err, admin.youtubeKey);
              return;
            }
            var results = response.data.items;
            db.pushSearch(false, search, results);
            var url =
              "https://www.youtube.com/watch?v=" + results[0].id.videoId;
            return message.channel.send(
              await addSongToQueue(url, message, serverQueue, voiceChannel)
            );
          }
        );
      }
      // Add Song using URL
    } else {
      return message.channel.send(
        await addSongToQueue(args[1], message, serverQueue, voiceChannel)
      );
    }
  } catch (err) {
    console.log(err);
  }
}

function quotaError(err, youtubeKey) {
  if (err.code == 403 || err.code == 429) {
    admin.youtubeKey[0] = auth.backupKey;
    message.channel.send(
      "Quota reached, switching to backup key...\n Try again!"
    );
  }
}

async function playlistAdd(results, message, serverQueue) {
  const voiceChannel = message.member.voiceChannel;
  // Send songs in batches of 5
  var formattedMessage = "";
  let i = 0;
  for (let result of results) {
    serverQueue = admin.queue.get(message.guild.id);
    var url =
      "https://www.youtube.com/watch?v=" + result.snippet.resourceId.videoId;
    formattedMessage += await addSongToQueue(
      url,
      message,
      serverQueue,
      voiceChannel
    );
    formattedMessage += "\n";
    i++;
    if (!admin.shuffleMode[0] && i == 5) {
      i = 0;
      message.channel.send(formattedMessage);
      formattedMessage = "";
    }
  }
  if (!admin.shuffleMode[0] && i != 0) {
    message.channel.send(formattedMessage);
  }
  if (admin.shuffleMode[0]) {
    display.list(message, serverQueue);
  }
}

async function addSongToQueue(videoUrl, message, serverQueue, voiceChannel) {
  const songInfo = await ytdl.getInfo(videoUrl);
  var thumbnail =
    songInfo.player_response.videoDetails.thumbnail.thumbnails[
      songInfo.player_response.videoDetails.thumbnail.thumbnails.length - 1
    ];
  const song = {
    title: songInfo.title,
    url: songInfo.video_url,
    id: songInfo.video_id,
    thumbnail: thumbnail
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
    admin.queue.set(message.guild.id, queueContruct);
    // Pushing the song to our songs array
    queueContruct.songs.push(song);

    try {
      // Here we try to join the voicechat and save our connection into our object.
      var connection = await voiceChannel.join();
      queueContruct.connection = connection;
      // Calling the play function to start a song
      play.playSong(message, queueContruct.songs[0]);
    } catch (err) {
      // Printing the error message if the bot fails to join the voicechat
      console.log(err);
      admin.queue.delete(message.guild.id);
      return message.channel.send(err);
    }
  } else {
    if (admin.shuffleMode[0] && serverQueue.songs.length > 1) {
      const index =
        Math.floor(Math.random() * (serverQueue.songs.length - 2)) + 1;
      serverQueue.songs.splice(index, 0, song);
    } else {
      serverQueue.songs.push(song);
    }
    db.pushQueue(message.guild.id, serverQueue.songs);
  }
  var num = !serverQueue ? 0 : serverQueue.songs.length - 1;
  return `${num} - ${song.title} has been added to the queue!`;
}

module.exports = {
  addSong: addSong
};
