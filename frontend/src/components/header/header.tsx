import "./header.css";

interface HeaderProps {
  githubLink: string;
}

export default function Header({ githubLink }: HeaderProps) {
  return (
    <div className="header">
      <h1>Gambitron</h1>
      <a href={githubLink} target="_blank" rel="noopener noreferrer">
        GitHub Repo
      </a>
    </div>
  );
}
