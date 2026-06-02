# Notification service app "send real-time notifications to online sockets (users)

# Nestjs , RabbitMQ , Redis and Socket.io

# work flow 

App 1 saves message to DB
    ↓
App 1 publishes payload to chat.exchange with key "message.sent"
    ↓
RabbitMQ routes it → notification.queue (holds it)
    ↓
App 2 consumer picks it up (it's always listening)
    ↓
GatewayService.handleMessageSent() runs
    ↓
Checks Redis → who is online among recipientIds?
    ↓
Emits "new_message" to the room channel  ← everyone in the room view gets this
Emits "notification" to each online socket ← for users not currently in the room view