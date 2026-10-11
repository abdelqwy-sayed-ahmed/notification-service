# Real-Time Notification Service

A real-time notification backend built with **NestJS, RabbitMQ, Redis, and Socket.IO**.

The service consumes message events asynchronously, identifies which recipients are online, and delivers real-time updates through WebSocket connections.

## Architecture Overview

The application uses event-driven communication to separate message processing from real-time notification delivery.

**Technology stack**

- **Backend:** NestJS, Node.js, TypeScript
- **Message broker:** RabbitMQ
- **Online-user tracking:** Redis
- **Real-time communication:** Socket.IO

## Message Delivery Workflow

The system follows this workflow:

1. **Message persistence:** The producer application saves the message to its database.
2. **Event publishing:** The producer publishes a message event to `chat.exchange` using the routing key `message.sent`.
3. **Message routing:** RabbitMQ routes the event to `notification.queue`.
4. **Event consumption:** The notification service continuously listens to the queue and processes incoming events.
5. **Event handling:** `GatewayService.handleMessageSent()` handles the message event.
6. **Online-user lookup:** Redis is checked to identify which recipients are currently online.
7. **Real-time delivery:**
   - **Room delivery:** Emits `new_message` to the relevant room so users viewing that conversation can see the message.
   - **Individual notification:** Emits `notification` to each online recipient who is not currently viewing the room.

## Key Design Ideas

### 1. Asynchronous Event-Driven Communication

RabbitMQ decouples the producer application from the notification service.

The producer publishes an event instead of directly invoking the notification service, allowing the consumer to process events independently.

### 2. Queue-Based Event Processing

The notification service consumes events from `notification.queue`.

This separates event production from event processing and provides a message-broker-based communication mechanism between applications.

### 3. Redis-Based Online-User Tracking

Redis is used to check which message recipients are online before attempting real-time delivery.

This allows the notification workflow to distinguish between recipients who are actively viewing a conversation and those who need an individual notification.

### 4. Real-Time Delivery with Socket.IO

Socket.IO supports two delivery paths:

- **Conversation updates:** Deliver `new_message` to the relevant room.
- **Individual notifications:** Deliver `notification` to online recipients who are outside that room.

This approach supports both active conversation updates and notifications for users navigating elsewhere in the application.

## Event Flow

```text
Producer Application
        |
        | Publishes message.sent
        v
RabbitMQ: chat.exchange
        |
        v
notification.queue
        |
        v
Notification Service
        |
        v
GatewayService.handleMessageSent()
        |
        v
Redis: Check Online Recipients
        |
        +----------------------+
        |                      |
        v                      v
Users in Conversation    Online Users Outside Room
        |                      |
        v                      v
   new_message              notification
        |                      |
        +----------+-----------+
                   |
                   v
             Socket.IO Clients
```

## Running the Project

### Prerequisites

- Node.js and npm
- RabbitMQ
- Redis

### Setup

1. Clone the repository.
2. Install dependencies using the package manager and lockfile included in the project.
3. Configure the RabbitMQ and Redis connection settings expected by the application.
4. Start RabbitMQ and Redis.
5. Start the NestJS application using the development command defined in `package.json`.

Refer to the repository's configuration and scripts for the exact environment variable names and commands.

## Potential Areas for Further Development

Depending on the current implementation, useful areas to document or extend include:

- Message acknowledgement and retry behavior.
- Handling transient failures during notification delivery.
- Idempotent event processing.
- Logging and monitoring of message processing.
- Handling offline recipients and notification persistence.

These are potential extensions, not claims that every capability is already implemented.

## License

UNLICENSED
