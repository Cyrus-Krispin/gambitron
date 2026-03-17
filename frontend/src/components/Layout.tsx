import { Link, useLocation } from "react-router-dom";

const navLinks = [
  { to: "/history", label: "History" },
  { to: "/about", label: "About" },
];

export function Layout(props: { children: React.ReactNode }) {
  const location = useLocation();

  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <header className="sticky top-0 z-40 w-full border-b border-border/60 bg-background/90 backdrop-blur-xl">
        <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="font-semibold text-foreground hover:text-primary transition-colors">
            Gambitron
          </Link>
          <div className="flex items-center gap-2">
            {navLinks.map(function (item) {
              const isActive = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={
                    isActive
                      ? "px-3 py-2 text-sm font-medium rounded-md text-primary bg-primary/10"
                      : "px-3 py-2 text-sm font-medium rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </header>
      <main className="flex-1 min-h-0 overflow-hidden">{props.children}</main>
    </div>
  );
}
