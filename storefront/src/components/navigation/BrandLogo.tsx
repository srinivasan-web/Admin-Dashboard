import { Link } from "../../app/navigation";
import durafitLogo from "../../../../admin/src/assets/durafit-logo.png";

export function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      className={`brand-logo ${className}`.trim()}
      href="/"
      aria-label="Durafit91 home"
    >
      <img src={durafitLogo} width="868" height="133" alt="Durafit91" />
    </Link>
  );
}
