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
    message.channel.send("Bye!");
    return;
  }
  db.pushQueue(message.guild.id, serverQueue.songs);
  const dispatcher = serverQueue.connection
    .playStream(ytdl(song.url))
    .on("end", () => {
      switch (admin.loop[0]) {
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
  const volume = admin.serverVolumes.get(message.guild.id);
  dispatcher.setVolumeLogarithmic(volume / 50);
}

function dbPlaySong(channel, serverQueue) {
  if (!serverQueue.songs[0]) {
    admin.queue.delete(channel.guild.id);
    serverQueue.voiceChannel.leave();
    db.pushQueue(channel.guild.id, []);
    channel.send("Bye!");
    return;
  }
  db.pushQueue(channel.guild.id, serverQueue.songs);
  console.log(serverQueue.songs[0].url);
  const dispatcher = serverQueue.connection
    .playStream(ytdl(serverQueue.songs[0].url))
    .on("end", () => {
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
      }
      dbPlaySong(channel, serverQueue);
    })
    .on("error", (error) => {
      console.error(error);
    });
  if (admin.pauseState.get(channel.guild.id)) {
    dispatcher.pause();
  }
  const volume = admin.serverVolumes.get(channel.guild.id);
  dispatcher.setVolumeLogarithmic(volume / 50);
}
module.exports = {
  playSong: playSong,
  dbPlaySong: dbPlaySong
};
