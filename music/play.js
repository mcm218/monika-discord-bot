const db = require("./database");
const admin = require("./admin");
const display = require("./display");
const ytdl = require("ytdl-core");

function playSong(message, song) {
  const serverQueue = admin.queue.get(message.guild.id);
  if (!song) {
    serverQueue.voiceChannel.leave();
    admin.queue.delete(message.guild.id);
    db.pushQueue(message.guild.id, []);
    message.channel.send("bye-bye nyaa-ow (^^)/!");
    return;
  }
  db.pushQueue(message.guild.id, serverQueue.songs);
  const dispatcher = serverQueue.connection
    .playStream(ytdl(song.url))
    .on("end", () => {
      setTimeout(() => {
        switch (admin.loop.get(message.guild.id)) {
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
      }, 1000);
    })
    .on("start", () => {
      console.log(serverQueue.songs[0]);
    })
    .on("error", (error) => {
      console.error(error);
    });
  // if (admin.pauseState.get(message.guild.id)) {
  //   dispatcher.pause();
  // }
  const volume = admin.serverVolumes.get(message.guild.id);
  dispatcher.setVolumeLogarithmic(volume / 50);
}

function dbPlaySong(channel, serverQueue) {
  if (!serverQueue.songs[0]) {
    admin.queue.delete(channel.guild.id);
    serverQueue.voiceChannel.leave();
    db.pushQueue(channel.guild.id, []);
    return;
  }
  console.log(`Now playing: ${serverQueue.songs[0].title}`);
  db.pushQueue(channel.guild.id, serverQueue.songs);
  const dispatcher = serverQueue.connection
    .playStream(ytdl(serverQueue.songs[0].url))
    .on("end", () => {
      setTimeout(() => {
        switch (admin.loop.get(channel.guild.id)) {
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
        if (serverQueue.songs[0]) {
          channel.send(`Now playing: ${serverQueue.songs[0].title}`);
        } else {
          channel.send("bye-bye nyaa~~ (^^)/");
        }
        dbPlaySong(channel, serverQueue);
      }, 1000);
    })
    .on("start", () => {
      console.log("Database: " + serverQueue.songs[0].url);
    })
    .on("error", (error) => {
      console.error(error);
    });
  // if (admin.pauseState.get(channel.guild.id)) {
  //   dispatcher.pause();
  // }
  const volume = admin.serverVolumes.get(channel.guild.id);
  dispatcher.setVolumeLogarithmic(volume / 50);
  dispatcher.resume();
}
module.exports = {
  playSong: playSong,
  dbPlaySong: dbPlaySong
};
