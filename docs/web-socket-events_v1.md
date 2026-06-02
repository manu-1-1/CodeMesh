# CodeMesh WebSocket Events

---

# Client → Server Events

## send_message

```json
{
  "event": "send_message",
  "channelId": "uuid",
  "content": "Hello World"
}
```

---

## join_channel

```json
{
  "event": "join_channel",
  "channelId": "uuid"
}
```

---

## leave_channel

```json
{
  "event": "leave_channel",
  "channelId": "uuid"
}
```

---

## typing

```json
{
  "event": "typing",
  "channelId": "uuid"
}
```

---

# Server → Client Events

## new_message

```json
{
  "event": "new_message",
  "message": {}
}
```

---

## message_edited

```json
{
  "event": "message_edited",
  "message": {}
}
```

---

## message_deleted

```json
{
  "event": "message_deleted",
  "messageId": "uuid"
}
```

---

## user_joined

```json
{
  "event": "user_joined",
  "user": {}
}
```

---

## user_left

```json
{
  "event": "user_left",
  "user": {}
}
```

---

## typing_started

```json
{
  "event": "typing_started",
  "userId": "uuid"
}
```

---

## typing_stopped

```json
{
  "event": "typing_stopped",
  "userId": "uuid"
}
```

---

# WebSocket Connection Flow

1. User authenticates using JWT.
2. User establishes WebSocket connection.
3. Server validates JWT token.
4. User joins a workspace channel.
5. Messages are broadcast to channel members.
6. Events are persisted to PostgreSQL.
7. Redis Pub/Sub distributes events across multiple instances.
