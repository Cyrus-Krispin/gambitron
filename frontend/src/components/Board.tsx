import "./Board.css";

const horizontal = ["a", "b", "c", "d", "e", "f", "g", "h"];
const vertical = ["1", "2", "3", "4", "5", "6", "7", "8"];

export default function Board() {
  let board = [];

  for (let j = vertical.length - 1; j >= 0; j--) {
    for (let i = 0; i < horizontal.length; i++) {
        const isBlack = (i + j) % 2 === 0;
        const tileColor = isBlack ? "black" : "white";
      board.push(
        <div className={`tile ${tileColor}`}>[
          {horizontal[i]}
          {vertical[j]}
        ]
        </div>
      );
    }
  }
  return <div className="chess-board">{board}</div>;
}
