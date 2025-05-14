import random
from .card import Card, create_deck

class GameState:
    """遊戲狀態類，純邏輯不涉及Django模型"""
    
    def __init__(self, player_count):
        self.player_count = player_count
        self.board_rows = [[] for _ in range(4)]  # 4列牌桌
        self.round = 0  # 總共會有10round
        
        # 創建並洗牌
        self.deck = create_deck()
        random.shuffle(self.deck)
        # print("deck:")
        # for i in range(len(self.deck)):
        #     d = self.deck[i]
        #     print(d.value, end=' ')###
        # 先為所有玩家分配手牌，確保每位玩家的牌不重複
        self.player_hands = []
        used_card_values = set()  # 用於追踪已分配的牌值
        
        for player_idx in range(player_count):
            hand = []
            cards_needed = 10  # 每位玩家需要10張牌
            
            # 持續從牌組中抽取未被使用的牌
            deck_index = 0
            while len(hand) < cards_needed: #and deck_index < len(self.deck):
                card = self.deck[deck_index]
                deck_index += 1
                
                # 如果這張牌尚未分配給任何人，則添加到該玩家的手牌中
                if card.value not in used_card_values:
                    card_copy = Card(card.value)  # 創建一個新的卡牌對象，避免引用問題
                    card_copy.owner = player_idx  # 設定卡牌的擁有者
                    hand.append(card_copy)
                    used_card_values.add(card.value)  # 標記此牌值為已使用
            
            self.player_hands.append(hand)
        # print("player_hands:")
        # for i in range(len(self.player_hands)):
        #     for j in range(len(self.player_hands[i])):
        #         p = self.player_hands[i][j]
        #         print(p.value, end=' ') ###
        # 為牌桌分配4張初始牌，確保與玩家手牌不重複
        deck_index = player_count*10
        for i in range(4):
            card = self.deck[deck_index]
            deck_index += 1

            card_copy = Card(card.value)  # 創建一個新的卡牌對象
            self.board_rows[i].append(card_copy)
            used_card_values.add(card.value)  # 標記此牌值為已使用
        # print("board_rows:")
        # for i in range(len(self.board_rows)):
        #     b = self.board_rows[i]
        #     for j in range(len(b)):
        #         print(b[j].value, end=' ') ###
        # 更新剩餘牌組：移除所有已分配的牌
        # self.deck = [card for card in self.deck if card.value not in used_card_values]
        self.deck = self.deck[(deck_index):]
        # print("deck:")
        # for i in range(len(self.deck)):
        #     d = self.deck[i]
        #     print(d.value, end=' ')###
    
    def find_closest_row(self, card):
        """找出與卡牌最接近的行"""
        closest_row = 0
        min_diff = float('inf')
        
        for i, row in enumerate(self.board_rows):
            last_card = row[-1]
            if card.value > last_card.value:
                diff = card.value - last_card.value
                if diff < min_diff:
                    min_diff = diff
                    closest_row = i
        
        # 如果沒有找到合適的行（即卡牌比所有行的最後一張牌都小）
        if min_diff == float('inf'):
            return None
        
        return closest_row
    
    def play_card(self, player_idx, card_idx):
        """玩家出牌
        
        參數:
            player_idx: 玩家索引
            card_idx: 玩家手牌中的卡牌索引
            
        返回:
            dict: 含有操作結果的字典
        """
        if player_idx < 0 or player_idx >= self.player_count:
            raise ValueError(f"玩家索引 {player_idx} 超出範圍")
        if player_idx >= len(self.player_hands):
            print(f"[錯誤] player_idx: {player_idx} 超過 player_hands 長度: {len(self.player_hands)}")
            return None  # 或 raise Exception("Player not found")
        player_hand = self.player_hands[player_idx]
        
        if card_idx < 0 or card_idx >= len(player_hand):
            raise ValueError(f"卡牌索引 {card_idx} 超出該玩家手牌範圍")
        
        # 取出玩家選擇的卡牌
        card = player_hand.pop(card_idx)
        
        # 找到最接近的行
        row_idx = self.find_closest_row(card)
        
        # 如果找不到合適的行，玩家必須選擇一個行收集
        if row_idx is None:
            # 將卡牌放回手牌，等待玩家選擇
            player_hand.insert(card_idx, card)
            
            return {
                'action': 'choose_row'
            }
        else:
            # 如果該行已有5張牌，則收集牛頭
            if len(self.board_rows[row_idx]) == 5:
                collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
                self.board_rows[row_idx] = [card]
                return {
                    'player_id': player_idx,
                    'action': 'collect',
                    'row': row_idx,
                    'bull_heads': collected_bull_heads,
                    'card': {'value': card.value, 'bull_heads': card.bull_heads}
                }
            else:
                self.board_rows[row_idx].append(card)
                return {
                    'player_id': player_idx,
                    'action': 'place',
                    'row': row_idx,
                    'card': {'value': card.value, 'bull_heads': card.bull_heads}
                }

    def resume_from_choose_row(self, player_idx, card_idx, row_idx):
        """處理玩家選擇的列
        
        參數:
            player_idx: 玩家索引
            card_idx: 玩家手牌中的卡牌索引
            row_idx: 玩家選擇的列索引
            
        返回:
            dict: 含有操作結果的字典
        """
        if player_idx < 0 or player_idx >= self.player_count:
            raise ValueError(f"玩家索引 {player_idx} 超出範圍")
        
        player_hand = self.player_hands[player_idx]
        
        if card_idx < 0 or card_idx >= len(player_hand):
            raise ValueError(f"卡牌索引 {card_idx} 超出該玩家手牌範圍")
        
        if row_idx < 0 or row_idx >= len(self.board_rows):
            raise ValueError(f"列索引 {row_idx} 超出範圍")
        
        # 取出玩家選擇的卡牌
        card = player_hand.pop(card_idx)
        
        # 收集牛頭
        collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
        
        # 清空該行並放入新牌
        self.board_rows[row_idx] = [card]
        
        return {
            'player_id': player_idx,
            'action': 'collect',
            'row': row_idx,
            'bull_heads': collected_bull_heads,
            'card': {'value': card.value, 'bull_heads': card.bull_heads}
        }
    def play_round(self):
        """同時讓四位玩家出牌並依照卡牌數字排序"""
        played_cards = []  # 存放所有玩家出的卡牌
        
        
        # 每位玩家都出一張卡牌
        for player_idx in range(self.player_count):

            if player_idx >= len(self.player_hands):
                print(f"[錯誤] 要出牌的 player_idx: {player_idx} 不存在於 player_hands 中")
                return None  # 或 raise Exception("Invalid player")

            if not self.player_hands[player_idx]:
                print(f"[警告] player {player_idx} 沒有手牌可出")
                return None

            # 每位玩家從手牌中選擇一張卡牌出牌
            card = self.player_hands[player_idx].pop(0)  # 假設從手牌中取出第一張卡
            card.owner = player_idx  # 確保卡牌屬於該玩家
            played_cards.append(card)
        
        # 將所有出牌的卡牌按數字升序排列
        played_cards.sort(key=lambda x: x.value)
        print([card.value for card in played_cards])

        # 將出牌的卡牌放到牌桌上
        round_results = []
        for card in played_cards:
            print(f"Player {card.owner} plays card: {card.value}")
            row_idx = self.find_closest_row(card)
            
            # 如果找不到合適的行，玩家必須選擇一個行收集
            if row_idx is None:
                bull_heads = [sum(card.bull_heads for card in row) for row in self.board_rows]
                row_idx = bull_heads.index(min(bull_heads))
                
                # 收集牛頭
                collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
                
                # 清空該行並放入新牌
                self.board_rows[row_idx] = [card]
                
                round_results.append({
                    'player':card.owner,
                    'action': 'collect',
                    'row': row_idx,
                    'bull_heads': collected_bull_heads
                })
                print(f"Player {card.owner} collects bull heads: {collected_bull_heads}")
            else:
                # 如果該行已有5張牌，則收集牛頭
                if len(self.board_rows[row_idx]) == 5:
                    collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
                    self.board_rows[row_idx] = [card]
                    round_results.append({
                        'player':card.owner,
                        'action': 'collect',
                        'row': row_idx,
                        'bull_heads': collected_bull_heads
                    })
                    print(f"Player {card.owner} collects bull heads: {collected_bull_heads}")
                else:
                    self.board_rows[row_idx].append(card)
                    round_results.append({
                        'player':card.owner,
                        'action': 'place',
                        'row': row_idx
                    })
                    print(f"Player {card.owner} places card: {card.value}")
        
        # 打印每行的結果
        for i, row in enumerate(self.board_rows):
            print(f"Row {i} after round: {', '.join(str(card.value) for card in row)}")
        
        self.round += 1  # 增加回合數
        return round_results  # 返回每回合的結果
