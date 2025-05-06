#在bash用python -m game_logic.tests執行
import unittest
from .card import Card, create_deck
from .core import GameState

class CardTest(unittest.TestCase):
    def test_bull_heads_calculation(self):
        """測試牛頭分數計算是否正確"""
        print("Testing bull heads calculation:")
        self.assertEqual(Card(55).bull_heads, 7)  # 特例
        self.assertEqual(Card(11).bull_heads, 5)  # 整除11
        self.assertEqual(Card(22).bull_heads, 5)  # 整除11
        self.assertEqual(Card(10).bull_heads, 3)  # 整除10
        self.assertEqual(Card(5).bull_heads, 2)   # 整除5
        self.assertEqual(Card(7).bull_heads, 1)   # 其他

    def test_deck_creation(self):
        """測試牌組生成是否正確"""
        deck = create_deck()
        print(f"Deck created with {len(deck)} cards.")
        
        # 計算總牛頭數是否為171
        total_bulls = sum(card.bull_heads for card in deck)
        print(f"Total bull heads: {total_bulls}")
        self.assertEqual(total_bulls, 171)

class GameLogicTest(unittest.TestCase):
    def test_game_initialization(self):
        """測試遊戲初始化"""
        game = GameState(4)  # 4名玩家
        print("Game initialized:")
        
        # 檢查牌桌是否有4列
        print(f"Board rows: {len(game.board_rows)}")
        self.assertEqual(len(game.board_rows), 4)
        
        # 檢查每列是否有1張初始牌
        for i, row in enumerate(game.board_rows):
            print(f"Row {i+1}: {', '.join(str(card) for card in row)}")
            self.assertEqual(len(row), 1)
        
        # 檢查是否每個玩家有10張牌
        for i, hand in enumerate(game.player_hands):
            print(f"Player {i+1} hand: {', '.join(str(card) for card in hand)}")
            self.assertEqual(len(hand), 10)

if __name__ == '__main__':
    unittest.main()

