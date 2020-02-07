const db = require("./database");
const play = require("./play");
const admin = require("./admin");
const display = require("./display");

async function selectSong(message, serverQueue) {
  try {
    const args = message.content.split(" ");
    const voiceChannel = message.member.voiceChannel;

    if (!voiceChannel) {
      return message.channel.send(
        "You need to be in a voice channel to add music!"
      );
    }

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

    if (args[1] > admin.searchList.get(message.guild.id).length) {
      message.channel.send("Invalid selection");
      display.displaySearchList(searchList, message);
      return;
    }

    const song = admin.searchList.get(message.guild.id)[args[1]];

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
      var num = !serverQueue ? 0 : serverQueue.songs.length - 1;
      db.pushQueue(message.guild.id, serverQueue.songs);
      return message.channel.send(
        `${num} - ${song.title} has been added to the queue!`
      );
    }
  } catch (err) {
    console.error(err);
  }
}

module.exports = {
  selectSong: selectSong
};
