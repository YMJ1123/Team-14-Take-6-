import React, { useEffect, useState } from "react";
import Card from "./Card";
import "../styles/remaining_cards.css";

const RemainingCards = ({ playerCount, isGameStarted }) => {
  const [cards, setCards] = useState([]);
  
  // 初始化所有104張牌
  useEffect(() => {
    const generateDeck = () => {
      const deck = [];
      for (let i = 1; i <= 104; i++) {
        // 計算牛頭數量
        let bullHeads = 1;
        if (i === 55) {
          bullHeads = 7;
        } else if (i % 11 === 0) {
          bullHeads = 5;
        } else if (i % 10 === 0) {
          bullHeads = 3;
        } else if (i % 5 === 0) {
          bullHeads = 2;
        }
        
        deck.push({ value: i, bull_heads: bullHeads });
      }
      return deck;
    };
    
    setCards(generateDeck());
  }, []);
  
  if (isGameStarted || cards.length === 0) {
    return null;
  }

  return (
    <div className="remaining-cards-container">
      <h2>剩餘牌數</h2>
      
      <div className="all-cards-display">
        {cards.map((card, index) => (
          <div 
            key={`card-${index}`} 
            className="card-in-display"
            style={{ 
              transform: `rotate(${Math.random() * 4 - 2}deg)`,
              zIndex: index % 10,
              marginLeft: index > 0 ? '-25px' : '0' // 增加重疊程度
            }}
          >
            <Card 
              value={card.value} 
              bullHeads={card.bull_heads} 
              smallSize={true} 
              isPlayed={true}
            />
          </div>
        ))}
      </div>
      
      <div className="card-distribution-info">
        遊戲共 104 張牌，
        牌桌上放置 4 張初始牌，
        {playerCount > 0 ? `${playerCount} 名玩家各持有 10 張牌` : "等待玩家加入..."}
      </div>
    </div>
  );
};

export default RemainingCards;