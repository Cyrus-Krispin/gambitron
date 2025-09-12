import Timer from "./Timer";

interface DesktopSidebarProps {
  timeMs: number;
  label: string;
  isActive: boolean;
  isThinking?: boolean;
  thinkingText?: string;
  activeText?: string;
}

const DesktopSidebar = ({ 
  timeMs, 
  label, 
  isActive, 
  isThinking, 
  thinkingText, 
  activeText 
}: DesktopSidebarProps) => {
  return (
    <div className="hidden lg:block bg-gray-800 p-4 border-l border-gray-700 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center space-y-6 h-full">
        <Timer 
          timeMs={timeMs}
          label={label}
          isActive={isActive}
          isThinking={isThinking}
          thinkingText={thinkingText}
          activeText={activeText}
        />
      </div>
    </div>
  );
};

export default DesktopSidebar;
