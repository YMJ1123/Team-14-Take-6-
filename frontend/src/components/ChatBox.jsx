import React, { useState, useEffect, useRef } from "react";
import "../styles/game_room.css";

const ChatBox = ({ socket }) => {
  const [message, setMessage] = useState("");
  const [messages, setMessages] = useState([]);
  const chatRef = useRef(null);

  useEffect(() => {
    if (!socket) return;

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "chat_message" || data.type === "user_notification" || data.type === "connection_established") {
        setMessages(prev => [...prev, { sender: data.username || "系統", text: data.message }]);
      }
    };
  }, [socket]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = () => {
    if (!message.trim()) return;
    socket.send(JSON.stringify({
      type: "chat_message",
      message: message.trim(),
    }));
    setMessage("");
  };

  return (
    <div id="chatContainer">
      <h2>聊天室:</h2>
      <div id="chatMessages" ref={chatRef} style={{ height: 200, overflowY: "scroll", background: "#fff", padding: 10, border: "1px solid #ccc", marginBottom: 10 }}>
        {messages.map((msg, i) => (
          <div key={i}><strong>{msg.sender}:</strong> {msg.text}</div>
        ))}
      </div>
      <input
        type="text"
        placeholder="輸入訊息..."
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && sendMessage()}
      />
      <button onClick={sendMessage}>發送</button>
    </div>
  );
};

export default ChatBox;
