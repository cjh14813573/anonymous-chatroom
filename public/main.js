$(function(){
  var prompt = function (message, style, time)
  {
      style = (style === undefined) ? 'alert-success' : style;
      time = (time === undefined) ? 1200 : time;
      $('<div>')
          .appendTo('body')
          .addClass('alert ' + style)
          .html(message)
          .show()
          .delay(time)
          .fadeOut();
      setTimeout(function(){
        $(".alert").remove();
      },2000);
  };
  var success_prompt = function(message, time)
  {
      prompt(message, 'alert-success', time);
  };

  var fail_prompt = function(message, time)
  {
      prompt(message, 'alert-danger', time);
  };
  var socket = io();
  var rooms = {};
  var current_room_name = "Lobby";
  $("#login_form").submit(function(event){
    event.preventDefault();
    var username_send = $("#username_input").val().trim();
    if(username_send!==""){
      socket.emit("username login",{
        username:$("#username_input").val().trim(),
      });
    }
    return false;
  });
  $("#chat_form").submit(function(event){
    event.preventDefault();
    var message_send = $("#chat_input").val().trim();
    if(message_send!==""){
      socket.emit("chat message",{
        username:username,
        message:$("#chat_input").val().trim(),
        targetroom:current_room_name,
      });
      $("#chat_input").val("");
    }
    return false;
  });
  socket.on("chat message",function(msg){
    if(msg.targetroom === current_room_name){
      var message_li = $("<li>");
      $(message_li).append($("<div>").text(msg.username).attr("class","username"));
      $(message_li).append($("<div>").text(msg.message).attr("class","message"));
      $("#messages").append($(message_li));
      message_li[0].scrollIntoView();
    }
  });
  socket.on("login result",function(msg){
    if(msg.success){
      //login success, initiate the chat window
      setInterval(reload_left_widget,500);

      username = msg.username;
      $("#username_input").val("");
      $("#avatar").text(username.slice(0,1));
      $("#username_left").text(username.slice(1,username.length));
      //initiate add toom div
      $(".private_checkbox_div").controlgroup();
      $("#add_room_confirm_button").button();
      $("#add_room_confirm_button").unbind().click(function(){
        if($("#add_room_name").val().trim()!==""){
          socket.emit("add room",{
            private:$("#private_checkbox").prop("checked"),
            name:$("#add_room_name").val().trim(),
            password:$("#add_room_password").val(),
          });
        }else{
          fail_prompt("room name should not be null",1500);
        }
      });
      $("#private_checkbox").change(function(){
        if($("#private_checkbox").prop("checked")){
          $("#add_room_password").slideDown();
        }else{
          $("#add_room_password").slideUp();
        }
      });
      $("#add_room").click(function(){
        $("#add_room_div").slideToggle();
      });
      $("#members_button").click(function(){
        if($("#members_button").hasClass("ui-icon-caret-1-s")){
          reload_chat_nav();
        }
        $("#members_button").toggleClass("ui-icon-caret-1-s");
        $("#members_button").toggleClass("ui-icon-caret-1-n");
        $("#members_div").slideToggle();
      });
      reload_left_widget();
      $("#login").fadeOut();
      $("#main").fadeIn();
    }else{
      fail_prompt(msg.error,1500);
    }
  });
  socket.on("add room result",function(msg){
    if(msg.success){
      $("#add_room_name").val("");
      $("#add_room_password").val("");
      $("#private_checkbox").prop("checked",false);
      $("#add_room_div").slideUp();
      success_prompt("room added",1500);
      switch_room(current_room_name,msg.roomname);
      reload_left_widget();
      reload_chat_nav();
      clear_chat();
    }else{
      fail_prompt(msg.error,1500);
    }
  });

  socket.on("checked password",function(msg){
    if(msg.success){
      $("#check_password_dialog").dialog("close");
      $("#check_password_dialog input").val("");
      switch_room(current_room_name,msg.new_room);
    }else{
      fail_prompt(msg.error,1500);
    }
  });
  socket.on("enter room result",function(msg){
    if(msg.success){
      switch_room(current_room_name,msg.room);
    }else{
      fail_prompt(msg.error, 1500);
    }
  });

  socket.on("room deleted",function(msg){
    if(msg.room === current_room_name){
      switch_room(current_room_name,"Lobby");
      fail_prompt("current room deleted",1500);
    }
  });

  socket.on("kicked",function(msg){
    if(msg.room === current_room_name){
      fail_prompt("you are kicked out of the room",1500);
      switch_room(current_room_name,"Lobby");
    }
  });
  socket.on("banned",function(msg){
    if(msg.room === current_room_name){
      fail_prompt("you are banned from the room",1500);
      switch_room(current_room_name,"Lobby");
    }
  });
  socket.on("private result",function(msg){
    if(msg.success){
      $("#user_menu").dialog("close");
      $("#private_message_dialog").dialog("close");
      $("#private_message_dialog textarea").val("");
      if(msg.room === current_room_name){
        var message_li = $("<li>");
        $(message_li).append($("<div>").text(msg.from+"  >>>"+msg.target).attr("class","username"));
        $(message_li).append($("<div>").text(msg.message).attr("class","message"));
        $("#messages").append($(message_li));
        message_li[0].scrollIntoView();
      }
    }else{
      fail_prompt(msg.error,1500);
    }
  });
  socket.on("private message",function(msg){
    if(msg.room === current_room_name){
      var message_li = $("<li>");
      $(message_li).append($("<div>").text(msg.from+"  >>>"+msg.target).attr("class","username"));
      $(message_li).append($("<div>").text(msg.message).attr("class","message"));
      $("#messages").append($(message_li));
      message_li[0].scrollIntoView();
    }
  });
  socket.on("invitation",function(msg){
    if(msg.room!==current_room_name){
      $("#invitation_dialog").text(msg.from+" invites you to room '"+msg.room+"'");
      $("#invitation_dialog").dialog({
        title:"invitation",
        buttons:[
          {
            text:"accept",
            click:function(){
              $("#invitation_dialog").dialog("close");
              switch_room(current_room_name,msg.room);
            }
          },
          {
            text:"ignore",
            click:function(){
              $("#invitation_dialog").dialog("close");
            }
          }
        ]
      });
    }
  });
  socket.on("rooms info",function(msg){
    rooms = msg;
    $("#room_list").text("");
    for(var room in msg){
      var new_room_section = $("<div>").addClass("room_section");
      $(new_room_section).append($("<div>").addClass("room_name").text(msg[room].name));
      $(new_room_section).append($("<div>").addClass("number_of_users").append($("<b>").text(msg[room].members.length)).append(" members"));
      if(msg[room].name!=="Lobby"){
        $(new_room_section).append($("<div>").addClass("creator").text("created by "+msg[room].creator));
      }
      if(msg[room].private){
        $(new_room_section).append($("<div>").addClass("locked_icon"));
        $(new_room_section).click((function(current_room_name,new_room_name){
          return function(){
            $("#check_password_dialog").dialog({
              title:"This is a private room",
              width:300,
              height:150,
              buttons:[
                {
                  text:"OK",
                  click:function(){
                    var temp_password = $("#check_password_dialog input").val();
                    socket.emit("check password",{
                      room:new_room_name,
                      password: temp_password
                    });
                  }
                }
              ]
            });
          };
        })(current_room_name,msg[room].name));
      }else{
        $(new_room_section).click((function(current_room_name,new_room_name){
          return function(){
            socket.emit("enter room",{
              room:new_room_name,
            })
          };
        })(current_room_name,msg[room].name));
      }
      if(msg[room].name===current_room_name){
        $(new_room_section).unbind();
        $(new_room_section).addClass("room_div_current");
      }
      $("#room_list").append($(new_room_section));
    }
  });
  function reload_left_widget(){
    socket.emit("get rooms info");
  }

  function reload_chat_nav(){
    $("#current_room").text(current_room_name);
    $("#members_div").text("");
    if(rooms[current_room_name]){
      for(var member in rooms[current_room_name].members){
        var temp_name = rooms[current_room_name].members[member];
        var newPotDiv = $("<div>").addClass("pot_section");
        $(newPotDiv).append($("<div>").addClass("avatar").text(temp_name.slice(0,1)));
        $(newPotDiv).append($("<div>").addClass("pot_name").text(temp_name));
        $(newPotDiv).click((function(name){
          return function(){
            if(name!==username){
              $("#message_button").unbind().click(function(){
                $("#private_message_dialog").dialog({
                  title:"send private message to "+temp_name,
                  width:370,
                  height:220,
                  buttons:[
                    {
                      text:"send",
                      click:function(){
                        if($("#private_message_dialog textarea").val()!==""){
                          socket.emit("private message",{
                            message:$("#private_message_dialog textarea").val(),
                            target:name,
                            room:current_room_name,
                          });
                        }else{
                          fail_prompt("message should not be null",1500);
                        }
                      }
                    }
                  ]
                });
              });
              if(current_room_name!=="Lobby"&&rooms[current_room_name].creator===username){
                $("#kick_button").show();
                $("#ban_button").show();
              }else{
                $("#kick_button").hide();
                $("#ban_button").hide();
              }
              $("#kick_button").unbind().click(function(){
                socket.emit("kick user",{
                  user: name,
                  room: current_room_name,
                });
                $("#user_menu").dialog("close");
                setTimeout(reload_chat_nav,1000);
              });
              $("#ban_button").unbind().click(function(){
                socket.emit("ban user",{
                  user: name,
                  room: current_room_name,
                });
                $("#user_menu").dialog("close");
                setTimeout(reload_chat_nav,1000);
              });
              $("#user_menu").dialog({
                title:name
              });
            }
          }
        })(temp_name));
        $("#members_div").append($(newPotDiv));
      }
      if(current_room_name!=="Lobby"&&rooms[current_room_name].creator===username){
        var temp_div = $("<div>").addClass("delete_room_div");
        $(temp_div).append($("<button>").text("delete room").addClass("delete_room_button").click(function(){
          var temp_current_room = current_room_name;
          switch_room(current_room_name,"Lobby");
          socket.emit("delete room",{
            room_name:temp_current_room,
          });
        }));
        $(temp_div).append($("<button>").text("invite user").addClass("delete_room_button").click(function(){
          $("#invite_user_dialog").text("");
          for(var user in rooms["Lobby"].members){
            if(rooms[current_room_name].members.indexOf(rooms["Lobby"].members[user])===-1){
              var temp_div = $("<div>");
              $(temp_div).append($("<input>").attr({
                type:"checkbox",
                value:rooms["Lobby"].members[user],
              })).append($("<span>").text(rooms["Lobby"].members[user]));
              $("#invite_user_dialog").append($(temp_div));
            }
          }
          $("#invite_user_dialog").dialog({
            title:"invite users",
            maxHeight:400,
            buttons:[
              {
                text:"invite",
                click:function(){
                  var boxs = document.getElementById("invite_user_dialog").getElementsByTagName("input");
                  var temp_users = [];
                  for(var i=0;i<boxs.length;i++){
                    if($(boxs[i]).prop("checked")){
                      temp_users.push($(boxs[i]).val());
                    }
                  }
                  socket.emit("invite users",{
                    users:temp_users,
                    room:current_room_name,
                  });
                  $("#invite_user_dialog").dialog("close");
                  success_prompt("invitation sent out",1500);
                },
              }
            ]
          });
        }));
        $("#members_div").append($(temp_div));
      }
    }
  }
  function clear_chat(){
    $("#messages").text("");
  }
  function switch_room(last_room,new_room){
    clear_chat();
    current_room_name = new_room;
    reload_chat_nav();
    socket.emit("switch room",{
      last_room:last_room,
      new_room: new_room,
    });
  }

});
