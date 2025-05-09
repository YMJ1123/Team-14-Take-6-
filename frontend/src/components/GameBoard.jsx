import React, { useState, useEffect } from "react";
import Card from "./Card";
import "../styles/game_board.css";

const GameBoard = ({ socket, isPrepared, isGameStarted }) => {
  const [board, setBoard] = useState([[], [], [], []]);
  const [flippedCards, setFlippedCards] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      
      if (data.type === "update_board") {
        setBoard(data.board);
      }
      
      if (data.type === "flipped_cards") {
        setFlippedCards(data.cards);
        setIsFlipping(false);
      }
      
      if (data.type === "player_flipping") {
        setIsFlipping(true);
      }
      
      // 處理玩家手牌
      if (data.type === "deal_cards") {
        setHand(data.hand);
        setSelectedCard(null);
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  // 創建空的牌位
  const createEmptyCardSlots = (rowIndex) => {
    const slots = [];
    for (let i = 0; i < 6; i++) {
      const card = board[rowIndex][i] || null;
      slots.push(
        <div key={`slot-${rowIndex}-${i}`} className="card-slot">
          {card ? (
            <Card
              value={card.value}
              bullHeads={card.bull_heads}
              isPlayed={true}
            />
          ) : null}
        </div>
      );
    }
    return slots;
  };
  
  // 建立翻牌區內容
  const renderFlipArea = () => {
    if (flippedCards.length > 0) {
      return flippedCards.map((card, index) => (
        <div key={`flip-${index}`} className="flipped-card">
          <Card
            value={card.value}
            bullHeads={card.bull_heads}
            isPlayed={true}
          />
          <div className="player-name">{card.player_name}</div>
        </div>
      ));
    } else {
      return (
        <div className="waiting-message">
          {isFlipping ? "翻牌中..." : "等待所有玩家出牌"}
        </div>
      );
    }
  };
  
  // 處理玩家出牌
  const playCard = (cardIndex) => {
    if (selectedCard === cardIndex) {
      // 確認出牌
      socket.send(JSON.stringify({
        type: "play_card",
        card_idx: cardIndex,
      }));
      setSelectedCard(null);
    } else {
      // 選擇牌
      setSelectedCard(cardIndex);
    }
  };

  if (!isPrepared) {
    return null;
  }

  return (
    <div className="game-board-container">
      <div 
        className="game-board" 
        style={{ backgroundImage: "url('/images/2x2_background_table.jpeg')" }}
      >
        {/* 正常的4列遊戲牌桌 */}
        {board.map((row, rowIndex) => (
          <div key={`row-${rowIndex}`} className="board-row">
            <div className="row-header">第 {rowIndex + 1} 列</div>
            <div className="row-cards">
              {createEmptyCardSlots(rowIndex)}
            </div>
          </div>
        ))}
        
        {/* 作為第5列的同時翻牌 */}
        {!isGameStarted && (
          <div className="board-row flip-area-row">
            <div className="row-header">同時翻牌</div>
            <div className="flip-cards-container">
              {renderFlipArea()}
            </div>
          </div>
        )}
        
        {/* 整合進牌桌的我的手牌 - 移除框框 */}
        <div className="my-hand-row">
          <div className="row-header">我的手牌</div>
          <div className="my-hand-container">
            {isGameStarted && hand.length > 0 ? (
              <div className="player-hand">
                {hand.map((card, index) => (
                  <div 
                    key={`hand-${index}`} 
                    className={`hand-card ${selectedCard === index ? 'selected' : ''}`}
                  >
                    <Card
                      value={card.value}
                      bullHeads={card.bull_heads}
                      isPlayed={false}
                      onClick={() => playCard(index)}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <span className="empty-hand-message">
                遊戲開始後將顯示您的牌
              </span>
            )}
          </div>
        </div>
      </div>
      
      {selectedCard !== null && (
        <div className="card-action">
          <button onClick={() => playCard(selectedCard)} className="confirm-play-btn">
            確認出牌
          </button>
          <button onClick={() => setSelectedCard(null)} className="cancel-btn">
            取消
          </button>
        </div>
      )}
    </div>
  );
};

export default GameBoard;
