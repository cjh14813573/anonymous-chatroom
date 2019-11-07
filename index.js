var express = require("express");
var app = express();
var http = require("http").Server(app);
var io = require("socket.io")(http);

var users = [];
var sockets = {};
var rooms = {};
var rooms_dial = {};

rooms.Lobby = {
  name: "Lobby",
  password: "",
  private: false,
  creator: "",
  members: [],
  banned:[]
}

app.use(express.static('public'));
/*
app.get("/",function(req,res){
  res.sendFile(__dirname+"/public/index.html");
});*/

io.on("connection",function(socket){
  console.log("a user connected");
  socket.on("disconnect",function(){
    console.log("user disconnected");
    if(socket.username !== null){
      users.splice(users.indexOf(socket.username),1);
      delete sockets[socket.username];
      for(var i in rooms){
        if(rooms[i].creator === socket.username){
          delete_room(i);
        }else if(rooms[i].members.indexOf(socket.username)!==-1){
          rooms[i].members.splice(rooms[i].members.indexOf(socket.username),1);
        }
      }
    }
  });
  socket.on("username login",function(msg){
    if(users.indexOf(msg.username)!==-1){
      socket.emit("login result",{
        success: false,
        error:"username already exists",
      });
    }else{
      users.push(msg.username);
      rooms.Lobby.members.push(msg.username);
      socket.username = msg.username;
      sockets[socket.username] = socket;
      socket.emit("login result",{
        success: true,
        username:msg.username,
      });
    }
    socket.on("add room",function(msg){
      if(msg.name in rooms){
        socket.emit("add room result",{
          success: false,
          error:"room name already exists"
        });
      }else{
        socket.emit("add room result",{
          success:true,
          roomname:msg.name,
        });
        rooms[msg.name] = {
          name: msg.name,
          password: msg.password,
          private: msg.private,
          creator: socket.username,
          members: [],
          banned:[]
        };
        //console.log(rooms);
      }
    });
    socket.on("get rooms info",function(){
      socket.emit("rooms info",rooms);
    });
    socket.on("invite users",function(msg){
      for(var i in msg.users){
        if(rooms["Lobby"].members.indexOf(msg.users[i])!==-1 && rooms[msg.room].members.indexOf(msg.users[i])===-1){
          sockets[msg.users[i]].emit("invitation",{
            from: socket.username,
            room: msg.room,
          });
        }
      }
    });
    socket.on("chat message",function(msg){
      if(msg.targetroom in rooms){
        for(var member in rooms[msg.targetroom].members){
          var temp_name = rooms[msg.targetroom].members[member];
          if(temp_name in sockets){
            sockets[temp_name].emit("chat message",msg);
          }
        }
      }else{
        socket.emit("error message",{
          error:"current room no longer exists"
        });
      }
    });
    socket.on("switch room",function(msg){
      console.log(rooms);
      if(msg.last_room !== "Lobby"){
        if(msg.last_room in rooms && rooms[msg.last_room].members.indexOf(socket.username)!==-1){
          rooms[msg.last_room].members.splice(rooms[msg.last_room].members.indexOf(socket.username),1);
        }
      }
      if(msg.new_room !== "Lobby"){
        rooms[msg.new_room].members.push(socket.username);
      }
        console.log(rooms);
    });
    socket.on("check password",function(msg){
      if(msg.room in rooms){
        if(rooms[msg.room].password === msg.password){
          if(rooms[msg.room].banned.indexOf(socket.username)===-1){
            socket.emit("checked password",{
              success:true,
              new_room:msg.room,
            });
          }else{
            socket.emit("checked password",{
              success:false,
              error:"you are banned from the room"
            });
          }
        }else{
          socket.emit("checked password",{
            success:false,
            error: "wrong password"
          });
        }
      }else{
        socket.emit("checked password",{
          success:false,
          error: "room does not exist"
        });
      }
    });
    socket.on("delete room",function(msg){
      delete_room(msg.room_name);
    });
    socket.on("kick user",function(msg){
      if(msg.room in rooms){
        if(rooms[msg.room].members.indexOf(msg.user)!==-1){
          rooms[msg.room].members.splice(rooms[msg.room].members.indexOf(msg.user),1);
          if(msg.user in sockets){
            sockets[msg.user].emit("kicked",{
              room:msg.room,
            });
          }
        }
      }
    });
    socket.on("ban user",function(msg){
      if(msg.room in rooms){
        if(rooms[msg.room].members.indexOf(msg.user)!==-1){
          rooms[msg.room].members.splice(rooms[msg.room].members.indexOf(msg.user),1);
          rooms[msg.room].banned.push(msg.user);
          if(msg.user in sockets){
            sockets[msg.user].emit("banned",{
              room:msg.room,
            });
          }
        }
      }
    });
    socket.on("enter room",function(msg){
      if(msg.room in rooms){
        if(rooms[msg.room].banned.indexOf(socket.username)===-1){
          socket.emit("enter room result",{
            success:true,
            room:msg.room
          });
        }else{
          socket.emit("enter room result",{
            success:false,
            error:"you are banned from the room"
          });
        }
      }else{
        socket.emit("enter room result",{
          success:false,
          error:"room does not exist"
        });
      }
    })
    socket.on("private message",function(msg){
      if(msg.target in sockets){
        if(msg.room in rooms){
          if(rooms[msg.room].members.indexOf(msg.target)!==-1){
            sockets[msg.target].emit("private message",{
              from:socket.username,
              target:msg.target,
              message:msg.message,
              room:msg.room,
            });
            socket.emit("private result",{
              success:true,
              from:socket.username,
              target:msg.target,
              message:msg.message,
              room:msg.room,
            });
          }else{
            socket.emit("private result",{
              success:false,
              error:"target no longer in this room"
            });
          }
        }else{
          socket.emit("private result",{
            success:false,
            error:"room does not exist"
          });
        }
      }else{
        socket.emit("private result",{
          success:false,
          error:"target user does not exist"
        });
      }
    });
  });
});

http.listen(3456, function(){
  console.log("listening on port 3456");
});

function delete_room(room_name){
  if(room_name in rooms){
    for(var member in rooms[room_name].members){
      var temp_member = rooms[room_name].members[member];
      if(temp_member in sockets){
        sockets[temp_member].emit("room deleted",{
          room:room_name,
        });
      }
    }
    delete rooms[room_name];
  }
}
