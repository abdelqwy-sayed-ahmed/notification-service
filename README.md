# Notification service app "send real-time notifications to online sockets (users)

# Nestjs , RabbitMQ , Redis and Socket.io

# work flow 

1- App 1 saves message to DB
    
2- App 1 publishes payload to chat.exchange with key "message.sent"
    
3- RabbitMQ routes it → notification.queue (holds it)
    
4- App 2 consumer picks it up (it's always listening)
    
5- GatewayService.handleMessageSent() runs
    
6- Checks Redis → who is online among recipientIds?
    
7-1-Emits "new_message" to the room channel  -->  everyone in the room view gets this
7-2-Emits "notification" to each online socket --> for users not currently in the room view
