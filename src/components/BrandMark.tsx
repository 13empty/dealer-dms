import appIcon from "../assets/app-icon.png";

export function BrandMark({ className = "h-9 w-9" }: { className?: string }) {
  return <img src={appIcon} alt="" className={`rounded-lg ${className}`} />;
}
