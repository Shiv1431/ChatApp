// App.js

import React, { useState, useEffect, useRef } from 'react';
import io from 'socket.io-client';

const socket = io('http://localhost:3000');

function App() {
  const [messages, setMessages] = useState([]);
  const [message, setMessage] = useState('');
  const [recipient, setRecipient] = useState('');
  const [name, setName] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const messageEndRef = useRef(null);

  useEffect(() => {
    socket.on('message', newMessage => {
      setMessages(prevMessages => [...prevMessages, newMessage]);
      scrollToBottom();
    });
  }, []);

  const scrollToBottom = () => {
    messageEndRef.current.scrollIntoView({ behavior: 'smooth' });
  };

  const handleRegister = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name, email: 'user@example.com', password: 'password' }) // You can replace this with actual registration data
      });
      if (response.ok) {
        setIsLoggedIn(true);
      } else {
        const data = await response.json();
        console.error(data.message);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleSubmit = e => {
    e.preventDefault();
    socket.emit('message', { to: recipient, content: message });
    setMessages(prevMessages => [...prevMessages, { from: name, to: recipient, content: message }]);
    setMessage('');
    scrollToBottom();
  };

  return (
    <div className="App">
      <h1>Chat Application</h1>
      {!isLoggedIn ? (
        <div>
          <input type="text" placeholder="Enter your name" value={name} onChange={e => setName(e.target.value)} />
          <button onClick={handleRegister}>Register</button>
        </div>
      ) : (
        <>
          <div>
            <input type="text" placeholder="Enter recipient username" value={recipient} onChange={e => setRecipient(e.target.value)} />
          </div>
          <div style={{ marginTop: '20px', marginBottom: '20px', height: '400px', overflowY: 'scroll' }}>
            {messages.map((msg, index) => (
              <div key={index}>
                <p>{msg.from}: {msg.content}</p>
              </div>
            ))}
            <div ref={messageEndRef} />
          </div>
          <form onSubmit={handleSubmit}>
            <input type="text" placeholder="Enter message" value={message} onChange={e => setMessage(e.target.value)} />
            <button type="submit">Send</button>
          </form>
        </>
      )}
    </div>
  );
}

export default App;
