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
    message.channel.send("bye-bye nyaa (^^)/");
    return;
  }
  var stream = ytdl(song.url, { quality: 140 });
  db.pushQueue(message.guild.id, serverQueue.songs);
  const dispatcher = serverQueue.connection
    .playStream(stream)
    .on("end", () => {
      setTimeout(() => {
        const pos = serverQueue.songs.length - 1;
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
        // db.removeLast(message.guild.id, pos);
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
  // If there are no songs, delete the serverQueue, leave voice, and delete queue
  if (serverQueue.songs.length == 0) {
    serverQueue.voiceChannel.leave();
    admin.queue.delete(channel.guild.id);
    return;
  }
  const stream = ytdl(serverQueue.songs[0].url, {
    quality: 140
  }).on("response", () => {
    console.log("Downloading...");
    const dispatcher = serverQueue.connection
      .playStream(stream)
      .on("end", () => {
        setTimeout(() => {
          const updatedQueue = [...serverQueue.songs];
          switch (admin.loop.get(channel.guild.id)) {
            case 0: // no looping
              updatedQueue.shift();
              break;
            case 1: // queue looping
              updatedQueue.push(serverQueue.songs[0]);
              updatedQueue.shift();
              break;
            case 2: // song looping
              // will need to be fixed
              break;
          }
          if (updatedQueue[0]) {
            channel.send(`Now playing: ${updatedQueue[0].title}`);
          } else {
            channel.send("bye");
          }
          db.updateQueue(channel.guild.id, updatedQueue);
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
  });
}
module.exports = {
  playSong: playSong,
  dbPlaySong: dbPlaySong
};
