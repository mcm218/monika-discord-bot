const display = require("./display");

function removeSong(message, serverQueue) {
  try {
    const args = message.content.split(" ");
    const id = args[1];
    if (!message.member.voiceChannel) {
      return message.channel.send(
        "You need to be in a voice channel to remove music!"
      );
    }
    if (!id) {
      message.channel.send("```!remove id```");
      return;
    }
    if (id >= serverQueue.songs.length) {
      message.channel.send("Invalid selection");
      display.list(message);
      return;
    }
    if (id == 0) {
      var song = serverQueue.songs[0];
      message.channel.send("Removed " + song.title);
      serverQueue.connection.dispatcher.end();
    } else {
      var song = serverQueue.songs.splice(id, 1);
      return message.channel.send("Removed " + song[0].title);
    }
  } catch (err) {
    console.log(err);
  }
}
function shiftSong(message, serverQueue) {
  try {
    const args = message.content.split(" ");
    const id = args[1];
    if (!message.member.voiceChannel) {
      return message.channel.send(
        "You need to be in a voice channel to shift music!"
      );
    }
    if (!id) {
      message.channel.send("```!shift id```");
      return;
    }
    if (id >= serverQueue.songs.length) {
      message.channel.send("Invalid selection");
      display.list(message);
      return;
    }
    if (id == 0) {
      message.channel.send("Song is already at the front!");
    } else {
      var song = serverQueue.songs.splice(id, 1);
      serverQueue.songs.splice(1, 0, song[0]);
      message.channel.send("Up next: " + song[0].title);
    }
  } catch (err) {
    console.log(err);
  }
}
function shuffle(message, serverQueue) {
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You need to be in a voice channel to shuffle music!"
    );
  }
  // shuffle all but first song
  const song = serverQueue.songs.splice(0, 1);
  for (let i = serverQueue.songs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * i);
    const temp = serverQueue.songs[i];
    serverQueue.songs[i] = serverQueue.songs[j];
    serverQueue.songs[j] = temp;
  }
  serverQueue.songs.unshift(song[0]);
  message.channel.send("Shuffled!");
}

function toggleShuffleMode(message) {
  var shuffleMode = admin.shuffleMode.get(message.guild.id);
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You need to be in a voice channel to toggle shuffle mode!"
    );
  }
  shuffleMode = !shuffleMode;
  admin.shuffleMode.set(message.guild.id, shuffleMode);
  if (shuffleMode) {
    return message.channel.send("Now in shuffle mode!");
  } else {
    return message.channel.send("No longer in shuffle mode.... :frowning:");
  }
}
module.exports = {
  remove: removeSong,
  shift: shiftSong,
  shuffle: shuffle,
  toggleShuffle: toggleShuffleMode
};
