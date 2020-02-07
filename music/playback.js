// 0 - no looping
// 1 - queue looping
// 2 - song looping
function toggleLoop(loop, message) {
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You need to be in a voice channel to loop music!"
    );
  }
  loop[0]++;
  if (loop[0] > 2) {
    loop[0] = 0;
  }
  // Adding song looping
  switch (loop[0]) {
    case 0:
      message.channel.send("No longer looping!");
      break;
    case 1:
      message.channel.send("Now looping queue!");
      break;
    case 2:
      message.channel.send("Now looping song!");
      break;
  }
}

function resumeSong(pauseState, message, serverQueue) {
  if (!message.member.voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to resume music!"
    );
  if (!serverQueue)
    return message.channel.send("There are no songs for me to resume!");
  pauseState[0] = false;
  serverQueue.connection.dispatcher.resume();
  message.channel.send("Resuming!");
}

function pauseSong(pauseState, message, serverQueue) {
  if (!message.member.voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to pause music!"
    );
  if (!serverQueue)
    return message.channel.send("There are no songs for me to pause!");
  pauseState[0] = true;
  serverQueue.connection.dispatcher.pause();
  message.channel.send("Paused!");
}

function skipSong(loop, volume, message, serverQueue) {
  if (!message.member.voiceChannel)
    return message.channel.send(
      "You need to be in a voice channel to skip music!"
    );
  if (!serverQueue) {
    return message.channel.send("There are no songs for me to skip!");
  }
  if (loop == 2) {
    loop = 1;
    message.channel.send("Now looping queue!");
  }
  serverQueue.connection.dispatcher.end();
  if (serverQueue.connection.dispatcher) {
    serverQueue.connection.dispatcher.setVolumeLogarithmic(volume / 50);
  }
}

function stopSongs(loop, message, serverQueue) {
  if (!message.member.voiceChannel)
    return message.channel.send(
      "You have to be in a voice channel to stop the music!"
    );
  switch (loop) {
    case 0:
      serverQueue.songs = [];
      serverQueue.connection.dispatcher.end();
      break;
    case 1:
      loop = 0;
      serverQueue.songs = [];
      serverQueue.connection.dispatcher.end();
      loop = 1;
      break;
    case 2:
      loop = 0;
      serverQueue.songs = [];
      serverQueue.connection.dispatcher.end();
      loop = 2;
      break;
  }
}

function changeVolume(serverVolumes, message, serverQueue) {
  if (!message.member.voiceChannel) {
    return message.channel.send(
      "You need to be in a voice channel to change volume!"
    );
  }
  const args = message.content.split(" ");
  if (!args[1]) {
    message.channel.send("```!volume 0:30```");
    return;
  }
  if (args[1] < 0 || args[1] > 30) {
    return message.channel.send("```!volume 0:30```");
  }
  volume = args[1];
  serverVolumes.set(message.guild.id, volume);
  message.channel.send("Volume: " + volume);
  if (serverQueue && serverQueue.connection) {
    const dispatcher = serverQueue.connection.dispatcher;
    dispatcher.setVolumeLogarithmic(volume / 50);
  }
}

module.exports = {
  toggleLoop: toggleLoop,
  resume: resumeSong,
  pause: pauseSong,
  skip: skipSong,
  stop: stopSongs,
  changeVolume: changeVolume
};
