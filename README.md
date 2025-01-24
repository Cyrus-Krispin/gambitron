# Gambitron - Chess AI Bot

Gambitron is an advanced AI bot designed to play chess against real players. This bot is built using React and TypeScript for the front end, with a FastAPI Python backend hosted on AWS Lambda as a REST API endpoint.

<p align="center">
  <img src="frontend\public\readme\readme-gif-gambitron.gif" alt="Gameplay GIF" width="300"/>
</p>


## Play Against the Bot
Ready to challenge Gambitron? Click the link below to start a game online:

**[Play Now](https://gambitron.vercel.app)**

## Features

- **AI Opponent**: Gambitron uses a self-developed AI to make strategic moves and challenge players.
- **React & TypeScript**: The front-end interface is built with React and TypeScript.
- **AWS Lambda**: The backend is powered by AWS Lambda to handle move calculations.
- **Game Logic**: Custom chess logic for move validation, game state tracking, and AI decisions.
- **Game History**: Players can review game history, including moves and AI choices.

## Installation

### Prerequisites

- Node.js (v14 or later)
- Python 3.x

### Setup Frontend

1. Clone the repository:  
   `git clone https://github.com/Cyrus-Krispin/chess_bot`  
   `cd frontend`

2. Install dependencies:  
   `npm install`

3. Run the development server:  
   `npm run dev`

### Setup Backend

1. Navigate to the `backend` directory and set up a virtual environment:  
   `cd lambda-backend`  
   `python -m venv venv`  
   For macOS/Linux:  
   `source venv/bin/activate`  
   For Windows:  
   `venv\Scripts\activate`

2. Install required Python packages:  
   `pip install -r requirements.txt`

3. Run the backend:  
   `fastapi dev backend.py`


## How It Works

The front end communicates with the backend API hosted on AWS Lambda to fetch move decisions and interact with the game board. The game logic ensures that each move is valid according to chess rules. The AI opponent uses decision tress, heuristics, and minimax algorithm to play the best move.

## Minimax Algorithm

In the backend, the AI relies on the minimax algorithm enhanced with alpha-beta pruning to evaluate and select the most advantageous move.

1. **Move Generation**: For a given board state, the AI generates all possible legal moves.
2. **Recursion**: It simulates each move, then recursively evaluates the resulting board positions.
3. **Depth & Heuristics**: At a certain depth limit or endgame condition, it applies heuristic evaluations of the board (e.g., piece values, positional advantages, king safety) to estimate the desirability of each position.
4. **Maximize/Minimize**: When it's the AI's turn, it chooses the move that maximizes its advantage. When it's the opponent's turn, it assumes the opponent will choose the move that minimizes the AI's advantage.
5. **Alpha-Beta Pruning**: To optimize performance, alpha-beta pruning is used to cut off branches of the search tree that won't affect the final decision, reducing the computational overhead.

This algorithm helps the bot identify high-quality moves and maintain a competitive level of play against human opponents.
