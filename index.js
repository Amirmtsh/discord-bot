// Imports
// -------------------------------------------------------------------------------------------------------------
const { Client, VoiceChannel, Intents } = require('discord.js')
const { createReadStream,createWriteStream,readdir,existsSync,mkdirSync } = require('fs');
const {
  demuxProbe,
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  entersState,
  StreamType,
  AudioPlayerStatus,
  VoiceConnectionStatus,
} = require('@discordjs/voice')
const ytdl = require('ytdl-core')
const ytSearch = require('yt-search')
const mySecret = process.env['token']
const keepAlive = require("./server.js")
const ytpl = require('ytpl');
// -------------------------------------------------------------------------------------------------------------


// Variables
// -------------------------------------------------------------------------------------------------------------
let queue = []
let nowPlayingQueue = []
const player = createAudioPlayer();
const client = new Client({
  intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES]
})
let botChannel = {}

// -------------------------------------------------------------------------------------------------------------



// Url validator
// -------------------------------------------------------------------------------------------------------------
function isUrl(s) {
   var regexp = /(ftp|http|https):\/\/(\w+:{0,1}\w*@)?(\S+)(:[0-9]+)?(\/|\/([\w#!:.?+=&%@!\-\/]))?/
   return regexp.test(s);
}

// -------------------------------------------------------------------------------------------------------------


// Get Video From Youtube
// -------------------------------------------------------------------------------------------------------------
async function findVideo(query) {
    let  video = await ytSearch(query)
    video = video.videos[0]
  try{
    const stream = await ytdl(video.url, { filter: 'audioonly' })
    return [stream, video]
  }catch{

  }
    
  }

// -------------------------------------------------------------------------------------------------------------



// Saving MP3
// -------------------------------------------------------------------------------------------------------------
async function saveVideo(query,name,playlist) {
  let video
  if(!isUrl(query)){
    video = await ytSearch(query)
    video = video.videos[0].url
  }else{
    video = query
  }
  if(typeof playlist !== 'undefined'){
    if (!existsSync(playlist)){
    mkdirSync(playlist);
    }
      await ytdl(video, { filter: 'audioonly' }).pipe(createWriteStream(playlist+'/'+ name.replace(" $"+playlist,'') + '.mp3'))
  }else{
      await ytdl(video, { filter: 'audioonly' }).pipe(createWriteStream('Musics/'+ name.replace(" $"+playlist,'') + '.mp3'))
  }
  }
// -------------------------------------------------------------------------------------------------------------



// Playing 
// -------------------------------------------------------------------------------------------------------------
async function playSong(msg, params, mode) {
    if (mode == "query") {
    if (player.state.status == "playing" && params != "none" ) {
      console.log("added to the queue")
      queue.push(params)
      return
    }
    if (params != "none")
      queue.push(params)


    const resource = createAudioResource(queue[0], {
       inlineVolume: true
    });

    if(typeof nowPlayingQueue[0] !== 'undefined'){    
      msg.channel.send({
      content:"now playing "+ nowPlayingQueue[0] ,
    })
    }
    resource.volume.setVolume(Number(0.2))
    await player.play(resource);

    }

    entersState(player, AudioPlayerStatus.Playing, 10e3);
    player.on('error', error => {
	    console.error(`Error: ${error.message} `);
      msg.channel.send({
        content:"something went wrong ... " ,
      })
      player.stop();
    });
    player.once("idle", async () => {
      await queue.shift()
      await nowPlayingQueue.shift()
      console.log("next song")
      if (queue.length != 0) {
        await playSong(msg, params, mode)
      }
    })
    
  }


// -------------------------------------------------------------------------------------------------------------


// Connecting
// -------------------------------------------------------------------------------------------------------------
async function connectToChannel(channel) {
  const connection = await joinVoiceChannel({
    channelId: channel.id,
    guildId: channel.guild.id,
    adapterCreator: channel.guild.voiceAdapterCreator
  });

  try {
    await entersState(connection, VoiceConnectionStatus.Ready, 30e3);
    return connection;
  } catch (error) {
    connection.destroy();
    throw error;
  }
}
//-------------------------------------------------------------------------------------------------------------



// Create Stream
// -------------------------------------------------------------------------------------------------------------
async function createStream(dir,files) {
    await files.forEach(async file => {
        const { stream, type } = await demuxProbe(createReadStream(dir +"//" +file));
        queue.push(stream)
        console.log(queue)
    })
}
//-------------------------------------------------------------------------------------------------------------



// Commands
//-------------------------------------------------------------------------------------------------------------

client.on("messageCreate", async msg => {
  botChannel=await msg.guild.members.cache.get("888380011571187782").voice.channel
   if (msg.content.split(' ')[0] === "-p") {
    let params = []
    try{
      const query = msg.content.slice(3)
      if(!isUrl(query)){
        console.log("is not valid")
        params = await findVideo(query)
        nowPlayingQueue.push(params[1].url)
        // msg.channel.send({
        //   content: "Playing " + params[1].title + "\n" + params[1].url,
        // })
      }else{
        nowPlayingQueue.push(query)
        console.log("is  valid")
        params[0] = await ytdl(query, { filter: 'audioonly' })
      }

    let channel = msg.member.voice.channel;
    if(botChannel){
      if(channel.name!=botChannel.name){
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
      }
    }else{
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
    }
    await playSong(msg, params[0], "query")
    }catch{
      msg.channel.send({
      content: "could not find the video" ,
    })
    }
    

    // msg.channel.send("Playing " + params[1].title, { files: [params[1].image] });

  }
  if(msg.content.split(' ')[0] === "-save") {
    name = msg.content.split('!')[1]
    playlist = msg.content.split('$')[1]
    await saveVideo(msg.content.slice(6).split('!')[0],name,playlist)
  }
  if(msg.content.split(' ')[0] === "-ylist") {
    const url = msg.content.slice(7)
    var channel = msg.member.voice.channel;
    if(botChannel){
      if(channel.name!=botChannel.name){
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
      }
    }else{
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
    }
    let playlist = await ytpl(url);
    await playlist.items.forEach(async video => {
      nowPlayingQueue.push(video.url)
      await queue.push(await ytdl(video.url, { filter: 'audioonly' }))
      })
    msg.channel.send({
      content: "queued " + playlist.items.length + " songs" ,
    })

    await playSong( msg, "none" , "query")
  }
  if(msg.content.split(' ')[0] === "-list"){
    const dir = msg.content.slice(6)
    await readdir(dir,async (err, files) => {
    if (err) {
        throw err;
    }
    msg.channel.send({
          content: files.toString().replace(/.mp3/g ," \n") ,
    })
    await createStream(dir,files);
  })
    var channel = msg.member.voice.channel;
    if(botChannel){
      if(channel.name!=botChannel.name){
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
      }
    }else{
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
    }


  await playSong( msg, "none" , "query")
}

if (msg.content.split(' ')[0] === "-f") {
    var channel = msg.member.voice.channel;
    if(botChannel){
      if(channel.name!=botChannel.name){
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
      }
    }else{
        const connection = await connectToChannel(channel)
        connection.subscribe(player);
    }
    let file =msg.content.slice(3).split("$")[0].trim()
    let playlist = msg.content.split("$")[1]
    try{
      if(typeof playlist !== 'undefined'){
        const { stream, type } = await demuxProbe(createReadStream(playlist +'//'+file+'.mp3'));
        await playSong(msg,stream, "query")
      }else{
        const { stream, type } = await demuxProbe(createReadStream('Musics//'+file+'.mp3'));
        await playSong(msg,stream, "query")
      }

    }catch{
          msg.channel.send({
      content: "no match found" ,
    })
    }


  }
  
  if (msg.content.split(' ')[0] === "-dc") {
    queue = []
    nowPlayingQueue = []
    player.stop();
  }

  if (msg.content.split(' ')[0] === "-skip") {
    player.pause()
    await queue.shift()
    await nowPlayingQueue.shift()
    if (queue.length != 0)
      playSong(msg, "none", "query")
  }
})
//-------------------------------------------------------------------------------------------------------------

client.on("ready", () => {
  console.log("logged in")
})

keepAlive()
client.login(mySecret)

