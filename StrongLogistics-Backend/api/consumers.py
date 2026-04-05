import uuid
import json
from datetime import datetime, timezone
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.layers import get_channel_layer


class NotificationConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        from rest_framework_simplejwt.tokens import AccessToken
        from django.contrib.auth import get_user_model

        token = self.scope['query_string'].decode()
        token_value = None
        for part in token.split('&'):
            if part.startswith('token='):
                token_value = part[6:]
                break

        if not token_value:
            await self.close()
            return

        try:
            access_token = AccessToken(token_value)
            user = await self.get_user(access_token['user_id'])
            if user is None or not user.is_active:
                await self.close()
                return
        except Exception:
            await self.close()
            return

        self.group_name = 'notifications'
        await self.channel_layer.group_add(self.group_name, self.channel_name)
        await self.accept()

    async def disconnect(self, close_code):
        if hasattr(self, 'group_name'):
            await self.channel_layer.group_discard(self.group_name, self.channel_name)

    async def receive(self, text_data):
        pass

    async def notification_message(self, event):
        await self.send(text_data=json.dumps(event['data']))

    @staticmethod
    async def get_user(user_id):
        from channels.db import database_sync_to_async
        from django.contrib.auth import get_user_model
        User = get_user_model()

        @database_sync_to_async
        def fetch():
            try:
                return User.objects.get(pk=user_id)
            except User.DoesNotExist:
                return None

        return await fetch()


async def broadcast_notification(notification_type, message):
    channel_layer = get_channel_layer()
    notification = {
        'id': str(uuid.uuid4()),
        'type': notification_type,
        'message': message,
        'timestamp': datetime.now(timezone.utc).isoformat(),
        'read': False,
    }
    await channel_layer.group_send(
        'notifications',
        {
            'type': 'notification_message',
            'data': notification,
        }
    )
