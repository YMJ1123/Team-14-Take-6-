import React, { useState, useEffect } from "react";
import Card from "./Card";
import "../styles/flip_area.css";

const FlipArea = ({ socket }) => {
  const [flippedCards, setFlippedCards] = useState([]);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "flipped_cards") {
        setFlippedCards(data.cards);
        setIsFlipping(false);
      }
      
      if (data.type === "player_flipping") {
        setIsFlipping(true);
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  return (
    <div 
      className="flip-area" 
      style={{ backgroundImage: "url('/images/2x2_background_table.jpeg')" }}
    >
      <h2>同時翻牌區</h2>
      <div className="flip-cards-container">
        {flippedCards.length > 0 ? (
          flippedCards.map((card, index) => (
            <div key={index} className="flipped-card">
              <Card
                value={card.value}
                bullHeads={card.bull_heads}
                isPlayed={true}
              />
              <div className="player-name">{card.player_name}</div>
            </div>
          ))
        ) : (
          <div className="waiting-message">
            {isFlipping ? "翻牌中..." : "等待所有玩家出牌"}
          </div>
        )}
      </div>
    </div>
  );
};

export default FlipArea;