import React, { useEffect, useState } from "react";
import Card from "./Card";
import "../styles/player_hand.css";

const PlayerHand = ({ socket }) => {
  const [hand, setHand] = useState([]);
  const [selectedCard, setSelectedCard] = useState(null);

  useEffect(() => {
    if (!socket) return;

    const handleMessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "deal_cards") {
        setHand(data.hand);
        setSelectedCard(null); // 重置選擇的牌
      }
    };

    socket.addEventListener("message", handleMessage);
    
    return () => {
      socket.removeEventListener("message", handleMessage);
    };
  }, [socket]);

  const playCard = (cardIndex) => {
    if (selectedCard === cardIndex) {
      // 如果已選擇，則確認出牌
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

  return (
    <div className="player-hand-container">
      <h2>你的手牌:</h2>
      <div className="player-hand">
        {hand.map((card, index) => (
          <div 
            key={index} 
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

export default PlayerHand;
