import unittest
from .card import Card, create_deck
from .core import GameState

class CardTest(unittest.TestCase):
    def test_bull_heads_calculation(self):
        """測試牛頭分數計算是否正確"""
        self.assertEqual(Card(55).bull_heads, 7)  # 特例
        self.assertEqual(Card(11).bull_heads, 5)  # 整除11
        self.assertEqual(Card(22).bull_heads, 5)  # 整除11
        self.assertEqual(Card(10).bull_heads, 3)  # 整除10
        self.assertEqual(Card(5).bull_heads, 2)   # 整除5
        self.assertEqual(Card(7).bull_heads, 1)   # 其他

    def test_deck_creation(self):
        """測試牌組生成是否正確"""
        deck = create_deck()
        self.assertEqual(len(deck), 104)
        
        # 計算總牛頭數是否為176
        total_bulls = sum(card.bull_heads for card in deck)
        self.assertEqual(total_bulls, 176)

class GameLogicTest(unittest.TestCase):
    def test_game_initialization(self):
        """測試遊戲初始化"""
        game = GameState(4)  # 4名玩家
        
        # 檢查牌桌是否有4列
        self.assertEqual(len(game.board_rows), 4)
        
        # 檢查每列是否有1張初始牌
        for row in game.board_rows:
            self.assertEqual(len(row), 1)
        
        # 檢查是否每個玩家有10張牌
        self.assertEqual(len(game.player_hands), 4)
        for hand in game.player_hands:
            self.assertEqual(len(hand), 10)

if __name__ == '__main__':
    unittest.main()

