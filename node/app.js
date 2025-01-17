const express = require('express');
const cors = require('cors');
const https = require('https');
const fs = require('fs');
const socket = require('socket.io');
const w2v = require('word2vec');


const options = {
  key: fs.readFileSync("./.cert/key.pem"),
  cert: fs.readFileSync("./.cert/cert.pem")
}

const corsOptions = {
  origin : ['http://localhost', 'http://51.38.48.94', 'https://www.ojvindix.fr', 'https://ojvindix.fr', 'https://ojvindix.fr:3000', 'https://www.ojvindix.fr:3000'],
}

const port = 3001;

const app = express();
const server = https.createServer(options, app);

var model;

var currentWord = 'pourcentage';
var lastWord = 'faucille';

var group = new Map();

w2v.loadModel('./model.bin', function( error, modelLoaded ) {
  model = modelLoaded;
  console.log("Model loaded");
});

broadcastWordToTeam = function (multiplayerCode, body) {
  console.log('Broadcasting to other team member');
  // todo check if group exist
  group.get(multiplayerCode).forEach(socket => {
    socket.emit('word', body);
  });
}

app.use(express.json());
app.use(cors(corsOptions));

app.get('/', (req, res) => {
  res.send('Welcome to Ojvindix')
});

app.get('/last', (req, res) => {
  res.send({value: lastWord});
});

app.post('/new', (req, res) => {
  console.log('New word');
  console.log(req.body);
  var newWord = req.body.value.trim().toLowerCase();
  lastWord = currentWord;
  currentWord = newWord;
  res.status(200).json({
    value: newWord
  });
});

app.post('/similarity', function (req, res) {
  const multiplayerCodeHeader = req.headers['x-multiplayer-code'];
  const multiplayerUsernameHeader = req.headers['x-multiplayer-username'];
  const word = req.body.value.trim().toLowerCase();
  const score = model.similarity(word,currentWord);
  console.log("Receive request : " + word + " " + score);
  if (multiplayerCodeHeader) {
    this.broadcastWordToTeam(multiplayerCodeHeader, {
      value: score,
      word: word,
      username: multiplayerUsernameHeader
    });
  }
  res.status(200).json({
    value: score,
    word: word
  });
});

server.listen(port, () => {
  console.log(`Ojvindix listening on port ${port}`)
});

const io = socket(server, {
  cors: corsOptions
});

io.use(function (socket, next) {
  const multiCode = socket.handshake.headers['x-multiplayer-code'].trim();
  if (multiCode != null && multiCode != "") {
    next();
  }
});

io.on('connection', (socket) => {
  console.log('a user is connected');
  const multiCode = socket.handshake.headers['x-multiplayer-code'].trim();
  if (!group.get(multiCode)) {
    console.log('create team : ' + multiCode);
    group.set(multiCode, []);
  }
  console.log('adding socket to team');
  group.get(multiCode).push(socket);

  socket.on("disconnect", (reason) => {
    console.log('user disconnect');
    socket.disconnect();
    // todo remove from array
    return;
  });

  return;
});