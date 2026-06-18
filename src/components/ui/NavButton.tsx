import type { Icon, IconProps } from "@tabler/icons-react";
import { NavLink } from "react-router";

interface INavLink {
  to: string;
  label: string;
  icon: React.ForwardRefExoticComponent<IconProps & React.RefAttributes<Icon>>;
}

export const NavButton: React.FC<INavLink> = ({ to, label, icon: NavIcon }) => {
  return (
    <NavLink
      key={to}
      to={to}
      className="flex aspect-square w-full flex-col items-center justify-center gap-1.5 rounded-lg transition-colors hover:bg-[var(--mantine-color-default-hover)]"
      style={({ isActive }) => ({
        backgroundColor: isActive
          ? "var(--mantine-primary-color-light)"
          : undefined,
        color: isActive
          ? "var(--mantine-primary-color-light-color)"
          : "var(--mantine-color-text)",
      })}
      aria-label={label}
    >
      <NavIcon size={24} stroke={1.5} />
      <span className="text-center text-[11px] leading-none font-medium tracking-wide">
        {label}
      </span>
    </NavLink>
  );
};
