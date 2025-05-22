import json
import asyncio
import uuid
import random
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from game_logic.core import GameState
from game_logic.card import Card
from .game_room import GameRoom  # 導入 GameRoom 類

class GameConsumer(AsyncWebsocketConsumer):
    async def connect(self):
        self.room_name = self.scope['url_route']['kwargs']['room_name']
        self.room_group_name = f'game_{self.room_name}'
        self.user = self.scope["user"]
        # 創建一個集合來存儲已經處理過分數扣除的玩家ID
        self.processed_players = set()
        
        # 從 URL 參數中獲取用戶名
        query_string = self.scope.get('query_string', b'').decode()
        query_params = dict(param.split('=') for param in query_string.split('&') if param)
        provided_username = query_params.get('username')
        
        # 檢查是否提供了用戶名且用戶已登錄
        if not provided_username or not self.user.is_authenticated:
            # 如果沒有提供用戶名或用戶未登入，拒絕連接
            print(f"拒絕未登入或未提供用戶名的連接請求")
            await self.close()
            return
            
        await self.accept()
        
        # 已登入用戶使用其實際用戶名
        self.username = self.user.username
        self.display_name = self.user.username
        self.is_guest = False
        print(f"已登入用戶: {self.username}")
        
        # 獲取或創建遊戲房間，並將玩家添加到房間
        self.game_room = GameRoom.get_room(self.room_name)
        self.game_room.add_player(self.user.id, self.display_name, self.is_guest)
        
        # 加入房間
        room_exists = await self.add_player_to_room()
        if not room_exists:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '房間不存在'
            }))
            return
        
        # 加入房間群組
        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        # 通知其他用戶有新人加入
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'user_notification',
                'message': f'{self.display_name} 加入了遊戲',
                'username': "系統"
            }
        )
        
        # 發送身份確認訊息給剛連接的客戶端
        await self.send(text_data=json.dumps({
            'type': 'connection_established',
            'playerId': self.user.id,
            'message': f'歡迎 {self.display_name}!',
            'isGuest': self.is_guest
        }))
        
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
        
        # 從共享房間中移除玩家
        if hasattr(self, 'game_room'):
            self.game_room.remove_player(self.user.id)
            # 如果房間為空，可以考慮移除房間
            if self.game_room.get_player_count() == 0:
                GameRoom.remove_room(self.room_name)
        
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
        try:
            data = json.loads(text_data)
            message_type = data.get('type')
            
            # 獲取用戶名（登入用戶或訪客）
            username = getattr(self, 'display_name', None) or getattr(self, 'username', None) or (self.user.username if hasattr(self, 'user') and self.user.is_authenticated else None)
            
            if message_type == 'request_room_info':
                # 處理請求房間信息的消息
                players = await self.get_room_players()
                await self.send(text_data=json.dumps({
                    'type': 'room_info',
                    'players': players
                }))
                return
                
            # 處理玩家請求卡牌的消息
            if message_type == 'request_cards':
                # 檢查遊戲是否已經開始
                if not self.game_room.has_game_state():
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': '遊戲尚未開始'
                    }))
                    return
                    
                # 獲取玩家在遊戲中的索引 (從 get_player_index 獲取，與資料庫玩家順序一致)
                player_idx = await self.get_player_index()
                if player_idx is None:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': '你不是此遊戲的玩家'
                    }))
                    return
                    
                # 將前端傳來的 player_index 作為參考，但實際使用後端資料庫的順序
                # 用於比較/檢查，但使用後端資料的 player_idx 作為真實資料來源
                requested_idx = data.get('player_index', -1)
                if player_idx != requested_idx:
                    print(f"警告: 玩家要求的索引 ({requested_idx}) 與伺服器計算的索引 ({player_idx}) 不一致")
                    
                # 獲取該玩家的手牌（從共享的 GameState 中獲取）
                game_state = self.game_room.game_state
                if player_idx < len(game_state.player_hands):
                    hand = game_state.player_hands[player_idx]
                    # 轉換成可序列化的格式
                    hand_data = [{'value': card.value, 'bull_heads': card.bull_heads} for card in hand]
                    
                    # 直接向請求的玩家發送手牌
                    await self.send(text_data=json.dumps({
                        'type': 'cards_assigned',
                        'cards': hand_data
                    }))
                    
                    # 記錄發牌日誌
                    print(f"已向玩家 {username} (索引 {player_idx}) 發送手牌: {[card['value'] for card in hand_data]}")
                    return
                else:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': '無法找到您的手牌'
                    }))
                    return

            if message_type == 'request_cards_again':
                # 獲取該玩家的手牌（從共享的 GameState 中獲取）
                print("request_cards_again")
                game_state = self.game_room.game_state
                print("game_state: ", game_state)
                print("people: ",len(game_state.player_hands))
                player_id = self.user.id
                player_id_room = self.game_room.get_player_index(player_id)
                print("player_id: ", player_id)
                print("player_id_room: ", player_id_room)
                if player_id_room < len(game_state.player_hands):
                    hand = game_state.player_hands[player_id_room]
                    print("hand: ", hand)
                    # 轉換成可序列化的格式
                    hand_data = [{'value': card.value, 'bull_heads': card.bull_heads} for card in hand]
                    
                    # 直接向請求的玩家發送手牌
                    await self.send(text_data=json.dumps({
                        'type': 'cards_assigned',
                        'cards': hand_data
                    }))
                    
                    # 記錄發牌日誌
                    print(f"已向玩家 {username} 亦是 {player_id}(房間編號 {player_id_room}) 發送手牌: {[card['value'] for card in hand_data]}")
                    return
                else:
                    await self.send(text_data=json.dumps({
                        'type': 'error',
                        'message': '無法找到您的手牌'
                    }))
                    return

            if message_type == 'start_game':
                # 廣播遊戲開始消息給所有玩家
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'game_started',
                        'message': '遊戲開始！',
                        'username': username
                    }
                )
                
                # 在這裡啟動遊戲，創建 game_state
                await self.start_game()
                return

            if message_type == 'player_ready':
                is_ready = data.get('is_ready', False)
                if username:
                    await self._update_player_ready_status_db(username, is_ready)
                else:
                    print("Error: username not found for player_ready message")

                print(f"Player {username} is now {'ready' if is_ready else 'not ready'}")

                # 檢查用戶是否為房主
                is_admin = await self.check_user_is_admin()
                
                # 發送準備狀態更新和房主資訊給房間內所有人
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'player_ready_state',
                        'username': username,
                        'is_ready': is_ready,
                        'is_admin': is_admin, # 新增房主信息
                        'user_id': self.user.id # 新增用戶ID方便前端識別
                    }
                )
                # 同時直接回傳給請求的用戶，確保他立刻收到房主資訊
                await self.send(text_data=json.dumps({
                    'type': 'admin_check',
                    'is_admin': is_admin,
                    'username': username
                }))
                return
            
            elif message_type == 'play_card':
                # 玩家出牌
                card_idx = data.get('card_idx')
                card_value = data.get('value', 0)
                bull_heads = data.get('bull_heads', 0)
                player_name = data.get('player_name', username)
                
                # 記錄日誌以便調試
                print(f"接收到出牌請求: 玩家ID={self.user.id}, 用戶名={self.user.username}, 顯示名={player_name}, 卡片索引={card_idx}")
                
                # 始終使用當前連接的用戶ID作為玩家識別，而不是前端傳來的值
                await self.handle_play_card(card_idx, card_value, bull_heads, player_name)
            
            # 處理玩家選擇列的消息
            elif message_type == 'choose_row_response':
                row_index = data.get('row_index')
                player_id = self.user.id  # 使用當前用戶ID
                print("choose_row_response: row index", row_index, "player id ", player_id)
                # 調用 GameRoom 的 handle_choose_row 方法處理選擇
                results = self.game_room.handle_choose_row(player_id, row_index)
                
                # 檢查是否有更多玩家需要選擇行
                if results and isinstance(results, dict) and results.get('type') == 'choose_row_needed':
                    player_id = results.get('player_id')
                    player_name = results.get('player_name')
                    row_bull_heads = results.get('row_bull_heads')
                    
                    print("嗨嗨 player_id: ", player_id)
                    print("嗨嗨 player_name: ", player_name)
                    # 向需要選擇的玩家發送選擇列的消息
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'choose_row',
                            'sender_id': player_id,
                            'player_name': player_name,
                            'row_bull_heads': row_bull_heads
                        }
                    )
                    
                    # 向其他玩家廣播等待消息
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'wait_choose_card',
                            'player_id': player_id,
                            'player_name': player_name
                        }
                    )
                    return
                
                # 所有選擇都已完成，廣播最終結果
                if results:
                    # 清空已處理玩家記錄（新回合重新開始）
                    self.processed_players = set()
                    # 檢查結果是否包含需要扣分的情況（收集牛頭）
                    for result_item in results:
                        if isinstance(result_item, dict) and result_item.get('result') and result_item['result'].get('action') == 'collect':
                            # 獲取要扣除的牛頭數
                            bull_heads = result_item['result'].get('bull_heads', 0)
                            player_id = result_item['player_id']
                            
                            # 確保每個玩家只處理一次
                            if bull_heads > 0 and player_id not in self.processed_players:
                                # 記錄已處理的玩家
                                self.processed_players.add(player_id)
                                
                                # 更新玩家分數
                                updated_player = await self.update_player_score_and_check_game_over(player_id, bull_heads)
                                
                                if updated_player:
                                    # 廣播分數更新
                                    await self.channel_layer.group_send(
                                        self.room_group_name,
                                        {
                                            'type': 'update_player_score',
                                            'username': updated_player['username'],
                                            'score': updated_player['score']
                                        }
                                    )
                
                    # 更新牌桌
                    updated_board = []
                    for row in self.game_room.game_state.board_rows:
                        row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
                        updated_board.append(row_cards)
                    
                    # 廣播遊戲結果 - 包含玩家索引、卡牌值等信息
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'round_completed',
                            'results': results,
                            'board': updated_board
                        }
                    )
                    
                    # 檢查出牌玩家手牌是否已用完 (手牌數為0)
                    player_index = await self.get_player_index()
                    if player_index is not None and player_index < len(self.game_room.game_state.player_hands):
                        if len(self.game_room.game_state.player_hands[player_index]) == 0:
                            print(f"玩家 {self.user.username} (ID: {self.user.id}) 手牌已用完，重新發牌...")
                            
                            # 獲取玩家數量
                            player_count = self.game_room.get_player_count()
                            print("player_count: ", player_count)

                            # 找出玩家id順序
                            room_players_db = await self.get_room_players_sorted() 
                            ordered_player_ids = [player['id'] for player in room_players_db]
                            print(f"遊戲重新發牌，有序玩家ID列表: {ordered_player_ids}")
                            
                            # 重新初始化遊戲狀態（重置牌桌和手牌，但保留玩家分數）
                            self.game_room.game_state = None  # 先清空現有遊戲狀態
                            self.game_room.initialize_game_state(player_count, ordered_player_ids)  # 重新創建遊戲狀態
                            
                            # 更新牌桌
                            new_board = []
                            for row in self.game_room.game_state.board_rows:
                                row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
                                new_board.append(row_cards)
                            
                            print("遊戲已重置，通知所有玩家1")
                            print("new_board: ", new_board)
                            print("player_count: ", player_count)
                            # 通知所有玩家遊戲已重置
                            await self.channel_layer.group_send(
                                self.room_group_name,
                                {
                                    'type': 'game_restarted',
                                    'message': '遊戲已重新發牌，玩家分數保持不變',
                                    'board': new_board
                                }
                            )
            
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

        except Exception as e:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': f'處理消息時出錯: {str(e)}'
            }))

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
        
        # 獲取房間玩家列表（確保按加入順序排序）
        room_players_db = await self.get_room_players_sorted() # 新方法，用於獲取排序後的玩家信息
        player_count = len(room_players_db)
        
        if player_count < 2:
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '至少需要2名玩家才能開始遊戲'
            }))
            return
        
        # 提取有序的玩家ID列表
        ordered_player_ids = [player['id'] for player in room_players_db]
        print(f"遊戲開始，有序玩家ID列表: {ordered_player_ids}")
        
        # 使用共享的 GameRoom 初始化遊戲狀態，並傳入有序玩家ID列表
        game_state = self.game_room.initialize_game_state(player_count, ordered_player_ids)
        
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
        """處理遊戲開始事件"""
        await self.send(text_data=json.dumps({
            'type': 'game_started',
            'message': event['message'],
            'username': event['username']
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
    
    async def handle_play_card(self, card_idx, card_value, bull_heads, player_name):
        # 檢查遊戲是否已經開始
        if not self.game_room.has_game_state():
            await self.send(text_data=json.dumps({
                'type': 'error',
                'message': '遊戲尚未開始'
            }))
            return
        
        # 使用self.user.id作為玩家唯一識別符，這是資料庫中的用戶ID
        player_id = self.user.id
        
        # 添加詳細的日誌記錄
        print(f"處理出牌請求: 玩家ID={player_id}, 玩家名稱={player_name}, 卡片索引={card_idx}, 卡片值={card_value}")
        
        # 獲取玩家在遊戲中的索引
        player_index = await self.get_player_index()
        if player_index is not None:
            print(f"玩家 {player_id} 在遊戲中的索引為 {player_index}")
            # 檢查玩家手牌
            if player_index < len(self.game_room.game_state.player_hands):
                player_hand = self.game_room.game_state.player_hands[player_index]
                # 驗證卡片索引
                if 0 <= card_idx < len(player_hand):
                    actual_card = player_hand[card_idx]
                    print(f"玩家手牌中索引 {card_idx} 的卡片是: 值={actual_card.value}, 牛頭數={actual_card.bull_heads}")
                    # 驗證卡片值
                    if actual_card.value != card_value:
                        print(f"警告: 前端傳來的卡片值 ({card_value}) 與後端手牌實際值 ({actual_card.value}) 不一致")
        
        # 記錄玩家出牌 (使用用戶ID而不是前端傳來的player_id)
        all_played = self.game_room.record_played_card(player_id, card_idx, card_value, player_name)
        
        print(f"記錄玩家出牌: 玩家ID={player_id}, 用戶名={self.user.username}, 顯示名={player_name}, 卡片值={card_value}")
        
        # 通知其他玩家有人出牌(不顯示是哪張牌)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'card_played',
                'sender_id': player_id, # 使用正確的用戶ID
                'player_name': player_name, # 使用前端提供的顯示名
                'player_username': self.user.username, # 資料庫中的用戶名
                'card_value': card_value, 
                'bull_heads': bull_heads, 
                'player_idx': await self.get_player_index()
            }
        )
        
        # 如果所有玩家都已出牌，進行遊戲邏輯處理
        if all_played:
            print("所有玩家都已出牌，處理遊戲邏輯")
            # 處理所有已出牌，這裡會使用玩家索引而不是絕對ID，並按照卡牌值排序
            results = self.game_room.process_played_cards()
            
            # 檢查是否有玩家需要選擇列
            if isinstance(results, dict) and results.get('type') == 'choose_row_needed':
                player_id = results.get('player_id')
                player_name = results.get('player_name')
                row_bull_heads = results.get('row_bull_heads', [])
                
                if not player_name and player_id:
                    # 嘗試從玩家 ID 查找用戶名
                    for player in await self.get_room_players():
                        if str(player['id']) == str(player_id):
                            player_name = player['username']
                            break
                    if not player_name:
                        player_name = "未知玩家"
                
                print(f"玩家 {player_id}({player_name}) 需要選擇一列，牛頭數: {row_bull_heads}")
                
                # 向需要選擇的玩家發送選擇列的消息
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'choose_row',
                        'sender_id': player_id,
                        'player_name': player_name,
                        'row_bull_heads': row_bull_heads
                    }
                )
                
                # 向其他玩家廣播等待消息
                await self.channel_layer.group_send(
                    self.room_group_name,
                    {
                        'type': 'wait_choose_card',
                        'player_id': player_id,
                        'player_name': player_name
                    }
                )
                
                return
            
            # 正常流程：更新牌桌
            if results:
                # 清空已處理玩家記錄（新回合重新開始）
                self.processed_players = set()
                
                # 檢查結果是否包含需要扣分的情況（收集牛頭）
                for result_item in results:
                    if isinstance(result_item, dict) and result_item.get('result') and result_item['result'].get('action') == 'collect':
                        # 獲取要扣除的牛頭數
                        bull_heads = result_item['result'].get('bull_heads', 0)
                        player_id = result_item['player_id']
                        
                        # 確保每個玩家只處理一次
                        if bull_heads > 0 and player_id not in self.processed_players:
                            # 記錄已處理的玩家
                            self.processed_players.add(player_id)
                            
                            # 更新玩家分數
                            updated_player = await self.update_player_score_and_check_game_over(player_id, bull_heads)
                            
                            if updated_player:
                                # 廣播分數更新
                                await self.channel_layer.group_send(
                                    self.room_group_name,
                                    {
                                        'type': 'update_player_score',
                                        'username': updated_player['username'],
                                        'score': updated_player['score']
                                    }
                                )
                
                    # 更新牌桌
                    updated_board = []
                    for row in self.game_room.game_state.board_rows:
                        row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
                        updated_board.append(row_cards)
                    
                    # 廣播遊戲結果 - 包含玩家索引、卡牌值等信息
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'round_completed',
                            'results': results,
                            'board': updated_board
                        }
                    )
                
                # 檢查出牌玩家手牌是否已用完 (手牌數為0)
                player_index = await self.get_player_index()
                if player_index is not None and player_index < len(self.game_room.game_state.player_hands):
                    if len(self.game_room.game_state.player_hands[player_index]) == 0:
                        print(f"玩家 {self.user.username} (ID: {self.user.id}) 手牌已用完，重新發牌...")
                        
                        # 獲取玩家數量
                        player_count = self.game_room.get_player_count()

                        # 找出玩家id順序
                        room_players_db = await self.get_room_players_sorted() 
                        ordered_player_ids = [player['id'] for player in room_players_db]
                        print(f"遊戲重新發牌，有序玩家ID列表: {ordered_player_ids}")
                        
                        # 重新初始化遊戲狀態（重置牌桌和手牌，但保留玩家分數）
                        self.game_room.game_state = None  # 先清空現有遊戲狀態
                        self.game_room.initialize_game_state(player_count, ordered_player_ids)  # 重新創建遊戲狀態
                        
                        # 更新牌桌
                        new_board = []
                        for row in self.game_room.game_state.board_rows:
                            row_cards = [{'value': card.value, 'bull_heads': card.bull_heads} for card in row]
                            new_board.append(row_cards)
                        
                        # 通知所有玩家遊戲已重置
                        print("遊戲已重置，通知所有玩家2")
                        print("new_board: ", new_board)
                        print("player_count: ", player_count)
                        await self.channel_layer.group_send(
                            self.room_group_name,
                            {
                                'type': 'game_restarted',
                                'message': '遊戲已重新發牌，玩家分數保持不變',
                                'board': new_board
                            }
                        )
    
    async def card_played(self, event):
        # 如果自己是發送者，不發送此消息
        if event.get('sender_id') == self.user.id:
            print(f"忽略向發送者 {self.user.id} 自己發送出牌消息")
            return
            
        print(f"從發送者 {event.get('sender_id')} 收到出牌消息，準備轉發給用戶 {self.user.id}")
        print(f"消息內容: {event}")
        
        # 轉發給非發送者的玩家
        message = {
            'type': 'card_played',
            'player_username': event['player_username'],
            'card_value': event.get('card_value', 0),  # 添加卡牌值
            'bull_heads': event.get('bull_heads', 0),  # 添加牛頭數
            'player_name': event.get('player_name'),
            'player_id': event.get('sender_id'),  # 添加發送者ID作為玩家ID
            'player_idx': event.get('player_idx'),  # 添加玩家索引
            'sender_id': event.get('sender_id')  # 確保sender_id也被傳遞
        }
        
        print(f"轉發消息: {message}")
        
        await self.send(text_data=json.dumps(message))
    
    async def round_completed(self, event):
        """處理一輪出牌結束後的結果廣播"""
        # 如果結果包含卡片信息，確保使用原始卡片值
        results = event.get('results', [])
        if results and isinstance(results, list):
            for result_item in results:
                if isinstance(result_item, dict) and 'result' in result_item:
                    # 如果結果中有卡片資訊，且有記錄原始卡片值
                    if 'result' in result_item and result_item['result'] and 'card' in result_item['result']:
                        # 優先使用actual_card_value（外部指定的值）
                        if 'actual_card_value' in result_item['result']:
                            actual_value = result_item['result']['actual_card_value']
                            # 更新卡片值為前端傳來的值
                            result_item['result']['card']['value'] = actual_value
                            # 清理掉临时字段，避免前端处理混淆
                            del result_item['result']['actual_card_value']
                        # 向后兼容：如果有original_card_value，也使用它
                        elif 'original_card_value' in result_item['result']:
                            original_value = result_item['result']['original_card_value']
                            # 更新卡片值為前端傳來的值
                            result_item['result']['card']['value'] = original_value
                            # 清理掉临时字段，避免前端处理混淆
                            del result_item['result']['original_card_value']
                    
        # 發送更新後的結果
        await self.send(text_data=json.dumps({
            'type': 'round_completed',
            'results': results,
            'board': event['board']
        }))
    
    async def choose_row(self, event):
        print("嗨嗨 choose_row event: ", event)
        print("嗨嗨 self.user.id: ", self.user.id)
        print(type(event.get('sender_id')))
        print(type(self.user.id))
        sender_id = int(event.get('sender_id'))
        # 如果自己是發送者，才要通知前端顯示
        if sender_id == self.user.id:
            print("對我進來了")
            print("event.get('sender_id'): ", event.get('sender_id'))
            print("self.user.id: ", self.user.id)
            message = {
                'type': 'i_choose_row',
                'player_username': self.user.username,
                'bull_heads': event.get('row_bull_heads'),  
                'player_id': sender_id #event.get('sender_id'),  # 添加發送者ID作為玩家ID
            }
            await self.send(text_data=json.dumps(message))
            return
        
        # 如果是其他人，只要顯示一行字，代表用戶正在選擇牌
        await self.send(text_data=json.dumps({
            'type': 'wait_choose_card',
            'player_id': event.get('sender_id'),
            'player_name': event.get('player_name')
        }))
    
    async def room_info(self, event):
        await self.send(text_data=json.dumps({
            'type': 'room_info',
            'players': event['players'],
            'room': event['room']
        }))
    
    async def player_ready_state(self, event):
        """Handles the player_ready_state message from the group and sends it to the client."""
        await self.send(text_data=json.dumps({
            'type': 'player_ready_state',
            'username': event['username'],
            'is_ready': event['is_ready'],
            'is_admin': event.get('is_admin', False),  # 新增房主信息
            'user_id': event.get('user_id', None)
        }))
    
    @database_sync_to_async
    def _update_player_ready_status_db(self, username, is_ready):
        from .models import Player # GameSession, Room 已經在其他地方導入
        from django.contrib.auth.models import User
        try:
            user = User.objects.get(username=username)
            # 假設一個房間同一用戶只有一個活躍的 Player 實例
            player_obj = Player.objects.get(user=user, game__room__name=self.room_name, game__active=True)
            player_obj.is_ready = is_ready
            player_obj.save()
            print(f"Database: Player {username} ready status updated to {is_ready}")
            return True
        except User.DoesNotExist:
            print(f"Database Error: User {username} not found.")
            return False
        except Player.DoesNotExist:
            print(f"Database Error: Player {username} not found in active game session for room {self.room_name}.")
            return False
        except Exception as e:
            print(f"Database Error: Error updating player ready status for {username}: {e}")
            return False

    @database_sync_to_async
    def add_player_to_room(self):
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
            else:
                # 無法確定用戶，中斷操作
                return False
            
            # 移除玩家
            Player.objects.filter(user=user, game=game_session).delete()
            
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
            for player_obj in players: # Renamed from player to player_obj to avoid conflict
                # 檢查是否有設定顯示名稱
                player_id = player_obj.user.id
                display_name = None
                is_guest = player_obj.user.username.startswith('訪客_')
                
                # 從 GameRoom 獲取顯示名稱（如果有）
                if hasattr(self, 'game_room') and player_id in self.game_room.player_display_names:
                    display_name = self.game_room.player_display_names[player_id]['display_name']
                    is_guest = self.game_room.player_display_names[player_id]['is_guest']
                
                result.append({
                    'id': player_id,
                    'username': player_obj.user.username,
                    'display_name': display_name or player_obj.user.username,
                    'score': player_obj.score or 0,
                    'is_guest': is_guest,
                    'is_ready': player_obj.is_ready  # 包含 is_ready 狀態
                })
            
            return result
        except Room.DoesNotExist:
            print(f"Error getting room players: Room {self.room_name} does not exist.")
            return []
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

    @database_sync_to_async
    def create_guest_user(self, username):
        """創建訪客用戶"""
        try:
            # 在方法內部導入 User 模型
            from django.contrib.auth.models import User
            
            # 創建一個臨時用戶
            temp_user, created = User.objects.get_or_create(
                username=username,
                defaults={
                    'password': uuid.uuid4().hex,  # 隨機密碼
                    'is_active': True  # 需要是活躍的才能確保後續操作
                }
            )
            
            # 更新 self.user 為這個臨時用戶
            self.user = temp_user
            return temp_user
        except Exception as e:
            print(f"創建訪客用戶時出錯: {str(e)}")
            return None

    async def wait_choose_card(self, event):
        """通知其他玩家等待某個玩家選擇列"""
        # 如果自己是需要選擇的玩家，不發送等待消息
        player_id = int(event.get('player_id'))
        if player_id == self.user.id:
            print("嗨嗨 我是需要選擇的玩家")
            return
            
        await self.send(text_data=json.dumps({
            'type': 'wait_choose_card',
            'player_id': player_id,
            'player_name': event.get('player_name')
        }))

    @database_sync_to_async
    def get_and_update_player_score(self, player_id, bull_heads_to_deduct):
        """更新玩家分數，扣除收集到的牛頭數"""
        from .models import Player
        from django.contrib.auth.models import User
        print("get_and_update_player_score", player_id, bull_heads_to_deduct)
        try:
            # 獲取玩家資料
            player = Player.objects.get(user_id=player_id, game__room__name=self.room_name, game__active=True)
            
            # 更新分數（扣除收集到的牛頭數）
            player.score -= bull_heads_to_deduct
            player.save()
            
            print(f"已更新玩家 {player.user.username} (ID: {player_id}) 的分數：扣除 {bull_heads_to_deduct} 牛頭，目前分數為 {player.score}")
            
            # 返回玩家資料，包括是否需要觸發遊戲結束
            return {
                'username': player.user.username,
                'score': player.score,
                'game_over': player.score <= 0,
                'player': player
            }
        except Player.DoesNotExist:
            print(f"找不到玩家 ID {player_id} 的資料")
            return None
        except Exception as e:
            print(f"更新玩家分數時出錯: {str(e)}")
            return None

    async def update_player_score_and_check_game_over(self, player_id, bull_heads_to_deduct):
        """更新玩家分數並檢查是否需要結束遊戲"""
        # 調用資料庫同步方法更新分數
        result = await self.get_and_update_player_score(player_id, bull_heads_to_deduct)
        
        if not result:
            return None
            
        # 檢查是否需要結束遊戲
        if result.get('game_over', False):
            player = result.get('player')
            print(f"玩家 {result['username']} (ID: {player_id}) 分數歸零或負數，觸發遊戲結束")
            await self.handle_game_over(player)
        
        # 返回不包含內部資料的結果
        return {
            'username': result['username'],
            'score': result['score']
        }

    async def handle_game_over(self, player):
        """處理遊戲結束的邏輯"""
        try:
            # 獲取所有玩家的當前分數
            all_players = await self.get_room_players()
            
            # 將觸發結束的玩家標記為失敗者
            loser = {
                'id': player.user.id,
                'username': player.user.username,
                'score': player.score
            }
            
            # 獲取分數最高的玩家作為勝利者
            winners = sorted(all_players, key=lambda p: p['score'], reverse=True)
            
            # 準備遊戲結束數據
            game_over_data = {
                'losers': [loser],  # 只包含觸發遊戲結束的玩家
                'winners': winners[:1],  # 只取分數最高的玩家
                'all_players': sorted(all_players, key=lambda p: p['score'], reverse=True)  # 所有玩家按分數排序
            }
            
            # 通知所有玩家遊戲結束
            await self.channel_layer.group_send(
                self.room_group_name,
                {
                    'type': 'game_over',
                    'message': f'遊戲結束！玩家 {player.user.username} 分數歸零',
                    'data': game_over_data
                }
            )
            
            # 清理遊戲狀態
            self.game_room.game_state = None
        except Exception as e:
            print(f"處理遊戲結束時出錯: {str(e)}")
            return None

    async def game_over(self, event):
        """處理遊戲結束事件"""
        await self.send(text_data=json.dumps({
            'type': 'game_over',
            'message': event['message'],
            'data': event['data']
        }))

    async def update_player_score(self, event):
        """處理玩家分數更新的消息"""
        await self.send(text_data=json.dumps({
            'type': 'update_player_score',
            'username': event['username'],
            'score': event['score']
        }))
    
    async def game_restarted(self, event):
        """處理遊戲重新發牌的消息"""
        await self.send(text_data=json.dumps({
            'type': 'game_restarted',
            'message': event['message'],
            'board': event['board']
        }))
        print("遊戲已重置，通知前端")
        # 重置已處理玩家記錄
        self.processed_players = set()
        
        # 在重新發牌時，也要向玩家發送請求手牌的提示
        await self.send(text_data=json.dumps({
            'type': 'request_new_cards',
            'message': '請點擊取得新手牌'
        }))

    @database_sync_to_async
    def get_room_players_sorted(self):
        from .models import Room, GameSession, Player
        """獲取房間內所有玩家的資訊，並按加入時間排序"""
        try:
            room = Room.objects.get(name=self.room_name)
            game_session = GameSession.objects.filter(room=room, active=True).first()
            if not game_session:
                return []
            
            # 獲取所有玩家，並按 joined_at 排序
            players_queryset = Player.objects.filter(game=game_session).select_related('user').order_by('joined_at')
            
            result = []
            for player_obj in players_queryset:
                player_id = player_obj.user.id
                display_name = None
                is_guest = False  # 不再有訪客模式
                
                if hasattr(self, 'game_room') and player_id in self.game_room.player_display_names:
                    display_name = self.game_room.player_display_names[player_id]['display_name']
                    # is_guest 保持為 False
                
                result.append({
                    'id': player_id,
                    'username': player_obj.user.username,
                    'display_name': display_name or player_obj.user.username,
                    'score': player_obj.score or 0,
                    'is_guest': is_guest,
                    'is_ready': player_obj.is_ready
                })
            return result
        except Room.DoesNotExist:
            print(f"Error getting sorted room players: Room {self.room_name} does not exist.")
            return []
        except Exception as e:
            print(f"獲取排序後的房間玩家時出錯: {str(e)}")
            return []