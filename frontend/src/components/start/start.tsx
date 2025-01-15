import { useState } from "react";
import "./start.css";

interface StartButtonProps {
    onStart: (nickname: string) => void;
}

export default function Start({ onStart }: StartButtonProps) {
    const [nickname, setNickname] = useState("");

    const handleStart = () => {
        if (nickname.trim()) {
            onStart(nickname);
        }
    };

    const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Enter") {
            handleStart();
        }
    };

    return (
        <div className="start-button-container">
            <div className="form__group field">
                <input
                    type="text"
                    className="form__field"
                    placeholder="Nickname"
                    name="nickname"
                    id="nickname"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    onKeyUp={handleKeyPress}
                    required
                />
                <label htmlFor="nickname" className="form__label">
                    Enter your nickname
                </label>
                <div
                    className={`arrow-button ${nickname.trim() ? "active" : ""}`}
                    onClick={handleStart}
                >
                    ➡
                </div>
            </div>
        </div>
    );
}