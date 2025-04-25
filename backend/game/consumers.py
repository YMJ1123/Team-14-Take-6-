import json
import asyncio
import uuid
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from game_logic.core import GameState
from game_logic.card import Card

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'game_{self.room_name}'
        self.user = self.scope['user']

        # 加入房間群組
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )

        await self.accept()
        
        # 處理用戶連接
        if self.user.is_authenticated:
            # 已登入用戶
            self.username = self.user.username
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'歡迎 {self.username}! 已成功連接至遊戲伺服器'
            }))
            
            # 將登入用戶加入房間
            await self.join_room_db()
        else:
            # 訪客用戶生成臨時用戶名
            self.temp_username = f"訪客_{uuid.uuid4().hex[:8]}"
            self.username = self.temp_username
            
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'歡迎 {self.username}! 已成功連接至遊戲伺服器（訪客模式）'
            }))
            
            # 將訪客加入房間（重要：確保訪客也被添加到玩家列表）
            await self.join_guest_to_room()
        
        # 通知其他人新用戶已連接
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_notification',
                'message': f'{self.username} 已加入遊戲',
                'username': self.username
            }
        )
        
        # 更新房間玩家列表
        players = await self.get_room_players()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'room_info',
                'players': players,
                'room': self.room_name
            }
        )

    async def disconnect(self, close_code):
        # 獲取將要離開的用戶名
        username = getattr(self, 'username', None) or (
            self.user.username if hasattr(self, 'user') and self.user.is_authenticated else "未知用戶"
        )
        
        # 移除離開的玩家（包括訪客）
        await self.remove_player_from_room()
        
        # 通知其他用戶有人離開
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_notification',
                'message': f'{username} 已離開遊戲',
                'username': "系統"
            }
        )
        
        # 更新房間玩家列表
        players = await self.get_room_players()
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'room_info',
                'players': players,
                'room': self.room_name
            }
        )
        
        # 離開房間群組
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        # 獲取用戶名（登入用戶或訪客）
        username = getattr(self, 'username', None) or (self.user.username if hasattr(self, 'user') and self.user.is_authenticated else None)
        
        if message_type == 'start_game':
            # 開始遊戲
            await self.start_game()
        
        elif message_type == 'play_card':
            # 玩家出牌
            card_idx = data.get('card_idx')
            await self.handle_play_card(card_idx)
        
        elif message_type == 'chat_message':
            message = data.get('message')
            
            # 發送給群組時包含用戶名
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'username': username
                }
            )

    async def chat_message(self, event):
        # 確保消息中包含用戶名
        username = event.get('username', '系統')
        
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': username
        }))
    
    async def user_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_notification',
            'message': event['message'],
            'username': event.get('username', '系統')
        }))
    
    async def start_game(self):
        # 檢查用戶是否有權限開始遊戲
        is_admin = await self.check_user_is_admin()
        if not is_admin:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '只有房主可以開始遊戲'
            }))
            return
        
        # 獲取房間玩家列表
        players = await self.get_room_players()
        player_count = len(players)
        
        if player_count < 2:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '至少需要2名玩家才能開始遊戲'
            }))
            return
        
        # 初始化遊戲狀態
        game_state = GameState(player_count)
        
        # 將遊戲狀態儲存到 channel layer 供所有客戶端使用
        self.game_state = game_state
        
        # 通知所有玩家遊戲已開始
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'game_started',
                'player_count': player_count,
                'players': players
            }
        )
        
        # 分發手牌給各個玩家
        for idx, player in enumerate(players):
            # 獲取該玩家的 channel name (實際實現可能需要額外步驟)
            user_id = player['id']
            hand = [{'value': card.value, 'bull_heads': card.bull_heads} for card in game_state.player_hands[idx]]
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'deal_cards',
                    'hand': hand,
                    'user_id': user_id
                }
            )
        
        # 發送初始牌桌狀態給所有玩家
        initial_board = []
        for row in game_state.board_rows:
            row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
            initial_board.append(row_cards)
        
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'update_board',
                'board': initial_board
            }
        )
    
    async def game_started(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_started',
            'player_count': event['player_count'],
            'players': event['players']
        }))
    
    async def deal_cards(self, event):
        # 只發送給指定用戶
        if self.user.id == event['user_id']:
            await self.send(text_data=json.dumps({
                'type': 'deal_cards',
                'hand': event['hand']
            }))
    
    async def update_board(self, event):
        await self.send(text_data=json.dumps({
            'type': 'update_board',
            'board': event['board']
        }))
    
    async def handle_play_card(self, card_idx):
        if not hasattr(self, 'game_state'):
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '遊戲尚未開始'
            }))
            return
        
        # 獲取玩家在遊戲中的索引
        player_idx = await self.get_player_index()
        if player_idx is None:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '你不是此遊戲的玩家'
            }))
            return
        
        # 執行遊戲邏輯處理出牌
        try:
            result = self.game_state.play_card(player_idx, card_idx)
            
            # 通知所有玩家有人出牌
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'card_played',
                    'player_idx': player_idx,
                    'player_username': self.user.username,
                    'card_idx': card_idx,
                    'result': result
                }
            )
            
            # 更新牌桌
            updated_board = []
            for row in self.game_state.board_rows:
                row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
                updated_board.append(row_cards)
            
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'update_board',
                    'board': updated_board
                }
            )
            
            # 檢查是否所有玩家都已出牌
            # 如果是這一輪的最後一張牌，則進行遊戲狀態更新
            # 這部分邏輯需要根據遊戲規則進行調整
            
        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'出牌錯誤: {str(e)}'
            }))
    
    async def card_played(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card_played',
            'player_idx': event['player_idx'],
            'player_username': event['player_username'],
            'card_idx': event['card_idx'],
            'result': event['result']
        }))
    
    async def room_info(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_info',
            'players': event['players'],
            'room': event['room']
        }))
    
    @database_sync_to_async
    def join_room_db(self):
        from .models import Room, GameSession, Player
        """將用戶加入到房間的資料庫記錄中"""
        try:
            room, created = Room.objects.get_or_create(name=self.room_name)
            game_session = GameSession.objects.filter(room=room, active=True).first()
            
            if not game_session:
                game_session = GameSession.objects.create(room=room)
            
            player, created = Player.objects.get_or_create(
                user=self.user,
                game=game_session
            )
            
            return True
        except Exception as e:
            print(f"Error joining room: {e}")
            return False

    @database_sync_to_async
    def join_guest_to_room(self):
        from .models import Room, GameSession, Player
        from django.contrib.auth.models import User
        
        try:
            # 為訪客創建臨時用戶記錄
            # 注意：實際生產環境中可能需要不同的處理方式
            temp_user, created = User.objects.get_or_create(
                username=self.temp_username,
                defaults={
                    'password': uuid.uuid4().hex,  # 生成隨機密碼
                    'is_active': False  # 訪客用戶不可登入
                }
            )
            
            # 記錄訪客用戶ID便於後續操作
            self.guest_user_id = temp_user.id
            
            # 獲取或創建房間
            room, _ = Room.objects.get_or_create(name=self.room_name)
            
            # 獲取活躍的遊戲會話，如果沒有則創建
            game_session = GameSession.objects.filter(room=room, active=True).first()
            if not game_session:
                game_session = GameSession.objects.create(room=room, active=True)
            
            # 將訪客加入玩家列表
            player, created = Player.objects.get_or_create(
                user=temp_user,
                game=game_session,
                defaults={'score': 0}
            )
            
            return True
        except Exception as e:
            print(f"加入訪客到房間時出錯: {str(e)}")
            return False

    @database_sync_to_async
    def remove_player_from_room(self):
        from .models import Room, GameSession, Player
        from django.contrib.auth.models import User
        
        try:
            # 獲取房間
            room = Room.objects.get(name=self.room_name)
            
            # 獲取當前活躍的遊戲會話
            game_session = GameSession.objects.filter(room=room, active=True).first()
            if not game_session:
                return False
            
            # 確定要移除的用戶
            if self.user.is_authenticated:
                # 登入用戶
                user = self.user
            elif hasattr(self, 'guest_user_id'):
                # 訪客用戶
                user = User.objects.get(id=self.guest_user_id)
            else:
                # 無法確定用戶，中斷操作
                return False
            
            # 移除玩家
            Player.objects.filter(user=user, game=game_session).delete()
            
            # 如果是訪客，還可以考慮刪除臨時用戶記錄
            if hasattr(self, 'guest_user_id') and not self.user.is_authenticated:
                User.objects.filter(id=self.guest_user_id).delete()
            
            return True
        except Exception as e:
            print(f"從房間移除玩家時出錯: {str(e)}")
            return False

    @database_sync_to_async
    def get_room_players(self):
        from .models import Room, GameSession, Player
        
        try:
            # 獲取房間
            room = Room.objects.get(name=self.room_name)
            
            # 獲取當前活躍的遊戲會話
            game_session = GameSession.objects.filter(room=room, active=True).first()
            if not game_session:
                return []
            
            # 獲取所有玩家（包括訪客）
            players = Player.objects.filter(game=game_session).select_related('user')
            
            # 格式化玩家數據
            result = []
            for player in players:
                result.append({
                    'username': player.user.username,
                    'score': player.score or 0,
                    'is_guest': player.user.username.startswith('訪客_')
                })
            
            return result
        except Exception as e:
            print(f"獲取房間玩家時出錯: {str(e)}")
            return []

    @database_sync_to_async
    def check_user_is_admin(self):
        from .models import Room, GameSession, Player
        """檢查用戶是否是房間管理員"""
        # 簡易實現: 假設第一個加入房間的玩家是房主
        try:
            room = Room.objects.get(name=self.room_name)
            game_session = GameSession.objects.filter(room=room, active=True).first()
            
            if game_session:
                first_player = Player.objects.filter(game=game_session).order_by('joined_at').first()
                return first_player and first_player.user == self.user
            return False
        except Exception as e:
            print(f"Error checking admin: {e}")
            return False
    
    @database_sync_to_async
    def get_active_game_session(self):
        from .models import Room, GameSession
        """獲取活躍的遊戲會話"""
        try:
            room = Room.objects.get(name=self.room_name)
            return GameSession.objects.filter(room=room, active=True).first()
        except Exception as e:
            print(f"Error getting game session: {e}")
            return None
    
    @database_sync_to_async
    def get_player_index(self):
        from .models import Room, GameSession, Player
        """獲取玩家在遊戲中的索引"""
        try:
            room = Room.objects.get(name=self.room_name)
            game_session = GameSession.objects.filter(room=room, active=True).first()
            
            if game_session:
                players = list(Player.objects.filter(game=game_session).order_by('joined_at'))
                for idx, player in enumerate(players):
                    if player.user == self.user:
                        return idx
            return None
        except Exception as e:
            print(f"Error getting player index: {e}")
            return None