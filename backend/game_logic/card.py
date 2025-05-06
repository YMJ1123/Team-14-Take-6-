class Card:
    def __init__(self, value, owner=None):
        self.value = value
        self.bull_heads = self._calculate_bull_heads(value)
        self.owner = owner  # 這張牌屬於哪個玩家
    
    def _calculate_bull_heads(self, value):
        """計算卡牌的牛頭數"""
        if value == 55:
            return 7
        elif value % 11 == 0:
            return 5
        elif value % 10 == 0:
            return 3
        elif value % 5 == 0:
            return 2
        else:
            return 1
    
    def __str__(self):
        return f"Card({self.value}, {self.bull_heads}, {self.owner})"
    
    def __lt__(self, other):
        return self.value < other.value


def create_deck():
    """創建一副完整的牌組（1-104號）"""
    deck = [Card(i) for i in range(1, 105)]
    # for card in deck:
    #     print(f"Card {card.value} has {card.bull_heads} bull heads")
    return deck
