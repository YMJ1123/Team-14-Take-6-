import random
from .card import Card, create_deck

class GameState:
    """遊戲狀態類，純邏輯不涉及Django模型"""
    
    def __init__(self, player_count):
        self.player_count = player_count
        self.board_rows = [[] for _ in range(4)]  # 4列牌桌
        self.round = 0
        self.deck = create_deck()
        random.shuffle(self.deck)
        
        # 初始化牌桌
        for i in range(4):
            self.board_rows[i].append(self.deck.pop())
        
        # 分發手牌給玩家（這裡僅生成，實際存儲要交給Django模型）
        self.player_hands = []
        for _ in range(player_count):
            hand = []
            for _ in range(10):
                hand.append(self.deck.pop())
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
    
    def play_card(self, player_idx, card_idx):
        """處理玩家出牌的邏輯"""
        # 從玩家手牌中取出指定的牌
        card = self.player_hands[player_idx].pop(card_idx)
        
        # 找出應該放置的行
        row_idx = self.find_closest_row(card)
        
        # 如果找不到合適的行，玩家必須選擇一個行收集
        # 這裡簡化為自動選擇牛頭數最少的行
        if row_idx is None:
            bull_heads = [sum(card.bull_heads for card in row) for row in self.board_rows]
            row_idx = bull_heads.index(min(bull_heads))
            
            # 收集牛頭
            collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
            
            # 清空該行並放入新牌
            self.board_rows[row_idx] = [card]
            
            return {
                'action': 'collect',
                'row': row_idx,
                'bull_heads': collected_bull_heads
            }
        
        # 如果該行已有5張牌
        elif len(self.board_rows[row_idx]) == 5:
            # 收集牛頭
            collected_bull_heads = sum(card.bull_heads for card in self.board_rows[row_idx])
            
            # 清空該行並放入新牌
            self.board_rows[row_idx] = [card]
            
            return {
                'action': 'collect',
                'row': row_idx,
                'bull_heads': collected_bull_heads
            }
        
        # 正常添加到該行
        else:
            self.board_rows[row_idx].append(card)
            
            return {
                'action': 'place',
                'row': row_idx
            }

