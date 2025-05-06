# import random
# from .card import Card, create_deck

# class GameState:
#     """遊戲狀態類，純邏輯不涉及Django模型"""
    
#     def __init__(self, player_count):
#         self.player_count = player_count
#         self.board_rows = [[] for _ in range(4)]  # 4列牌桌
#         self.round = 0 #總共會有10round
#         self.deck = create_deck()
#         random.shuffle(self.deck)
        
#         # 初始化牌桌，4列牌各放一張
#         for i in range(4):
#             self.board_rows[i].append(self.deck.pop())
        
#         # 分發手牌給玩家（這裡僅生成，實際存儲要交給Django模型）
#         self.player_hands = []
#         for player_idx in range(player_count):
#             hand = []
#             for _ in range(10):
#                 card = self.deck.pop()
#                 card.owner = player_idx  # 設定卡牌的擁有者
#                 hand.append(card)
#             self.player_hands.append(hand)
    
#     def find_closest_row(self, card):
#         """找出與卡牌最接近的行"""
#         closest_row = 0
#         min_diff = float('inf')
        
#         for i, row in enumerate(self.board_rows):
#             last_card = row[-1]
#             if card.value > last_card.value:
#                 diff = card.value - last_card.value
#                 if diff < min_diff:
#                     min_diff = diff
#                     closest_row = i
        
#         # 如果沒有找到合適的行（即卡牌比所有行的最後一張牌都小）
#         if min_diff == float('inf'):
#             return None
        
#         return closest_row
    
#     def play_card(self, player_idx, card_idx):
#         """處理玩家出牌的邏輯"""
#         # 從玩家手牌中取出指定的牌
#         card = self.player_hands[player_idx].pop(card_idx)
        
#         # 找出應該放置的行
#         row_idx = self.find_closest_row(card)
        
#         # 如果找不到合適的行，玩家必須選擇一個行收集
#         # 這裡簡化為自動選擇牛頭數最少的行
#         if row_idx is None:
#             bull_heads = [sum(card.bull_heads for card in row) for row in self.board_rows]
#             row_idx = bull_heads.index(min(bull_heads))
            
#             # 收集牛頭
#             collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
            
#             # 清空該行並放入新牌
#             self.board_rows[row_idx] = [card]
            
#             return {
#                 'action': 'collect',
#                 'row': row_idx,
#                 'bull_heads': collected_bull_heads
#             }
        
#         # 如果該行已有5張牌
#         elif len(self.board_rows[row_idx]) == 5:
#             # 收集牛頭
#             collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
            
#             # 清空該行並放入新牌
#             self.board_rows[row_idx] = [card]
            
#             return {
#                 'action': 'collect',
#                 'row': row_idx,
#                 'bull_heads': collected_bull_heads
#             }
        
#         # 正常添加到該行
#         else:
#             self.board_rows[row_idx].append(card)
            
#             return {
#                 'action': 'place',
#                 'row': row_idx
#             }



import random
from .card import Card, create_deck

class GameState:
    """遊戲狀態類，純邏輯不涉及Django模型"""
    
    def __init__(self, player_count):
        self.player_count = player_count
        self.board_rows = [[] for _ in range(4)]  # 4列牌桌
        self.round = 0  # 總共會有10round
        self.deck = create_deck()
        random.shuffle(self.deck)
        
        # 初始化牌桌，4列牌各放一張
        for i in range(4):
            self.board_rows[i].append(self.deck.pop())
        
        # 分發手牌給玩家（這裡僅生成，實際存儲要交給Django模型）
        self.player_hands = []
        for player_idx in range(player_count):
            hand = []
            for _ in range(10):
                card = self.deck.pop()
                card.owner = player_idx  # 設定卡牌的擁有者
                hand.append(card)
            self.player_hands.append(hand)
    
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
    
    def play_round(self):
        """同時讓四位玩家出牌並依照卡牌數字排序"""
        played_cards = []  # 存放所有玩家出的卡牌
        
        # 每位玩家都出一張卡牌
        for player_idx in range(self.player_count):
            # 每位玩家從手牌中選擇一張卡牌出牌
            card = self.player_hands[player_idx].pop(0)  # 假設從手牌中取出第一張卡
            card.owner = player_idx  # 確保卡牌屬於該玩家
            played_cards.append(card)
        
        # 將所有出牌的卡牌按數字升序排列
        played_cards.sort(key=lambda x: x.value)

        
        # 將出牌的卡牌放到牌桌上
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
                
                print(f"Player {card.owner} collects bull heads: {collected_bull_heads}")
                return {
                        'action': 'collect',
                        'row': row_idx,
                        'bull_heads': collected_bull_heads
                    }
            else:
                # 如果該行已有5張牌，則收集牛頭
                if len(self.board_rows[row_idx]) == 5:
                    collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
                    self.board_rows[row_idx] = [card]
                    print(f"Player {card.owner} collects bull heads: {collected_bull_heads}")
                    return {
                        'action': 'collect',
                        'row': row_idx,
                        'bull_heads': collected_bull_heads
                    }
                else:
                    self.board_rows[row_idx].append(card)
                    print(f"Player {card.owner} places card: {card.value}")
                    return {
                        'action': 'place',
                        'row': row_idx
                    }
        for i, row in enumerate(self.board_rows):
            print(f"Row {i} after round: {', '.join(str(card.value) for card in row)}")
            self.assertLessEqual(len(row), 5, f"Row {i} has more than 5 cards!")  # 確保每行最多5張卡牌
        
        self.round += 1  # 增加回合數
