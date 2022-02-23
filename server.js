const express = require("express")

const server = express()

server.all("/",(req,res) => {
  res.send("Hello There")
})

function keepAlive(){
  server.listen(8065,()=>{
    console.log("Up and Running")
  })
}
module.exports = keepAlive