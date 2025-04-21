import json
import asyncio
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from game_logic.core import GameState
from game_logic.card import Card
# 以下兩行都要放在class裡每個真的要用的def裡面 才不會一開始就跑 出現錯誤
# from .models import Room, GameSession, Player
# from django.contrib.auth.models import User

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
        
        # 測試階段可以允許非登入用戶連接，但會有限制
        # 將用戶登入信息保存到 self
        if self.user.is_authenticated:
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'歡迎 {self.user.username}! 已成功連接至遊戲伺服器'
            }))
            
            # 同時通知其他人此用戶已連接
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_notification',
                    'message': f'{self.user.username} 已加入遊戲',
                    'username': self.user.username,
                    'action': 'join'
                }
            )
            
            # 嘗試將用戶加入房間
            room_joined = await self.join_room_db()
            if room_joined:
                # 獲取房間當前玩家列表
                players = await self.get_room_players()
                await self.send(text_data=json.dumps({
                    'type': 'room_info',
                    'players': players,
                    'room': self.room_name
                }))
                
                # 如果有足夠的玩家且遊戲尚未開始，可以檢查是否可以開始遊戲
                game_session = await self.get_active_game_session()
                if game_session and len(players) >= 2:  # 至少需要2名玩家
                    # 這裡可以自動開始遊戲，或者等待房主點擊開始
                    pass
        else:
            # 允許非登入用戶連接，但使用臨時用戶名（開發測試階段）
            self.temp_username = f"訪客_{self.channel_name[-8:]}"
            await self.send(text_data=json.dumps({
                'type': 'connection_established',
                'message': f'歡迎 {self.temp_username}! 已成功連接至遊戲伺服器（訪客模式）'
            }))
            
            # 通知其他人此訪客已連接
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_notification',
                    'message': f'{self.temp_username} 已加入遊戲',
                    'username': self.temp_username,
                    'action': 'join'
                }
            )
            
            # 在開發階段，可以臨時允許訪客也加入房間
            # 這裡可以實現一個簡化版的訪客加入邏輯

    async def disconnect(self, close_code):
        # 如果用戶已登入，通知其他人此用戶已離開
        if hasattr(self, 'user') and self.user.is_authenticated:
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'user_notification',
                    'message': f'{self.user.username} 已離開遊戲',
                    'username': self.user.username,
                    'action': 'leave'
                }
            )
            
            # 可以選擇在這裡將用戶從房間移除或標記為非活躍
            # await self.remove_player_from_game()
        
        # 離開房間群組
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    # 從 WebSocket 接收訊息
    async def receive(self, text_data):
        data = json.loads(text_data)
        message_type = data.get('type')
        
        if message_type == 'start_game':
            # 開始遊戲
            await self.start_game()
        
        elif message_type == 'play_card':
            # 玩家出牌
            card_idx = data.get('card_idx')
            await self.handle_play_card(card_idx)
        
        elif message_type == 'chat_message':
            # 處理聊天訊息
            message = data.get('message')
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'chat_message',
                    'message': message,
                    'username': self.user.username
                }
            )
    
    # 處理聊天訊息
    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'chat_message',
            'message': event['message'],
            'username': event['username']
        }))
    
    # 用戶通知（加入/離開）
    async def user_notification(self, event):
        await self.send(text_data=json.dumps({
            'type': 'user_notification',
            'message': event['message'],
            'username': event['username'],
            'action': event['action']
        }))
    
    # 開始遊戲
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
    
    # 遊戲已開始通知
    async def game_started(self, event):
        await self.send(text_data=json.dumps({
            'type': 'game_started',
            'player_count': event['player_count'],
            'players': event['players']
        }))
    
    # 處理發牌
    async def deal_cards(self, event):
        # 只發送給指定用戶
        if self.user.id == event['user_id']:
            await self.send(text_data=json.dumps({
                'type': 'deal_cards',
                'hand': event['hand']
            }))
    
    # 更新牌桌
    async def update_board(self, event):
        await self.send(text_data=json.dumps({
            'type': 'update_board',
            'board': event['board']
        }))
    
    # 處理玩家出牌
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
    
    # 處理玩家出牌通知
    async def card_played(self, event):
        await self.send(text_data=json.dumps({
            'type': 'card_played',
            'player_idx': event['player_idx'],
            'player_username': event['player_username'],
            'card_idx': event['card_idx'],
            'result': event['result']
        }))
    
    # 以下是資料庫操作函數
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
    def get_room_players(self):
        from .models import Room, GameSession, Player
        """獲取房間中的所有玩家"""
        try:
            room = Room.objects.get(name=self.room_name)
            game_session = GameSession.objects.filter(room=room, active=True).first()
            
            if game_session:
                players = Player.objects.filter(game=game_session)
                return [
                    {
                        'id': player.user.id,
                        'username': player.user.username,
                        'score': player.score
                    }
                    for player in players
                ]
            return []
        except Exception as e:
            print(f"Error getting players: {e}")
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