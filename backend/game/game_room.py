from game_logic.core import GameState
from collections import OrderedDict

# 全局字典，用於保存所有活躍的遊戲房間
active_rooms = {}

class GameRoom:
    """管理單個遊戲房間的共享狀態"""
    
    def __init__(self, room_name):
        self.name = room_name
        self.game_state = None  # 遊戲狀態，初始為空
        self.connected_players = set()  # 使用集合存儲連接到該房間的用戶ID
        self.played_cards = {}  # 記錄已出牌的玩家和對應的卡牌索引
        self.round_results = []  # 儲存本輪出牌的結果
        self.player_indices = OrderedDict()  # 記錄玩家ID到索引的映射
        # 新增：記錄需要選擇列的玩家和他們的狀態
        self.pending_choices = {}  # 格式: {player_id: {'card_idx': card_idx, 'player_index': player_index, 'card_value': card_value}}
        # 新增：記錄當前處理到哪一張牌
        self.processing_index = 0
        self.cards_to_process = []
        # 新增：記錄玩家顯示名稱和訪客狀態
        self.player_display_names = {}  # 格式: {player_id: {'display_name': name, 'is_guest': boolean}}
    
    def initialize_game_state(self, player_count, ordered_player_ids):
        """初始化房間的遊戲狀態（確保只初始化一次）"""
        if self.game_state is None:
            print(f"房間 {self.name} 初始化 GameState，玩家數: {player_count}")
            self.game_state = GameState(player_count)
            self.played_cards = {}  # 重置已出牌記錄
            self.round_results = []  # 重置回合結果
            # 使用傳入的有序玩家ID列表初始化玩家索引
            self._initialize_player_indices(ordered_player_ids)
        return self.game_state
    
    def _initialize_player_indices(self, ordered_player_ids):
        """使用有序的玩家ID列表初始化玩家ID到遊戲索引的映射"""
        if not ordered_player_ids:
            print("警告: 初始化玩家索引時，有序的玩家ID列表為空")
            self.player_indices = OrderedDict()
            return
            
        print(f"初始化玩家索引映射，基於有序列表: {ordered_player_ids}")
        
        # 重置映射
        self.player_indices = OrderedDict()
        
        # 將連接的玩家按傳入的順序映射到索引
        for idx, player_id in enumerate(ordered_player_ids):
            # 轉換為字符串確保一致性
            self.player_indices[str(player_id)] = idx
        
        print(f"玩家索引映射已更新: {self.player_indices}")
    
    def get_player_index(self, player_id):
        """獲取玩家在遊戲中的索引"""
        # 確保player_id是字符串形式
        player_id = str(player_id)
        
        # 檢查映射是否存在
        if player_id in self.player_indices:
            idx = self.player_indices[player_id]
            print(f"玩家 {player_id} 的遊戲索引是 {idx}")
            return idx
        
        # 嘗試初始化玩家索引映射
        self._initialize_player_indices()
        
        # 再次檢查
        if player_id in self.player_indices:
            return self.player_indices[player_id]
            
        print(f"警告: 無法找到玩家 {player_id} 的索引，當前映射: {self.player_indices}")
        return None
    
    def get_player_by_index(self, index):
        """根據索引獲取玩家ID"""
        for player_id, idx in self.player_indices.items():
            if idx == index:
                return player_id
        return None
    
    def has_game_state(self):
        """檢查房間是否已經初始化了遊戲狀態"""
        return self.game_state is not None
    
    def add_player(self, user_id, display_name=None, is_guest=False):
        """將玩家添加到房間"""
        self.connected_players.add(user_id)
        # 儲存玩家顯示名稱和訪客狀態
        self.player_display_names[user_id] = {
            'display_name': display_name or f'Player_{user_id}',
            'is_guest': is_guest
        }
        print(f"玩家 {user_id} ({self.player_display_names[user_id]['display_name']}) 加入房間 {self.name}，目前玩家數: {len(self.connected_players)}")
    
    def remove_player(self, user_id):
        """從房間中移除玩家"""
        if user_id in self.connected_players:
            self.connected_players.remove(user_id)
            # 如果有儲存玩家顯示名稱，也一併移除
            if user_id in self.player_display_names:
                display_name = self.player_display_names[user_id]['display_name']
                del self.player_display_names[user_id]
                print(f"玩家 {user_id} ({display_name}) 離開房間 {self.name}，剩餘玩家數: {len(self.connected_players)}")
            else:
                print(f"玩家 {user_id} 離開房間 {self.name}，剩餘玩家數: {len(self.connected_players)}")
            # 如果玩家已出牌，也需要移除
            if user_id in self.played_cards:
                del self.played_cards[user_id]
            # 也需要從玩家索引映射中移除
            if user_id in self.player_indices:
                del self.player_indices[user_id]
    
    def get_player_count(self):
        """獲取當前房間的玩家數量"""
        return len(self.connected_players)
    
    def get_player_name(self, player_id):
        """獲取玩家名稱，優先使用設定的顯示名稱"""
        if player_id in self.player_display_names:
            return self.player_display_names[player_id]['display_name']
        elif player_id in self.played_cards and 'player_name' in self.played_cards[player_id]:
            return self.played_cards[player_id]['player_name']
        return f'Player_{player_id}'
    
    def record_played_card(self, player_id, card_idx, card_value, player_name):
        """記錄玩家出的牌，同時記錄卡牌索引和值"""
        # 先檢查player_id是否是有效的數字或字符串(避免None或其他類型)
        if player_id is None:
            print(f"錯誤: 記錄出牌時收到無效的player_id: {player_id}")
            return False
            
        # 確保player_id是字符串形式，便於一致比較
        player_id = str(player_id)
        
        # 記錄出牌信息
        self.played_cards[player_id] = {
            'value': card_value,
            'idx': card_idx,
            'player_name': player_name
        }
        print(f"玩家 {player_id}({player_name})在房間 {self.name} 中出了數字 {card_value}，索引 {card_idx}")
        
        # 確保該玩家已加入到player_indices中
        if player_id not in self.player_indices:
            print(f"添加玩家 {player_id} 到索引映射")
            self._initialize_player_indices()
        
        return self.are_all_players_played()
    
    def are_all_players_played(self):
        """檢查是否所有玩家都已出牌"""
        if not self.has_game_state():
            return False
            
        # 檢查已出牌的玩家數是否等於遊戲中的玩家數
        active_players = len(self.connected_players)
        played_count = len(self.played_cards)
        
        print(f"房間 {self.name} 中已有 {played_count}/{active_players} 名玩家出牌")
        return played_count >= active_players and active_players > 0
    
    def process_played_cards(self):
        """處理所有已出牌，並返回結果"""
        if not self.are_all_players_played():
            return None
            
        # 清空上一輪的結果
        self.round_results = []
        
        # 收集所有玩家的出牌信息，包括卡牌值
        self.cards_to_process = []
        print("處理已出牌: ", self.played_cards)
        
        for player_id, card_info in self.played_cards.items():
            # 獲取玩家在遊戲中的索引
            player_index = self.get_player_index(player_id)
            
            if player_index is None:
                print(f"警告: 無法找到玩家 {player_id} 的索引，跳過處理")
                continue
            
            print(f"處理玩家 {player_id}({card_info['player_name']}) 的牌，遊戲索引為 {player_index}")
            
            self.cards_to_process.append({
                'player_id': player_id,
                'player_index': player_index,
                'card_value': card_info['value'],
                'card_idx': card_info['idx'],
                'player_name': card_info['player_name']
            })
        
        # 按照卡牌值從小到大排序
        self.cards_to_process.sort(key=lambda card: card['card_value'])
        print(f"按卡牌值排序後的出牌順序: {[card['card_value'] for card in self.cards_to_process]}")
        
        # 重置處理索引
        self.processing_index = 0
        
        # 使用新方法處理卡牌
        return self.process_next_card()
    
    def process_next_card(self):
        """處理下一張卡牌，如果有玩家需要選擇列，則返回特殊結果"""
        results = []
        
        # 如果已經處理完所有卡牌，返回結果
        if self.processing_index >= len(self.cards_to_process):
            # 清空已出牌記錄（準備下一輪）
            self.played_cards = {}
            self.processing_index = 0
            self.cards_to_process = []
            return self.round_results
        
        # 獲取當前要處理的卡牌
        card_info = self.cards_to_process[self.processing_index]
        player_id = card_info['player_id']
        player_index = card_info['player_index']
        card_value = card_info['card_value']
        card_idx = card_info['card_idx']
        player_name = card_info['player_name']
        
        # 如果這個玩家正在等待選擇，跳過
        if player_id in self.pending_choices:
            # 增加索引
            self.processing_index += 1
            # 處理下一張卡牌
            return self.process_next_card()
        
        # 檢查遊戲狀態中是否存在這個玩家的手牌
        has_valid_hand = (player_index < len(self.game_state.player_hands))
        
        # 確保手牌中卡牌索引是有效的
        has_valid_card_index = False
        if has_valid_hand:
            has_valid_card_index = (card_idx < len(self.game_state.player_hands[player_index]))
        
        # 記錄實際卡牌值用於結果比對和調試
        actual_card_value = None
        if has_valid_hand and has_valid_card_index:
            actual_card = self.game_state.player_hands[player_index][card_idx]
            actual_card_value = actual_card.value
            # 如果卡牌值不匹配，記錄警告
            if actual_card_value != card_value:
                print(f"警告: 玩家 {player_id}({player_name}) 請求出牌值 {card_value}，但手牌索引 {card_idx} 的實際值為 {actual_card_value}")
        
        # 調用遊戲邏輯處理出牌，使用玩家索引而不是絕對ID
        result = self.game_state.play_card(player_index, card_idx, external_card_value=card_value)
        print(f"玩家 {player_id}({player_name}) (索引 {player_index}) 出牌 {card_value} (索引 {card_idx}) 結果: {result}")
        
        # 檢查結果中的卡片值是否符合預期
        if result and 'card' in result:
            actual_value = result['card']['value']
            if actual_value != card_value:
                print(f"警告: 結果中的卡片值 {actual_value} 與預期值 {card_value} 不符")
            else:
                print(f"結果中的卡片值符合預期: {actual_value}")
        
        # 如果需要選擇列
        if result and result.get('action') == 'choose_row':
            # 保存需要選擇的玩家狀態
            self.pending_choices[player_id] = {
                'card_idx': card_idx,
                'player_index': player_index,
                'card_value': card_value
            }
            
            # 計算每行的牛頭數
            row_bull_heads = []
            for row in self.game_state.board_rows:
                if row:  # 確保行不為空
                    bull_heads = sum(card.bull_heads for card in row)
                    row_bull_heads.append(bull_heads)
                else:
                    row_bull_heads.append(0)
                
            # 返回需要選擇列的特殊結果
            return {
                'type': 'choose_row_needed',
                'player_id': player_id,
                'player_name': player_name,
                'row_bull_heads': row_bull_heads
            }
        
        # 正常處理出牌結果
        result_item = {
            'player_id': player_id,
            'player_index': player_index,
            'card_value': card_value,
            'card_idx': card_idx,
            'player_name': player_name,
            'result': result
        }
        
        # 添加到結果列表
        self.round_results.append(result_item)
        results.append(result_item)
        
        # 增加索引
        self.processing_index += 1
        
        # 處理下一張卡牌
        next_results = self.process_next_card()
        
        # 如果有特殊結果，直接返回
        if next_results and isinstance(next_results, dict) and next_results.get('type') == 'choose_row_needed':
            return next_results
        
        # 否則合併結果
        if next_results and isinstance(next_results, list):
            results.extend(next_results)
        
        return results
    
    def handle_choose_row(self, player_id, row_idx):
        """處理玩家選擇的列"""
        if player_id not in self.pending_choices:
            print(f"錯誤：玩家 {player_id} 沒有待處理的選擇")
            return None
        
        choice_info = self.pending_choices[player_id]
        player_index = choice_info['player_index']
        card_idx = choice_info['card_idx']
        card_value = choice_info['card_value']  # 獲取前端傳來的卡片值
        
        # 從游戲邏輯獲取結果
        print(f"處理玩家 {player_id} 選擇第 {row_idx} 列，使用卡片值 {card_value}")
        result = self.game_state.resume_from_choose_row(player_index, card_idx, row_idx, external_card_value=card_value)
        
        # 檢查結果中的卡片值是否符合預期
        if result and 'card' in result:
            actual_value = result['card']['value']
            if actual_value != card_value:
                print(f"警告: 選擇列結果中的卡片值 {actual_value} 與預期值 {card_value} 不符")
            else:
                print(f"選擇列結果中的卡片值符合預期: {actual_value}")
        
        # 從待處理列表中移除
        del self.pending_choices[player_id]
        
        # 添加到結果列表
        result_item = {
            'player_id': player_id,
            'player_index': player_index,
            'card_value': card_value,
            'card_idx': card_idx,
            'result': result
        }
        
        self.round_results.append(result_item)
        
        # 增加處理索引，準備處理下一張卡牌
        self.processing_index += 1
        
        # 繼續處理下一張卡牌
        next_results = self.process_next_card()
        
        # 檢查結果是否需要另一個玩家選擇行
        if next_results and isinstance(next_results, dict) and next_results.get('type') == 'choose_row_needed':
            return next_results
        
        # 否則返回所有結果
        return next_results
    
    @staticmethod
    def get_room(room_name):
        """獲取或創建指定名稱的房間"""
        if room_name not in active_rooms:
            active_rooms[room_name] = GameRoom(room_name)
        return active_rooms[room_name]
    
    @staticmethod
    def remove_room(room_name):
        """移除房間（當房間為空時）"""
        if room_name in active_rooms:
            room = active_rooms[room_name]
            if len(room.connected_players) == 0:
                del active_rooms[room_name]
                print(f"房間 {room_name} 已被移除（無玩家）") 