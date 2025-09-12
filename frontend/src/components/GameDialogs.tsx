import { Button, Dialog, DialogTitle, DialogContent, DialogActions, Snackbar, Alert, ToggleButtonGroup, ToggleButton } from "@mui/material";

// Game dialogs component for promotion, start game, endgame, and error handling

interface GameDialogsProps {
  // Promotion Dialog
  promotionOpen: boolean;
  onPromotionClose: () => void;
  onPromotionPick: (piece: "q" | "r" | "b" | "n") => void;

  // Start Game Dialog
  startOpen: boolean;
  selectedMinutes: number;
  onMinutesChange: (minutes: number) => void;
  onStartGame: () => void;

  // Endgame Dialog
  endgameOpen: boolean;
  endgameResult: string;
  endgameReason: string;
  onEndgameClose: () => void;
  onNewGameFromEndgame: () => void;

  // Error Dialog
  errorOpen: boolean;
  errorMessage: string;
  onErrorClose: () => void;
  onRetry: () => void;
  hasRetry: boolean;
}

const GameDialogs = ({
  promotionOpen,
  onPromotionClose,
  onPromotionPick,
  startOpen,
  selectedMinutes,
  onMinutesChange,
  onStartGame,
  endgameOpen,
  endgameResult,
  endgameReason,
  onEndgameClose,
  onNewGameFromEndgame,
  errorOpen,
  errorMessage,
  onErrorClose,
  onRetry,
  hasRetry
}: GameDialogsProps) => {
  return (
    <>
      {/* Promotion Dialog */}
      <Dialog open={promotionOpen} onClose={onPromotionClose}>
        <DialogTitle>Choose promotion</DialogTitle>
        <DialogContent style={{ display: "flex", gap: 12, marginTop: 8, justifyContent: "center" }}>
          <Button variant="contained" onClick={() => onPromotionPick("q")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/q-white.svg" alt="Queen" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Queen</span>
          </Button>
          <Button variant="contained" onClick={() => onPromotionPick("r")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/r-white.svg" alt="Rook" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Rook</span>
          </Button>
          <Button variant="contained" onClick={() => onPromotionPick("b")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/b-white.svg" alt="Bishop" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Bishop</span>
          </Button>
          <Button variant="contained" onClick={() => onPromotionPick("n")} style={{ padding: 8, minWidth: 60, display: "flex", flexDirection: "column", alignItems: "center" }}>
            <img src="/pieces/n-white.svg" alt="Knight" style={{ width: 32, height: 32, marginBottom: 4 }} />
            <span style={{ fontSize: 12 }}>Knight</span>
          </Button>
        </DialogContent>
        <DialogActions>
          <Button onClick={onPromotionClose}>Cancel</Button>
        </DialogActions>
      </Dialog>

      {/* Start Game Dialog */}
      <Dialog 
        open={startOpen} 
        onClose={() => {}} // Prevent closing by clicking outside
        disableEscapeKeyDown // Prevent closing with Escape key
      >
        <DialogTitle>Start New Game</DialogTitle>
        <DialogContent>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ fontWeight: 600 }}>Time Control</div>
            <ToggleButtonGroup
              exclusive
              value={selectedMinutes}
              onChange={(_, v) => { if (typeof v === "number") onMinutesChange(v); }}
              color="primary"
            >
              <ToggleButton value={1}>1</ToggleButton>
              <ToggleButton value={3}>3</ToggleButton>
              <ToggleButton value={5}>5</ToggleButton>
              <ToggleButton value={10}>10</ToggleButton>
              <ToggleButton value={15}>15</ToggleButton>
              <ToggleButton value={0.167}>10s</ToggleButton>
            </ToggleButtonGroup>
          </div>
        </DialogContent>
        <DialogActions>
          <Button variant="contained" onClick={onStartGame}>Start</Button>
        </DialogActions>
      </Dialog>

      {/* Endgame Dialog */}
      <Dialog 
        open={endgameOpen} 
        onClose={onEndgameClose} // Allow closing with X button
        disableEscapeKeyDown // Prevent closing with Escape key
        BackdropProps={{
          style: {
            backgroundColor: 'rgba(0, 0, 0, 0.5)',
            backdropFilter: 'none'
          }
        }}
        PaperProps={{
          style: {
            backgroundColor: '#1f2937',
            color: 'white',
            borderRadius: '12px',
            border: '1px solid #374151',
            position: 'relative'
          }
        }}
      >
        {/* Close Button */}
        <button
          onClick={onEndgameClose}
          style={{
            position: 'absolute',
            top: '12px',
            right: '12px',
            background: 'none',
            border: 'none',
            color: '#9ca3af',
            fontSize: '20px',
            cursor: 'pointer',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '28px',
            height: '28px',
            transition: 'all 0.2s ease'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = '#ffffff';
            e.currentTarget.style.backgroundColor = '#374151';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = '#9ca3af';
            e.currentTarget.style.backgroundColor = 'transparent';
          }}
        >
          ×
        </button>
        
        <DialogTitle style={{ color: 'white', textAlign: 'center', fontSize: '24px', fontWeight: 'bold', paddingTop: '20px' }}>
          {endgameResult === "1-0" ? "🎉 You Win!" : 
           endgameResult === "0-1" ? "😔 You Lose" : 
           "🤝 Draw"}
        </DialogTitle>
        <DialogContent style={{ textAlign: 'center', padding: '20px' }}>
          <div style={{ fontSize: '16px', marginBottom: '16px' }}>
            {endgameResult === "1-0" && endgameReason === "checkmate" && "Checkmate! You outplayed Gambitron!"}
            {endgameResult === "1-0" && endgameReason === "timeout" && "Gambitron ran out of time!"}
            {endgameResult === "0-1" && endgameReason === "checkmate" && "Checkmate! Gambitron got you!"}
            {endgameResult === "0-1" && endgameReason === "timeout" && "You ran out of time!"}
            {endgameResult === "1/2-1/2" && "Draw! The game ends in a tie."}
          </div>
        </DialogContent>
        <DialogActions style={{ justifyContent: 'center', padding: '20px' }}>
          <Button 
            onClick={onNewGameFromEndgame}
            style={{ 
              backgroundColor: '#3b82f6', 
              color: 'white',
              padding: '10px 24px',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            New Game
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Snackbar */}
      <Snackbar
        open={errorOpen}
        autoHideDuration={6000}
        onClose={onErrorClose}
        anchorOrigin={{ vertical: "bottom", horizontal: "center" }}
      >
        <Alert
          onClose={onErrorClose}
          severity="error"
          action={
            hasRetry ? (
              <Button color="inherit" size="small" onClick={onRetry}>
                Retry
              </Button>
            ) : undefined
          }
          sx={{ width: "100%" }}
        >
          {errorMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default GameDialogs;
